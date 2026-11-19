// Provider fallback for text-only case intake.
// Uploaded client documents and images are never sent through this route.
// Free provider availability, quotas and data handling can change; do not
// submit confidential client information to third-party free endpoints.

const PROVIDERS = [
  {
    name: "kilo",
    baseUrl: "https://ai-gateway.kilo.ai/api/v1",
    model: process.env.KILO_MODEL || "kilo-auto/free",
    apiKey: process.env.KILO_API_KEY || ""
  },
  {
    name: "ovh",
    baseUrl: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1",
    model: process.env.OVH_MODEL || "gpt-oss-120b",
    apiKey: process.env.OVH_AI_ENDPOINTS_API_KEY || process.env.OVH_API_KEY || ""
  },
  {
    name: "llm7",
    baseUrl: "https://api.llm7.io/v1",
    model: process.env.LLM7_MODEL || "default",
    apiKey: process.env.LLM7_API_KEY || ""
  }
];

function diagnostic(event, details = {}) {
  console.info("[analysis-diagnostic]", JSON.stringify({ event, ...details }));
}

function getConfiguredProviders() {
  const available = PROVIDERS.filter(provider =>
    // Kilo explicitly permits anonymous requests for its free model.
    provider.name === "kilo" || Boolean(provider.apiKey)
  );
  const order = (process.env.FREE_LLM_FALLBACK_ORDER || "kilo,ovh,llm7")
    .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  return order
    .map(name => available.find(provider => provider.name === name))
    .filter((provider, index, list) => provider && list.indexOf(provider) === index);
}

async function requestProvider(provider, systemInstructions, userText, validateResponse, signal) {
  const headers = { "Content-Type": "application/json" };
  if (provider.apiKey) headers.Authorization = "Bearer " + provider.apiKey;

  const response = await fetch(provider.baseUrl + "/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: systemInstructions },
        { role: "user", content: userText }
      ],
      temperature: 0.25,
      max_tokens: 16384,
      stream: false
    }),
    signal
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after");
    diagnostic("fallback_provider_http_failure", {
      provider: provider.name,
      status: response.status,
      retryAfter: retryAfter ? retryAfter.slice(0, 40) : null
    });
    throw new Error("HTTP " + response.status);
  }

  const text = payload.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    diagnostic("fallback_provider_empty_response", { provider: provider.name });
    throw new Error("empty response");
  }

  const cleanText = text.trim();
  if (typeof validateResponse === "function" && !validateResponse(cleanText)) {
    diagnostic("fallback_provider_output_invalid", {
      provider: provider.name,
      outputLength: cleanText.length
    });
    throw new Error("incomplete analysis structure");
  }

  return { provider: provider.name, text: cleanText };
}

export async function callFreeLlmFallback({ systemInstructions, userText, validateResponse }) {
  const ordered = getConfiguredProviders();
  if (!ordered.length) throw new Error("No fallback providers are configured.");

  // Reserve enough of the 60-second Vercel function budget for authentication, quota accounting and refund handling.
  // Authenticated providers are only attempted when their key is configured.
  const timeoutMs = 12000;
  const controllers = ordered.map(() => new AbortController());
  diagnostic("fallback_sequence_started", {
    providers: ordered.map(provider => provider.name),
    strategy: "parallel",
    providerTimeoutMs: timeoutMs
  });

  const attempts = ordered.map((provider, index) =>
    requestProvider(provider, systemInstructions, userText, validateResponse, controllers[index].signal)
      .then(result => {
        diagnostic("fallback_provider_succeeded", {
          provider: result.provider,
          outputLength: result.text.length
        });
        return result;
      })
      .catch(error => {
        const reason = error?.name === "TimeoutError" || error?.name === "AbortError"
          ? "timeout"
          : String(error?.message || "request failed").slice(0, 80);
        diagnostic("fallback_provider_request_failed", {
          provider: provider.name,
          reason,
          errorName: error?.name || "Error"
        });
        throw new Error(provider.name + ": " + reason);
      })
  );

  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("Fallback providers timed out.")), timeoutMs);
  });

  try {
    const result = await Promise.race([Promise.any(attempts), timeout]);
    clearTimeout(timer);
    controllers.forEach((controller, index) => {
      if (ordered[index].name !== result.provider) controller.abort();
    });
    return result;
  } catch (error) {
    clearTimeout(timer);
    controllers.forEach(controller => controller.abort());
    const failures = await Promise.allSettled(attempts);
    const reasons = failures
      .filter(item => item.status === "rejected")
      .map(item => String(item.reason?.message || "failed"));
    diagnostic("fallback_all_providers_exhausted", { failures: reasons });
    throw new Error("No fallback provider returned a valid response (" + reasons.join("; ") + ")");
  }
}

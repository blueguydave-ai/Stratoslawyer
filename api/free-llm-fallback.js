// Anonymous fallback providers. Availability and free quotas can change;
// run independent attempts concurrently so one slow endpoint cannot consume
// the entire fallback window before the others get a chance.
// Never pass uploaded client documents or images through this fallback.

const PROVIDERS = [
  {
    name: "ovh",
    baseUrl: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1",
    model: process.env.OVH_MODEL || "gpt-oss-120b"
  },
  {
    name: "llm7",
    baseUrl: "https://api.llm7.io/v1",
    model: process.env.LLM7_MODEL || "gpt-oss:20b"
  },
  {
    name: "kilo",
    baseUrl: "https://api.kilo.ai/api/gateway",
    model: process.env.KILO_MODEL || "kilo-auto/free"
  }
];

function diagnostic(event, details = {}) {
  console.info("[analysis-diagnostic]", JSON.stringify({ event, ...details }));
}

async function requestProvider(provider, systemInstructions, userText, validateResponse, signal) {
  const response = await fetch(provider.baseUrl + "/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: systemInstructions },
        { role: "user", content: userText }
      ],
      temperature: 0.25,
      max_tokens: 8192
    }),
    signal
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    diagnostic("fallback_provider_http_failure", { provider: provider.name, status: response.status });
    throw new Error("HTTP " + response.status);
  }

  const text = payload.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    diagnostic("fallback_provider_empty_response", { provider: provider.name });
    throw new Error("empty response");
  }

  const cleanText = text.trim();
  if (typeof validateResponse === "function" && !validateResponse(cleanText)) {
    diagnostic("fallback_provider_output_invalid", { provider: provider.name, outputLength: cleanText.length });
    throw new Error("incomplete analysis structure");
  }

  return { provider: provider.name, text: cleanText };
}

export async function callFreeLlmFallback({ systemInstructions, userText, validateResponse }) {
  const configuredOrder = (process.env.FREE_LLM_FALLBACK_ORDER || "ovh,llm7,kilo")
    .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  const ordered = configuredOrder
    .map(name => PROVIDERS.find(provider => provider.name === name))
    .filter((provider, index, list) => provider && list.indexOf(provider) === index);

  if (!ordered.length) throw new Error("No fallback providers are configured.");

  const timeoutMs = 18000;
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

  const timeout = new Promise((_, reject) => {
    const timer = setTimeout(() => reject(new Error("Fallback providers timed out.")), timeoutMs);
    // The timer is cleared when Promise.any settles, whether it succeeds or fails.
    Promise.any(attempts).then(
      () => clearTimeout(timer),
      () => clearTimeout(timer)
    );
  });

  try {
    const result = await Promise.race([Promise.any(attempts), timeout]);
    controllers.forEach((controller, index) => {
      if (ordered[index].name !== result.provider) controller.abort();
    });
    return result;
  } catch (error) {
    controllers.forEach(controller => controller.abort());
    const failures = await Promise.allSettled(attempts);
    const reasons = failures
      .filter(item => item.status === "rejected")
      .map(item => String(item.reason?.message || "failed"));
    diagnostic("fallback_all_providers_exhausted", { failures: reasons });
    throw new Error("No fallback provider returned a valid response (" + reasons.join("; ") + ")");
  }
}

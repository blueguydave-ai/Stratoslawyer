// Verified no-key text inference providers listed in mnfst/awesome-free-llm-apis.
// Free pools and anonymous quotas can change; this adapter is deliberately bounded.
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

export async function callFreeLlmFallback({ systemInstructions, userText }) {
  // Start with providers that returned actual text in live anonymous tests.
  // Kilo remains a last-resort option; its free route was slow/unreliable in testing.
  const configuredOrder = (process.env.FREE_LLM_FALLBACK_ORDER || "ovh,llm7,kilo")
    .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  const ordered = configuredOrder
    .map(name => PROVIDERS.find(provider => provider.name === name))
    .filter((provider, index, list) => provider && list.indexOf(provider) === index);
  const deadline = Date.now() + 12000;
  const failures = [];
  console.info("[analysis-diagnostic]", JSON.stringify({ event: "fallback_sequence_started", providers: ordered.map(p => p.name), deadlineMs: 12000 }));

  for (const provider of ordered) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
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
        signal: AbortSignal.timeout(Math.min(4000, remaining))
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.warn("[analysis-diagnostic]", JSON.stringify({ event: "fallback_provider_http_failure", provider: provider.name, status: response.status }));
        failures.push(provider.name + ": HTTP " + response.status);
        continue;
      }
      const text = payload.choices?.[0]?.message?.content;
      if (typeof text === "string" && text.trim()) {
        console.info("[analysis-diagnostic]", JSON.stringify({ event: "fallback_provider_returned_text", provider: provider.name, outputLength: text.trim().length }));
        return { provider: provider.name, text: text.trim() };
      }
      console.warn("[analysis-diagnostic]", JSON.stringify({ event: "fallback_provider_empty_response", provider: provider.name }));
      failures.push(provider.name + ": empty response");
    } catch (error) {
      const reason = error?.name === "TimeoutError" || error?.name === "AbortError" ? "timeout" : "request failed";
      console.warn("[analysis-diagnostic]", JSON.stringify({ event: "fallback_provider_request_failed", provider: provider.name, reason, errorName: error?.name || "UnknownError" }));
      failures.push(provider.name + ": " + reason);
    }
  }

  console.error("[analysis-diagnostic]", JSON.stringify({ event: "fallback_all_providers_exhausted", failures }));
  throw new Error("No no-key fallback provider returned a response (" + failures.join("; ") + ")");
}

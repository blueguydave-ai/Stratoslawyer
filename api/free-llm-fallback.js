// Optional text-only fallback adapters for free-tier OpenAI-compatible providers.
// Enable only after reviewing the provider's confidentiality and data-processing terms.
// This module never receives uploaded files; api/analyze.js calls it only when files.length === 0.

const PROVIDERS = {
  zai: {
    key: "ZAI_API_KEY",
    modelEnv: "ZAI_MODEL",
    defaultModel: "glm-4.7-flash",
    url: "https://open.bigmodel.cn/api/paas/v4/chat/completions"
  },
  groq: {
    key: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    defaultModel: "openai/gpt-oss-120b",
    url: "https://api.groq.com/openai/v1/chat/completions"
  }
};

export async function callFreeLlmFallback({ systemInstructions, userText }) {
  const order = (process.env.FREE_LLM_FALLBACK_ORDER || "zai,groq")
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter((name, index, values) =>
      Object.hasOwn(PROVIDERS, name) && values.indexOf(name) === index
    );

  const available = order.filter(name => process.env[PROVIDERS[name].key]);
  if (!available.length) {
    throw new Error("No configured free fallback provider is available.");
  }

  const failures = [];
  for (const name of available.slice(0, 2)) {
    const provider = PROVIDERS[name];
    try {
      const response = await fetch(provider.url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env[provider.key]}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: process.env[provider.modelEnv] || provider.defaultModel,
          messages: [
            { role: "system", content: systemInstructions },
            { role: "user", content: userText }
          ],
          temperature: 0.25,
          max_tokens: 12288
        }),
        signal: AbortSignal.timeout(12000)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        failures.push(`${name}: HTTP ${response.status}`);
        continue;
      }
      const text = payload.choices?.[0]?.message?.content;
      if (typeof text === "string" && text.trim()) {
        return { provider: name, text: text.trim() };
      }
      failures.push(`${name}: empty response`);
    } catch (error) {
      failures.push(`${name}: request failed`);
    }
  }
  throw new Error(`All configured free fallback providers failed: ${failures.join("; ")}`);
}

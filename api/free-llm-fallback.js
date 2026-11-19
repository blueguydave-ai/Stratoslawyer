// OpenAI-compatible adapters based on mnfst/awesome-free-llm-apis.
// Provider catalog and free-tier limits change; verify the source README and provider terms.
// External providers are opt-in. This adapter is called only for text-only requests.

const PROVIDERS = {
  zai: { key:"ZAI_API_KEY", url:"https://api.z.ai/api/paas/v4", modelEnv:"ZAI_MODEL", model:"glm-4.7-flash" },
  groq: { key:"GROQ_API_KEY", url:"https://api.groq.com/openai/v1", modelEnv:"GROQ_MODEL", model:"openai/gpt-oss-120b" },
  kilo: { key:"", url:"https://api.kilo.ai/api/gateway", modelEnv:"KILO_MODEL", model:"kilo-auto/free", noKey:true },
  llm7: { key:"LLM7_API_KEY", url:"https://api.llm7.io/v1", modelEnv:"LLM7_MODEL", model:"gpt-oss:20b", optionalKey:true },
  ovh: { key:"", url:"https://oai.endpoints.kepler.ai.cloud.ovh.net/v1", modelEnv:"OVH_MODEL", model:"gpt-oss-120b", noKey:true },
  openrouter: { key:"OPENROUTER_API_KEY", url:"https://openrouter.ai/api/v1", modelEnv:"OPENROUTER_MODEL", model:"nvidia/nemotron-3.5-lightning:free" },
  nvidia: { key:"NVIDIA_API_KEY", url:"https://integrate.api.nvidia.com/v1", modelEnv:"NVIDIA_MODEL", model:"openai/gpt-oss-20b" },
  cohere: { key:"COHERE_API_KEY", url:"https://api.cohere.ai/compatibility/v1", modelEnv:"COHERE_MODEL", model:"command-r7b-12-2024" },
  axforge: { key:"AXFORGE_API_KEY", url:"https://api.axforge.ai/v1", modelEnv:"AXFORGE_MODEL", model:"qwen3.5-27b" }
};

function isConfigured(name, p) {
  if (p.noKey) return true;
  if (p.optionalKey) return true;
  return Boolean(process.env[p.key]);
}

export async function callFreeLlmFallback({ systemInstructions, userText }) {
  const order = (process.env.FREE_LLM_FALLBACK_ORDER || "kilo,llm7,ovh,zai,groq,openrouter,nvidia,cohere,axforge")
    .split(",").map(x => x.trim().toLowerCase())
    .filter((x,i,a) => Object.hasOwn(PROVIDERS,x) && a.indexOf(x) === i);

  const failures = [];
  for (const name of order) {
    const p = PROVIDERS[name];
    if (!isConfigured(name,p)) continue;
    const apiKey = p.key ? process.env[p.key] : "";
    try {
      const headers = { "Content-Type":"application/json" };
      if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
      const response = await fetch(`${p.url}/chat/completions`, {
        method:"POST", headers,
        body:JSON.stringify({
          model:process.env[p.modelEnv] || p.model,
          messages:[
            {role:"system",content:systemInstructions},
            {role:"user",content:userText}
          ],
          temperature:0.25,
          max_tokens:12288
        }),
        signal:AbortSignal.timeout(20000)
      });
      const payload = await response.json().catch(()=>({}));
      if (!response.ok) {
        failures.push(`${name}: HTTP ${response.status}`);
        // A 401/403/404 means this provider cannot be used with the current config.
        continue;
      }
      const text = payload.choices?.[0]?.message?.content;
      if (typeof text === "string" && text.trim()) return {provider:name,text:text.trim()};
      failures.push(`${name}: empty response`);
    } catch {
      failures.push(`${name}: request failed`);
    }
  }
  throw new Error(`No free LLM provider returned a response (${failures.join("; ")})`);
}

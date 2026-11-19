# Optional no-key LLM fallback for STRATOSLAWYER

Gemini remains the primary analysis provider. When Gemini returns a rate-limit/server error or times out, STRATOSLAWYER can try a short, bounded chain of text-only providers that the public [awesome-free-llm-apis list](https://github.com/mnfst/awesome-free-llm-apis) currently describes as usable without an API key:

1. Kilo Code — `https://api.kilo.ai/api/gateway`, model `kilo-auto/free`.
2. OVHcloud AI Endpoints — `https://oai.endpoints.kepler.ai.cloud.ovh.net/v1`, model `gpt-oss-120b`.
3. LLM7.io — `https://api.llm7.io/v1`, model `gpt-oss:20b`.

The list and provider quotas can change. A provider is considered available only if it actually returns a valid response to the live request. The fallback attempts providers sequentially, with a 4-second per-provider timeout and a 12-second total budget. The order can be changed with the server-side `FREE_LLM_FALLBACK_ORDER` variable (default: `kilo,ovh,llm7`).

## Environment variables

- `ENABLE_FREE_LLM_FALLBACK=true` — enables fallback.
- `FREE_LLM_FALLBACK_ORDER=kilo,ovh,llm7` — optional provider order.
- `KILO_MODEL`, `OVH_MODEL`, `LLM7_MODEL` — optional model overrides.

No provider API keys are required for these three attempts. Do not add secret keys to browser-visible variables.

## Confidentiality boundary

This fallback is only used for requests with no uploaded files. Uploaded PDFs and images are never forwarded through it. Text-only case facts can still be confidential or privileged. Free providers may log prompts, route requests to other model hosts, or apply different retention/training terms. Do not use third-party fallback for real client matters until the responsible lawyer has reviewed and approved the provider's current terms and confidentiality safeguards.

## Rollout and testing

1. Keep Gemini as primary and fallback explicitly enabled only after review.
2. Test with fictional/synthetic Nigerian legal scenarios, never real client material.
3. Confirm the response contains all four required STRATOSLAWYER sections.
4. The API response includes `analysisProvider` so a test can identify which provider actually returned the analysis.
5. A configured fallback switch does not guarantee a provider will answer; free capacity, anonymous access and model availability can change.

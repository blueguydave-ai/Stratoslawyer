# Optional free LLM fallback for STRATOSLAWYER

The existing Gemini analysis engine remains the primary provider. An optional text-only fallback adapter is available for Z AI and Groq.

## Important confidentiality boundary

STRATOSLAWYER processes potentially privileged and confidential client material. Free provider tiers can have different logging, retention, training and data-processing terms. Do not enable third-party fallback for real client matters until the responsible lawyer has assessed and approved the provider's current terms, confidentiality safeguards and applicable professional obligations.

The fallback is disabled unless `ENABLE_FREE_LLM_FALLBACK=true`. It is only called when the Gemini request fails with a rate-limit/server/network error, and only when the request contains no uploaded files. Uploaded PDFs and images are never forwarded by this fallback adapter. This is a technical guardrail, not a guarantee that text-only case facts are non-confidential.

## Vercel environment variables

Set these as server-side encrypted environment variables, never `NEXT_PUBLIC_*` or browser variables:

- `ENABLE_FREE_LLM_FALLBACK=true` — leave unset/false until the provider has been approved.
- `ZAI_API_KEY` — optional key from https://open.bigmodel.cn/usercenter/apikeys
- `ZAI_MODEL` — optional; defaults to `glm-4.7-flash`.
- `GROQ_API_KEY` — optional key from https://console.groq.com/keys
- `GROQ_MODEL` — optional; defaults to `openai/gpt-oss-120b`.
- `FREE_LLM_FALLBACK_ORDER` — optional comma-separated order; defaults to `zai,groq`.

Only providers with configured keys are attempted, with at most two attempts. Provider model availability and free-tier quotas can change; verify current provider documentation and test each key before relying on it.

## Rollout

1. Deploy with fallback disabled.
2. Review each provider's current terms and privacy posture.
3. Add one provider key as an encrypted Vercel environment variable in Preview first.
4. Enable fallback only in Preview and test with synthetic, non-client sample data.
5. Keep fallback disabled in Production until the same review and testing is complete.

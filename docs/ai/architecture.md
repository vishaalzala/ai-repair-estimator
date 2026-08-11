# AI Architecture

## V1 provider decision
OpenAI only for V1. Application code must depend on the internal AiProvider interface rather than directly on the OpenAI SDK outside `lib/ai/providers/openai.ts`.

## Future compatibility
- Plan B: self-hosted/open-weight provider
- Plan C: hybrid router with task/cost/confidence based routing

## Learning model
The foundation model is not retrained on every user edit. Long-term memory remains in our database.

Scopes:
- USER — one estimator
- ORGANIZATION — one workshop/repair group
- GLOBAL — platform-admin curated

Tenant activity never becomes global knowledge automatically.

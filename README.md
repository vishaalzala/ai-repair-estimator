# AI Repair Estimator

AI-assisted automotive repair estimating SaaS for panel beaters, collision repairers and mechanical workshops preparing insurer estimates.

## Product principle
The platform helps estimators identify visible damage, build estimates, check legitimate operations that may have been omitted, manage parts/TBC pricing, learn scoped workshop knowledge, preserve version history and generate insurer-ready reports. AI assists; a human estimator reviews and approves.

## Stack
- Next.js + TypeScript
- Vercel
- Supabase PostgreSQL/Auth/Storage/RLS/pgvector
- OpenAI (V1 provider)
- Provider-neutral internal AI interface for future self-hosted/hybrid models

## Local setup
1. Copy `.env.example` to `.env.local`.
2. Configure development environment keys.
3. Install dependencies with `npm ci` once `package-lock.json` exists.
4. Run `npm run dev`.

Never expose `SUPABASE_SECRET_KEY` or `OPENAI_API_KEY` to the browser.

## Delivery phases
Architecture → multi-tenant SaaS foundation → auth/onboarding → workshop settings/rate cards → jobs/claims → photos → manual estimate builder → rules engine → OpenAI damage analysis → AI estimate review → knowledge/learning → parts/PartsTrader workflow → versions/supplements → reports/email → billing/admin → security/performance → pilot → production.

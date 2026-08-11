# System Architecture

## V1 runtime
- Next.js/TypeScript application on Vercel
- Supabase PostgreSQL, Auth and private Storage
- Supabase RLS for tenant isolation
- OpenAI through a provider abstraction
- Knowledge memory in PostgreSQL + pgvector
- Deterministic Rules Engine and Pricing Engine

## Five-engine product model
1. AI Damage Engine — visible damage and evidence
2. Knowledge Engine — global, organization and user scoped memory
3. Rules Engine — repair dependencies and required checks
4. Pricing Engine — deterministic rates, materials, parts, GST and totals
5. AI Estimate Review — possible legitimate omissions for estimator review

AI never approves an estimate or performs authoritative pricing mathematics.

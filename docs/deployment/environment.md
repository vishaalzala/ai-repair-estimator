# Production environment contract

All secrets are configured in the deployment platform. Never commit secret values to GitHub.

## Public browser configuration

- `NEXT_PUBLIC_APP_URL` — canonical deployed application URL.
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase publishable key (not service-role/secret key).

## OpenAI server configuration

- `OPENAI_API_KEY` — server-only OpenAI API key.
- `AI_PROVIDER=openai`
- `AI_DAMAGE_MODEL` — model selected for visible-damage analysis.
- `AI_REVIEW_MODEL` — model selected for estimate second-pass review.
- `AI_DOCUMENT_MODEL` — model selected for knowledge document extraction.
- `AI_EMBEDDING_MODEL` — embedding model used for 1536-dimensional retrieval vectors.
- `AI_LEARNING_MODEL` — optional later learning-pattern analysis model.

Model IDs are configuration, not hardcoded product logic. Model changes require the AI evaluation suite before production rollout.

## Optional / later integrations

- `RESEND_API_KEY` — transactional email provider secret.
- `EMAIL_FROM` — verified sending identity.
- Stripe secrets/product identifiers once commercial plans are frozen.

## Supabase server secret

The current V1 application deliberately performs normal user actions using authenticated Supabase sessions and RLS. A `SUPABASE_SECRET_KEY` must only be added if a future background/admin server process genuinely requires privileged access; it must never use a `NEXT_PUBLIC_` prefix.

## Production safety

Use separate environment values for Preview and Production. Do not copy production customer data into preview environments. Supabase Auth Site URL and allowed redirect URLs must include the deployed application URL before email-confirmation testing.

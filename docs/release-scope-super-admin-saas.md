# Super Admin SaaS release scope

This release is intended to include:

- separate Super Admin login and `/admin/*` authorization
- admin dashboard, organizations, users, estimates, knowledge, learning, AI controls, usage, plans, billing, system, audit and settings
- removal of normal-user `/knowledge`
- admin-only global AI estimator teaching
- learning-candidate approval workflow
- Starter pricing: NZ$9.99/month + actual AI processing cost + 10% markup
- immutable AI usage ledger and per-estimate AI charge records
- Stripe-ready subscription and usage invoice-item integration when Stripe environment variables are configured
- customer Billing page
- AI estimator prompt guidance for complete insurance-style estimates with one operation per line and supplier parts pricing left TBC

The release must pass typecheck, lint and production build before merge.
# Super Admin + SaaS foundation

This branch introduces the first production foundation for RepairQuote AI as a SaaS platform:

- separate platform-admin authorization under `/admin/*`
- dedicated `/admin/login`
- Super Admin dashboard, organizations, users, estimates, AI Knowledge, usage, plans and settings foundations
- remove `/knowledge` from the normal workshop navigation and redirect normal-user access
- platform-level AI Knowledge publishing and learning-candidate review foundations
- SaaS plan and AI usage-ledger schema
- default Starter plan: NZ$9.99/month, 10% AI usage markup, NZ$0 minimum usage charge
- audit-log coverage for platform-admin mutations

Stripe subscription charging and automatic invoice collection are intentionally layered after this security/data foundation is verified.
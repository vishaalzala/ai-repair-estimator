create policy ai_review_checks_delete_ai_refresh on public.ai_review_checks
for delete to authenticated
using (
  source_type = 'ai'
  and private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer'])
);

create policy ai_review_checks_delete_rule_refresh on public.ai_review_checks
for delete to authenticated
using (
  source_type = 'rule'
  and private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer'])
);

grant delete on public.ai_review_checks to authenticated;

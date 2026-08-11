create policy ai_prompt_versions_no_client_access on public.ai_prompt_versions
for all to authenticated
using (false)
with check (false);

create index if not exists activity_events_org_job_fk_idx on public.activity_events(organization_id, job_id);
create index if not exists ai_analysis_runs_created_by_idx on public.ai_analysis_runs(created_by);
create index if not exists ai_analysis_runs_org_job_fk_idx on public.ai_analysis_runs(organization_id, job_id);
create index if not exists ai_analysis_runs_prompt_version_idx on public.ai_analysis_runs(prompt_version_id);
create index if not exists ai_review_checks_org_job_fk_idx on public.ai_review_checks(organization_id, job_id);
create index if not exists ai_review_checks_org_idx on public.ai_review_checks(organization_id);
create index if not exists ai_review_checks_resolved_by_idx on public.ai_review_checks(resolved_by);
create index if not exists claims_org_insurer_fk_idx on public.claims(organization_id, insurer_id);
create index if not exists claims_org_job_fk_idx on public.claims(organization_id, job_id);
create index if not exists damage_evidence_org_idx on public.damage_evidence(organization_id);
create index if not exists damage_findings_org_job_fk_idx on public.damage_findings(organization_id, job_id);
create index if not exists damage_findings_org_idx on public.damage_findings(organization_id);
create index if not exists damage_findings_reviewed_by_idx on public.damage_findings(reviewed_by);
create index if not exists estimate_items_org_category_fk_idx on public.estimate_items(organization_id, category_id);
create index if not exists estimate_items_org_estimate_fk_idx on public.estimate_items(organization_id, estimate_id);
create index if not exists estimate_items_org_idx on public.estimate_items(organization_id);
create index if not exists estimates_org_rate_card_fk_idx on public.estimates(organization_id, rate_card_id);
create index if not exists job_assignments_org_member_fk_idx on public.job_assignments(organization_id, user_id);
create index if not exists job_notes_org_job_fk_idx on public.job_notes(organization_id, job_id);
create index if not exists job_status_history_org_job_fk_idx on public.job_status_history(organization_id, job_id);
create index if not exists jobs_org_assigned_member_fk_idx on public.jobs(organization_id, assigned_to);
create index if not exists jobs_org_branch_fk_idx on public.jobs(organization_id, branch_id);
create index if not exists knowledge_chunks_org_idx on public.knowledge_chunks(organization_id);
create index if not exists knowledge_documents_created_by_idx on public.knowledge_documents(created_by);
create index if not exists knowledge_sources_created_by_idx on public.knowledge_sources(created_by);
create index if not exists learning_candidates_reviewed_by_idx on public.learning_candidates(reviewed_by);
create index if not exists learning_events_job_idx on public.learning_events(job_id);
create index if not exists learning_events_org_job_fk_idx on public.learning_events(organization_id, job_id);
create index if not exists photos_org_job_fk_idx on public.photos(organization_id, job_id);
create index if not exists rate_card_rates_org_card_fk_idx on public.rate_card_rates(organization_id, rate_card_id);
create index if not exists rate_card_rates_category_idx on public.rate_card_rates(category_id);
create index if not exists rate_card_rates_org_category_fk_idx on public.rate_card_rates(organization_id, category_id);
create index if not exists rate_card_rates_org_idx on public.rate_card_rates(organization_id);
create index if not exists rate_cards_org_insurer_fk_idx on public.rate_cards(organization_id, insurer_id);
create index if not exists rule_versions_created_by_idx on public.rule_versions(created_by);
create index if not exists rules_created_by_idx on public.rules(created_by);
create index if not exists rules_current_version_idx on public.rules(current_version_id);
create index if not exists vehicles_org_customer_fk_idx on public.vehicles(organization_id, customer_id);

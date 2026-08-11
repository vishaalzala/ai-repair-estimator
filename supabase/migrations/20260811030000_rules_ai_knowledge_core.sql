create extension if not exists vector with schema extensions;

create table public.rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  scope text not null check (scope in ('organization','global')),
  code text not null check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  description text,
  enforcement_level text not null default 'suggestion' check (enforcement_level in ('information','suggestion','required_review','mandatory')),
  status text not null default 'active' check (status in ('draft','active','retired')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((scope = 'global' and organization_id is null) or (scope = 'organization' and organization_id is not null)),
  unique nulls not distinct (organization_id, code),
  unique (id, organization_id)
);

create table public.rule_versions (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.rules(id) on delete cascade,
  version integer not null check (version > 0),
  conditions jsonb not null default '{}'::jsonb,
  actions jsonb not null default '[]'::jsonb,
  change_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (rule_id, version)
);

alter table public.rules add column current_version_id uuid references public.rule_versions(id) on delete set null;

create table public.ai_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  task text not null check (task in ('photo_classification','damage_analysis','estimate_review','document_extraction','learning_analysis')),
  version integer not null check (version > 0),
  name text not null,
  system_prompt text not null,
  output_schema jsonb,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (task, version)
);

create table public.ai_analysis_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  task text not null check (task in ('photo_classification','damage_analysis','estimate_review','document_extraction','learning_analysis')),
  provider text not null default 'openai',
  model text not null,
  prompt_version_id uuid references public.ai_prompt_versions(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  input_metadata jsonb not null default '{}'::jsonb,
  structured_output jsonb,
  raw_response jsonb,
  error_code text,
  input_tokens integer check (input_tokens is null or input_tokens >= 0),
  cached_input_tokens integer check (cached_input_tokens is null or cached_input_tokens >= 0),
  output_tokens integer check (output_tokens is null or output_tokens >= 0),
  estimated_cost_usd numeric(12,6) check (estimated_cost_usd is null or estimated_cost_usd >= 0),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint ai_analysis_runs_job_same_org_fk foreign key (organization_id, job_id)
    references public.jobs(organization_id, id) on delete cascade
);

create table public.damage_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  ai_run_id uuid references public.ai_analysis_runs(id) on delete set null,
  impact_area text,
  component text not null,
  side text check (side is null or side in ('LH','RH','FRONT','REAR','CENTRE','NA')),
  observed_damage text not null,
  suggested_action text not null check (suggested_action in ('REPAIR','REPLACE','R&R','TRANSFER','PAINT','BLEND','CUT&WELD','ALIGN','CHECK_AFTER_STRIP','OUTWORK','TBC','INSPECT')),
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  is_hidden_damage_claim boolean not null default false,
  review_status text not null default 'pending' check (review_status in ('pending','accepted','modified','rejected')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint damage_findings_job_same_org_fk foreign key (organization_id, job_id)
    references public.jobs(organization_id, id) on delete cascade
);

create table public.damage_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  finding_id uuid not null references public.damage_findings(id) on delete cascade,
  photo_id uuid not null references public.photos(id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  unique (finding_id, photo_id)
);

create table public.ai_review_checks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  ai_run_id uuid references public.ai_analysis_runs(id) on delete set null,
  check_type text not null,
  title text not null,
  detail text,
  severity text not null default 'review' check (severity in ('pass','information','review','blocking')),
  source_type text check (source_type is null or source_type in ('ai','rule','knowledge','consistency')),
  source_ref text,
  evidence jsonb not null default '[]'::jsonb,
  resolution text check (resolution is null or resolution in ('added','edited','not_required','already_included','acknowledged')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ai_review_checks_job_same_org_fk foreign key (organization_id, job_id)
    references public.jobs(organization_id, id) on delete cascade
);

create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  scope text not null check (scope in ('user','organization','global')),
  source_type text not null check (source_type in ('manual','document','learned_pattern','admin')),
  title text not null,
  content_text text,
  status text not null default 'active' check (status in ('draft','processing','active','failed','retired')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope = 'global' and organization_id is null and user_id is null)
    or (scope = 'organization' and organization_id is not null and user_id is null)
    or (scope = 'user' and organization_id is not null and user_id is not null)
  )
);

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  storage_path text not null,
  version integer not null default 1 check (version > 0),
  page_count integer check (page_count is null or page_count >= 0),
  processing_status text not null default 'pending' check (processing_status in ('pending','processing','ready','failed')),
  processing_error text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, storage_path)
);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  document_id uuid references public.knowledge_documents(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  page_number integer check (page_number is null or page_number > 0),
  section_title text,
  content text not null,
  embedding extensions.vector(1536),
  embedding_model text,
  created_at timestamptz not null default now(),
  unique (source_id, chunk_index)
);

create table public.learning_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  event_type text not null check (event_type in ('ai_accepted','ai_modified','ai_rejected','manual_item_added','labour_changed','operation_changed','part_changed','supplement_added','teach_ai')),
  entity_type text,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint learning_events_job_same_org_fk foreign key (organization_id, job_id)
    references public.jobs(organization_id, id) on delete cascade
);

create table public.learning_candidates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  scope text not null check (scope in ('organization','global')),
  title text not null,
  pattern_summary text not null,
  supporting_event_ids uuid[] not null default '{}',
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  status text not null default 'pending' check (status in ('pending','approved','rejected','promoted')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((scope = 'global' and organization_id is null) or (scope = 'organization' and organization_id is not null))
);

create index rules_org_status_idx on public.rules(organization_id, status);
create index rule_versions_rule_idx on public.rule_versions(rule_id, version desc);
create index ai_runs_job_created_idx on public.ai_analysis_runs(job_id, created_at desc);
create index ai_runs_org_task_idx on public.ai_analysis_runs(organization_id, task, created_at desc);
create index damage_findings_job_idx on public.damage_findings(job_id, review_status);
create index damage_findings_run_idx on public.damage_findings(ai_run_id);
create index damage_evidence_finding_idx on public.damage_evidence(finding_id);
create index damage_evidence_photo_idx on public.damage_evidence(photo_id);
create index ai_review_checks_job_idx on public.ai_review_checks(job_id, severity, created_at);
create index ai_review_checks_run_idx on public.ai_review_checks(ai_run_id);
create index knowledge_sources_org_scope_idx on public.knowledge_sources(organization_id, scope, status);
create index knowledge_sources_user_idx on public.knowledge_sources(user_id, status);
create index knowledge_documents_source_idx on public.knowledge_documents(source_id, created_at desc);
create index knowledge_chunks_source_idx on public.knowledge_chunks(source_id, chunk_index);
create index knowledge_chunks_document_idx on public.knowledge_chunks(document_id, chunk_index);
create index learning_events_org_type_idx on public.learning_events(organization_id, event_type, created_at desc);
create index learning_events_user_idx on public.learning_events(user_id, created_at desc);
create index learning_candidates_org_status_idx on public.learning_candidates(organization_id, status, created_at desc);

create trigger rules_set_updated_at before update on public.rules for each row execute function private.set_updated_at();
create trigger knowledge_sources_set_updated_at before update on public.knowledge_sources for each row execute function private.set_updated_at();

create or replace function private.can_access_knowledge(_scope text, _organization_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when _scope = 'global' then true
    when _scope = 'organization' then _organization_id is not null and private.has_org_access(_organization_id)
    when _scope = 'user' then _organization_id is not null and _user_id = (select auth.uid()) and private.has_org_access(_organization_id)
    else false
  end;
$$;

revoke all on function private.can_access_knowledge(text, uuid, uuid) from public;
grant execute on function private.can_access_knowledge(text, uuid, uuid) to authenticated, service_role;

alter table public.rules enable row level security;
alter table public.rule_versions enable row level security;
alter table public.ai_prompt_versions enable row level security;
alter table public.ai_analysis_runs enable row level security;
alter table public.damage_findings enable row level security;
alter table public.damage_evidence enable row level security;
alter table public.ai_review_checks enable row level security;
alter table public.knowledge_sources enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.learning_events enable row level security;
alter table public.learning_candidates enable row level security;

create policy rules_select_scoped on public.rules for select to authenticated using (scope = 'global' or (organization_id is not null and private.has_org_access(organization_id)));
create policy rules_insert_org on public.rules for insert to authenticated with check (scope = 'organization' and organization_id is not null and private.has_org_role(organization_id, array['owner','admin','manager']));
create policy rules_update_org on public.rules for update to authenticated using (scope = 'organization' and organization_id is not null and private.has_org_role(organization_id, array['owner','admin','manager'])) with check (scope = 'organization' and organization_id is not null and private.has_org_role(organization_id, array['owner','admin','manager']));
create policy rules_delete_org on public.rules for delete to authenticated using (scope = 'organization' and organization_id is not null and private.has_org_role(organization_id, array['owner','admin','manager']));

create policy rule_versions_select_scoped on public.rule_versions for select to authenticated using (exists (select 1 from public.rules r where r.id = rule_id and (r.scope = 'global' or (r.organization_id is not null and private.has_org_access(r.organization_id)))));
create policy rule_versions_insert_org on public.rule_versions for insert to authenticated with check (exists (select 1 from public.rules r where r.id = rule_id and r.scope = 'organization' and r.organization_id is not null and private.has_org_role(r.organization_id, array['owner','admin','manager'])));

create policy ai_runs_select_org on public.ai_analysis_runs for select to authenticated using (private.has_org_access(organization_id));
create policy ai_runs_insert_org on public.ai_analysis_runs for insert to authenticated with check (created_by = (select auth.uid()) and private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy ai_runs_update_org on public.ai_analysis_runs for update to authenticated using (created_by = (select auth.uid()) or private.has_org_role(organization_id, array['owner','admin','manager'])) with check (private.has_org_access(organization_id));

create policy damage_findings_select_org on public.damage_findings for select to authenticated using (private.has_org_access(organization_id));
create policy damage_findings_insert_org on public.damage_findings for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy damage_findings_update_org on public.damage_findings for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer'])) with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));

create policy damage_evidence_select_org on public.damage_evidence for select to authenticated using (private.has_org_access(organization_id));
create policy damage_evidence_insert_org on public.damage_evidence for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy damage_evidence_delete_org on public.damage_evidence for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));

create policy ai_review_checks_select_org on public.ai_review_checks for select to authenticated using (private.has_org_access(organization_id));
create policy ai_review_checks_insert_org on public.ai_review_checks for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy ai_review_checks_update_org on public.ai_review_checks for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer'])) with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));

create policy knowledge_sources_select_scoped on public.knowledge_sources for select to authenticated using (private.can_access_knowledge(scope, organization_id, user_id));
create policy knowledge_sources_insert_user_org on public.knowledge_sources for insert to authenticated with check (
  (scope = 'user' and user_id = (select auth.uid()) and organization_id is not null and private.has_org_access(organization_id))
  or (scope = 'organization' and user_id is null and organization_id is not null and private.has_org_role(organization_id, array['owner','admin','manager']))
);
create policy knowledge_sources_update_user_org on public.knowledge_sources for update to authenticated using (
  (scope = 'user' and user_id = (select auth.uid()))
  or (scope = 'organization' and organization_id is not null and private.has_org_role(organization_id, array['owner','admin','manager']))
) with check (private.can_access_knowledge(scope, organization_id, user_id) and scope <> 'global');
create policy knowledge_sources_delete_user_org on public.knowledge_sources for delete to authenticated using (
  (scope = 'user' and user_id = (select auth.uid()))
  or (scope = 'organization' and organization_id is not null and private.has_org_role(organization_id, array['owner','admin','manager']))
);

create policy knowledge_documents_select_scoped on public.knowledge_documents for select to authenticated using (exists (select 1 from public.knowledge_sources s where s.id = source_id and private.can_access_knowledge(s.scope, s.organization_id, s.user_id)));
create policy knowledge_documents_insert_scoped on public.knowledge_documents for insert to authenticated with check (created_by = (select auth.uid()) and exists (select 1 from public.knowledge_sources s where s.id = source_id and s.organization_id = organization_id and private.can_access_knowledge(s.scope, s.organization_id, s.user_id) and s.scope <> 'global'));

create policy knowledge_chunks_select_scoped on public.knowledge_chunks for select to authenticated using (exists (select 1 from public.knowledge_sources s where s.id = source_id and private.can_access_knowledge(s.scope, s.organization_id, s.user_id)));

create policy learning_events_select_org on public.learning_events for select to authenticated using (private.has_org_access(organization_id));
create policy learning_events_insert_org on public.learning_events for insert to authenticated with check (user_id = (select auth.uid()) and private.has_org_access(organization_id));

create policy learning_candidates_select_org on public.learning_candidates for select to authenticated using (scope = 'global' or (organization_id is not null and private.has_org_access(organization_id)));
create policy learning_candidates_update_org on public.learning_candidates for update to authenticated using (scope = 'organization' and organization_id is not null and private.has_org_role(organization_id, array['owner','admin','manager'])) with check (scope = 'organization' and organization_id is not null and private.has_org_role(organization_id, array['owner','admin','manager']));

revoke all on table public.rules, public.rule_versions, public.ai_prompt_versions, public.ai_analysis_runs, public.damage_findings, public.damage_evidence, public.ai_review_checks, public.knowledge_sources, public.knowledge_documents, public.knowledge_chunks, public.learning_events, public.learning_candidates from anon, authenticated;
grant select, insert, update, delete on public.rules to authenticated;
grant select, insert on public.rule_versions to authenticated;
grant select, insert, update on public.ai_analysis_runs, public.damage_findings, public.ai_review_checks to authenticated;
grant select, insert, delete on public.damage_evidence to authenticated;
grant select, insert, update, delete on public.knowledge_sources to authenticated;
grant select, insert on public.knowledge_documents to authenticated;
grant select on public.knowledge_chunks to authenticated;
grant select, insert on public.learning_events to authenticated;
grant select, update on public.learning_candidates to authenticated;
grant all on public.rules, public.rule_versions, public.ai_prompt_versions, public.ai_analysis_runs, public.damage_findings, public.damage_evidence, public.ai_review_checks, public.knowledge_sources, public.knowledge_documents, public.knowledge_chunks, public.learning_events, public.learning_candidates to service_role;

create table public.report_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  report_type text not null check (report_type in ('insurance_estimate','customer_estimate','supplement','assessment','photo_report','parts_request','job_sheet')),
  header_text text,
  footer_text text,
  show_evidence_photos boolean not null default false,
  show_internal_notes boolean not null default false,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, report_type, name),
  unique (organization_id, id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  report_type text not null check (report_type in ('insurance_estimate','customer_estimate','supplement','assessment','photo_report','parts_request','job_sheet')),
  estimate_version_id uuid references public.estimate_versions(id),
  supplement_version_id uuid references public.supplement_versions(id),
  template_id uuid references public.report_templates(id) on delete set null,
  status text not null default 'draft' check (status in ('draft','generated','issued','superseded','failed')),
  title text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  check (not (estimate_version_id is not null and supplement_version_id is not null)),
  constraint reports_job_same_org_fk foreign key (organization_id, job_id)
    references public.jobs(organization_id, id) on delete cascade,
  constraint reports_estimate_version_same_org_fk foreign key (organization_id, estimate_version_id)
    references public.estimate_versions(organization_id, id),
  constraint reports_template_same_org_fk foreign key (organization_id, template_id)
    references public.report_templates(organization_id, id) on delete set null (template_id)
);

create table public.report_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  content_snapshot jsonb not null,
  storage_path text,
  mime_type text not null default 'application/pdf',
  sha256 text,
  generated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (report_id, version_number),
  unique (organization_id, id),
  constraint report_versions_report_same_org_fk foreign key (organization_id, report_id)
    references public.reports(organization_id, id) on delete cascade
);

create table public.outbound_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  channel text not null check (channel in ('email')),
  provider text not null default 'resend',
  recipient_to text[] not null default '{}',
  recipient_cc text[] not null default '{}',
  subject text not null,
  body_text text,
  body_html text,
  report_version_id uuid references public.report_versions(id),
  status text not null default 'draft' check (status in ('draft','queued','sent','delivered','failed','bounced')),
  provider_message_id text,
  error_message text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (organization_id, id),
  constraint outbound_messages_job_same_org_fk foreign key (organization_id, job_id)
    references public.jobs(organization_id, id) on delete cascade,
  constraint outbound_messages_report_version_same_org_fk foreign key (organization_id, report_version_id)
    references public.report_versions(organization_id, id)
);

create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  outbound_message_id uuid not null references public.outbound_messages(id) on delete cascade,
  provider_event_id text,
  event_type text not null,
  event_payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint email_events_message_same_org_fk foreign key (organization_id, outbound_message_id)
    references public.outbound_messages(organization_id, id) on delete cascade
);

create index report_templates_org_type_idx on public.report_templates(organization_id, report_type, is_active);
create index reports_job_idx on public.reports(job_id, created_at desc);
create index reports_org_job_idx on public.reports(organization_id, job_id);
create index reports_estimate_version_idx on public.reports(estimate_version_id);
create index reports_supplement_version_idx on public.reports(supplement_version_id);
create index reports_created_by_idx on public.reports(created_by);
create index report_versions_report_idx on public.report_versions(report_id, version_number desc);
create index report_versions_generated_by_idx on public.report_versions(generated_by);
create index outbound_messages_job_idx on public.outbound_messages(job_id, created_at desc);
create index outbound_messages_report_version_idx on public.outbound_messages(report_version_id);
create index outbound_messages_created_by_idx on public.outbound_messages(created_by);
create index email_events_message_idx on public.email_events(outbound_message_id, occurred_at desc);

create trigger report_templates_set_updated_at before update on public.report_templates for each row execute function private.set_updated_at();
create trigger reports_set_updated_at before update on public.reports for each row execute function private.set_updated_at();
create trigger report_versions_immutable before update or delete on public.report_versions
for each row execute function private.prevent_immutable_mutation();

alter table public.report_templates enable row level security;
alter table public.reports enable row level security;
alter table public.report_versions enable row level security;
alter table public.outbound_messages enable row level security;
alter table public.email_events enable row level security;

create policy report_templates_select_org on public.report_templates for select to authenticated using (private.has_org_access(organization_id));
create policy report_templates_insert_manager on public.report_templates for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','manager']));
create policy report_templates_update_manager on public.report_templates for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager'])) with check (private.has_org_role(organization_id, array['owner','admin','manager']));
create policy report_templates_delete_manager on public.report_templates for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager']));
create policy reports_select_org on public.reports for select to authenticated using (private.has_org_access(organization_id));
create policy reports_insert_estimator on public.reports for insert to authenticated with check (created_by = (select auth.uid()) and private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy reports_update_estimator on public.reports for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer'])) with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy report_versions_select_org on public.report_versions for select to authenticated using (private.has_org_access(organization_id));
create policy outbound_messages_select_org on public.outbound_messages for select to authenticated using (private.has_org_access(organization_id));
create policy outbound_messages_insert_estimator on public.outbound_messages for insert to authenticated with check (created_by = (select auth.uid()) and private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy outbound_messages_update_estimator on public.outbound_messages for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer'])) with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy email_events_select_org on public.email_events for select to authenticated using (private.has_org_access(organization_id));

revoke all on table public.report_templates, public.reports, public.report_versions, public.outbound_messages, public.email_events from anon, authenticated;
grant select, insert, update, delete on public.report_templates to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select on public.report_versions to authenticated;
grant select, insert, update on public.outbound_messages to authenticated;
grant select on public.email_events to authenticated;
grant all on public.report_templates, public.reports, public.report_versions, public.outbound_messages, public.email_events to service_role;

insert into public.report_templates (organization_id, name, report_type, is_default, is_active)
select o.id, 'Standard Insurance Estimate', 'insurance_estimate', true, true
from public.organizations o
where not exists (
  select 1 from public.report_templates rt where rt.organization_id = o.id and rt.report_type = 'insurance_estimate' and rt.is_default
);

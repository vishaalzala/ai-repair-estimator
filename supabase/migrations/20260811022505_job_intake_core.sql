create table public.organization_counters (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  next_job_number bigint not null default 1 check (next_job_number > 0)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_type text not null default 'individual' check (customer_type in ('individual','business')),
  first_name text,
  last_name text,
  business_name text,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postcode text,
  country_code char(2) not null default 'NZ',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (customer_type = 'business' and nullif(trim(coalesce(business_name,'')), '') is not null)
    or (customer_type = 'individual' and (nullif(trim(coalesce(first_name,'')), '') is not null or nullif(trim(coalesce(last_name,'')), '') is not null))
  )
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  registration text,
  vin text,
  make text,
  model text,
  variant text,
  model_year integer check (model_year is null or model_year between 1900 and 2100),
  colour text,
  paint_code text,
  odometer_km integer check (odometer_km is null or odometer_km >= 0),
  body_type text,
  vehicle_origin text,
  vehicle_size text,
  fuel_type text,
  is_ev boolean not null default false,
  is_hybrid boolean not null default false,
  adas_present boolean,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.insurers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  job_number text,
  status text not null default 'draft' check (status in (
    'draft','intake_complete','photos_required','ai_analysing','damage_review','estimating','awaiting_parts',
    'ai_review','ready_for_approval','approved','sent_to_insurer','awaiting_response','authorised',
    'revision_requested','supplement_required','completed','cancelled'
  )),
  repair_type text,
  repair_size text,
  work_source text,
  job_reference text,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, job_number)
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  insurer_id uuid references public.insurers(id) on delete set null,
  claim_number text,
  policy_number text,
  assessor_name text,
  assessor_email text,
  assessor_phone text,
  case_manager_name text,
  case_manager_email text,
  excess_amount numeric(12,2) check (excess_amount is null or excess_amount >= 0),
  accident_date date,
  accident_location text,
  accident_description text,
  authority_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.job_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  assignment_role text not null default 'estimator' check (assignment_role in ('estimator','reviewer','parts','technician')),
  created_at timestamptz not null default now(),
  unique (job_id, user_id, assignment_role)
);

create table public.job_status_history (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.job_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  note_type text not null default 'general' check (note_type in ('repair','general','insurer','technician','parts','supplement','internal','ai')),
  visibility text not null default 'internal' check (visibility in ('internal','insurer_pdf','technician_sheet','customer_output')),
  content text not null check (char_length(trim(content)) > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activity_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  title text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index customers_org_idx on public.customers(organization_id, created_at desc);
create index customers_org_email_idx on public.customers(organization_id, lower(email)) where email is not null;
create index vehicles_org_registration_idx on public.vehicles(organization_id, upper(registration)) where registration is not null;
create index vehicles_org_vin_idx on public.vehicles(organization_id, upper(vin)) where vin is not null;
create index insurers_org_idx on public.insurers(organization_id, name);
create index jobs_org_status_idx on public.jobs(organization_id, status, updated_at desc);
create index jobs_org_vehicle_idx on public.jobs(organization_id, vehicle_id);
create index jobs_org_customer_idx on public.jobs(organization_id, customer_id);
create index claims_org_claim_idx on public.claims(organization_id, claim_number) where claim_number is not null;
create index job_assignments_org_job_idx on public.job_assignments(organization_id, job_id);
create index job_status_history_job_idx on public.job_status_history(job_id, created_at desc);
create index job_notes_job_idx on public.job_notes(job_id, created_at desc);
create index activity_events_job_idx on public.activity_events(job_id, created_at desc);

create trigger customers_set_updated_at before update on public.customers
for each row execute function private.set_updated_at();
create trigger vehicles_set_updated_at before update on public.vehicles
for each row execute function private.set_updated_at();
create trigger insurers_set_updated_at before update on public.insurers
for each row execute function private.set_updated_at();
create trigger jobs_set_updated_at before update on public.jobs
for each row execute function private.set_updated_at();
create trigger claims_set_updated_at before update on public.claims
for each row execute function private.set_updated_at();
create trigger job_notes_set_updated_at before update on public.job_notes
for each row execute function private.set_updated_at();

create or replace function private.assign_job_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  n bigint;
begin
  if new.job_number is not null and trim(new.job_number) <> '' then
    return new;
  end if;

  insert into public.organization_counters (organization_id, next_job_number)
  values (new.organization_id, 1)
  on conflict (organization_id) do nothing;

  select next_job_number into n
  from public.organization_counters
  where organization_id = new.organization_id
  for update;

  update public.organization_counters
  set next_job_number = next_job_number + 1
  where organization_id = new.organization_id;

  new.job_number := 'J-' || to_char(now(), 'YYYY') || '-' || lpad(n::text, 5, '0');
  return new;
end;
$$;

create trigger jobs_assign_number
before insert on public.jobs
for each row execute function private.assign_job_number();

create or replace function private.record_job_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.job_status_history (organization_id, job_id, from_status, to_status, changed_by)
    values (new.organization_id, new.id, null, new.status, (select auth.uid()));
    insert into public.activity_events (organization_id, job_id, actor_user_id, event_type, title, details)
    values (new.organization_id, new.id, (select auth.uid()), 'job_created', 'Job created', jsonb_build_object('status', new.status, 'job_number', new.job_number));
  elsif new.status is distinct from old.status then
    insert into public.job_status_history (organization_id, job_id, from_status, to_status, changed_by)
    values (new.organization_id, new.id, old.status, new.status, (select auth.uid()));
    insert into public.activity_events (organization_id, job_id, actor_user_id, event_type, title, details)
    values (new.organization_id, new.id, (select auth.uid()), 'status_changed', 'Job status changed', jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return new;
end;
$$;

create trigger jobs_status_history_insert
after insert on public.jobs
for each row execute function private.record_job_status_change();
create trigger jobs_status_history_update
after update of status on public.jobs
for each row execute function private.record_job_status_change();

create or replace function private.bootstrap_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_members (organization_id, user_id, role, status)
  values (new.id, new.created_by, 'owner', 'active')
  on conflict (organization_id, user_id) do nothing;

  insert into public.workshop_settings (organization_id)
  values (new.id)
  on conflict (organization_id) do nothing;

  insert into public.organization_counters (organization_id, next_job_number)
  values (new.id, 1)
  on conflict (organization_id) do nothing;

  return new;
end;
$$;

alter table public.organization_counters enable row level security;
alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.insurers enable row level security;
alter table public.jobs enable row level security;
alter table public.claims enable row level security;
alter table public.job_assignments enable row level security;
alter table public.job_status_history enable row level security;
alter table public.job_notes enable row level security;
alter table public.activity_events enable row level security;

create policy customers_select_org on public.customers for select to authenticated using (private.has_org_access(organization_id));
create policy customers_insert_estimator on public.customers for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy customers_update_estimator on public.customers for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer'])) with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy customers_delete_manager on public.customers for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager']));

create policy vehicles_select_org on public.vehicles for select to authenticated using (private.has_org_access(organization_id));
create policy vehicles_insert_estimator on public.vehicles for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy vehicles_update_estimator on public.vehicles for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer'])) with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy vehicles_delete_manager on public.vehicles for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager']));

create policy insurers_select_org on public.insurers for select to authenticated using (private.has_org_access(organization_id));
create policy insurers_write_manager on public.insurers for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator']));
create policy insurers_update_manager on public.insurers for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','estimator'])) with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator']));
create policy insurers_delete_manager on public.insurers for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager']));

create policy jobs_select_org on public.jobs for select to authenticated using (private.has_org_access(organization_id));
create policy jobs_insert_estimator on public.jobs for insert to authenticated with check (created_by = (select auth.uid()) and private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy jobs_update_estimator on public.jobs for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer'])) with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy jobs_delete_manager on public.jobs for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager']));

create policy claims_select_org on public.claims for select to authenticated using (private.has_org_access(organization_id));
create policy claims_insert_estimator on public.claims for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy claims_update_estimator on public.claims for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer'])) with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy claims_delete_manager on public.claims for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager']));

create policy assignments_select_org on public.job_assignments for select to authenticated using (private.has_org_access(organization_id));
create policy assignments_write_manager on public.job_assignments for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','manager']));
create policy assignments_update_manager on public.job_assignments for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager'])) with check (private.has_org_role(organization_id, array['owner','admin','manager']));
create policy assignments_delete_manager on public.job_assignments for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager']));

create policy status_history_select_org on public.job_status_history for select to authenticated using (private.has_org_access(organization_id));

create policy notes_select_org on public.job_notes for select to authenticated using (private.has_org_access(organization_id));
create policy notes_insert_org on public.job_notes for insert to authenticated with check (created_by = (select auth.uid()) and private.has_org_access(organization_id));
create policy notes_update_own_or_manager on public.job_notes for update to authenticated using (created_by = (select auth.uid()) or private.has_org_role(organization_id, array['owner','admin','manager'])) with check (private.has_org_access(organization_id));
create policy notes_delete_own_or_manager on public.job_notes for delete to authenticated using (created_by = (select auth.uid()) or private.has_org_role(organization_id, array['owner','admin','manager']));

create policy activity_select_org on public.activity_events for select to authenticated using (private.has_org_access(organization_id));

revoke all on table public.organization_counters, public.customers, public.vehicles, public.insurers, public.jobs, public.claims, public.job_assignments, public.job_status_history, public.job_notes, public.activity_events from anon, authenticated;
grant select, insert, update, delete on public.customers, public.vehicles, public.insurers, public.jobs, public.claims, public.job_assignments, public.job_notes to authenticated;
grant select on public.job_status_history, public.activity_events to authenticated;
grant all on public.organization_counters, public.customers, public.vehicles, public.insurers, public.jobs, public.claims, public.job_assignments, public.job_status_history, public.job_notes, public.activity_events to service_role;
grant usage, select on sequence public.job_status_history_id_seq to service_role;
grant usage, select on sequence public.activity_events_id_seq to service_role;

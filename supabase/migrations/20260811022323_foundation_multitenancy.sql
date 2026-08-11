create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  timezone text not null default 'Pacific/Auckland',
  currency char(3) not null default 'NZD',
  country_code char(2) not null default 'NZ',
  status text not null default 'active' check (status in ('active','suspended','closed')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  region text,
  postcode text,
  country_code char(2) not null default 'NZ',
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'estimator' check (role in ('owner','admin','manager','estimator','reviewer','parts','technician','read_only')),
  status text not null default 'active' check (status in ('active','invited','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.workshop_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  gst_number text,
  gst_rate numeric(5,2) not null default 15.00 check (gst_rate >= 0 and gst_rate <= 100),
  default_estimate_valid_days integer not null default 30 check (default_estimate_valid_days between 1 and 365),
  default_currency char(3) not null default 'NZD',
  logo_path text,
  estimate_terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  reason text,
  request_id text,
  created_at timestamptz not null default now()
);

create index organization_members_user_idx on public.organization_members(user_id, organization_id) where status = 'active';
create index organization_members_org_idx on public.organization_members(organization_id, user_id);
create index branches_org_idx on public.branches(organization_id);
create index audit_logs_org_created_idx on public.audit_logs(organization_id, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.has_org_access(_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.organization_members m
      where m.organization_id = _organization_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
    );
$$;

create or replace function private.has_org_role(_organization_id uuid, _roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.organization_members m
      where m.organization_id = _organization_id
        and m.user_id = (select auth.uid())
        and m.status = 'active'
        and m.role = any(_roles)
    );
$$;

create or replace function private.try_uuid(_value text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return _value::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

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

  return new;
end;
$$;

revoke all on function private.has_org_access(uuid) from public;
revoke all on function private.has_org_role(uuid, text[]) from public;
revoke all on function private.try_uuid(text) from public;
grant execute on function private.has_org_access(uuid) to authenticated, service_role;
grant execute on function private.has_org_role(uuid, text[]) to authenticated, service_role;
grant execute on function private.try_uuid(text) to authenticated, service_role;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations
for each row execute function private.set_updated_at();
create trigger branches_set_updated_at before update on public.branches
for each row execute function private.set_updated_at();
create trigger organization_members_set_updated_at before update on public.organization_members
for each row execute function private.set_updated_at();
create trigger workshop_settings_set_updated_at before update on public.workshop_settings
for each row execute function private.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create trigger on_organization_created
after insert on public.organizations
for each row execute function private.bootstrap_organization();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.branches enable row level security;
alter table public.organization_members enable row level security;
alter table public.workshop_settings enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_self on public.profiles
for select to authenticated
using (id = (select auth.uid()));
create policy profiles_update_self on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy organizations_select_member on public.organizations
for select to authenticated
using (private.has_org_access(id));
create policy organizations_insert_self on public.organizations
for insert to authenticated
with check (created_by = (select auth.uid()));
create policy organizations_update_manager on public.organizations
for update to authenticated
using (private.has_org_role(id, array['owner','admin','manager']))
with check (private.has_org_role(id, array['owner','admin','manager']));
create policy organizations_delete_owner on public.organizations
for delete to authenticated
using (private.has_org_role(id, array['owner']));

create policy branches_select_member on public.branches
for select to authenticated
using (private.has_org_access(organization_id));
create policy branches_insert_manager on public.branches
for insert to authenticated
with check (private.has_org_role(organization_id, array['owner','admin','manager']));
create policy branches_update_manager on public.branches
for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','manager']))
with check (private.has_org_role(organization_id, array['owner','admin','manager']));
create policy branches_delete_manager on public.branches
for delete to authenticated
using (private.has_org_role(organization_id, array['owner','admin','manager']));

create policy members_select_org on public.organization_members
for select to authenticated
using (private.has_org_access(organization_id));
create policy members_insert_admin on public.organization_members
for insert to authenticated
with check (
  private.has_org_role(organization_id, array['owner','admin'])
  or exists (
    select 1 from public.organizations o
    where o.id = organization_id and o.created_by = (select auth.uid())
  )
);
create policy members_update_admin on public.organization_members
for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin']))
with check (private.has_org_role(organization_id, array['owner','admin']));
create policy members_delete_admin on public.organization_members
for delete to authenticated
using (private.has_org_role(organization_id, array['owner','admin']));

create policy settings_select_member on public.workshop_settings
for select to authenticated
using (private.has_org_access(organization_id));
create policy settings_update_manager on public.workshop_settings
for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','manager']))
with check (private.has_org_role(organization_id, array['owner','admin','manager']));

create policy audit_select_manager on public.audit_logs
for select to authenticated
using (organization_id is not null and private.has_org_role(organization_id, array['owner','admin','manager']));

revoke all on table public.profiles, public.organizations, public.branches, public.organization_members, public.workshop_settings, public.audit_logs from anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.organizations to authenticated;
grant select, insert, update, delete on public.branches to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, update on public.workshop_settings to authenticated;
grant select on public.audit_logs to authenticated;
grant all on public.profiles, public.organizations, public.branches, public.organization_members, public.workshop_settings, public.audit_logs to service_role;
grant usage, select on sequence public.audit_logs_id_seq to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('job-files', 'job-files', false, 26214400, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('knowledge-documents', 'knowledge-documents', false, 52428800, array['application/pdf','text/plain','text/markdown','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy storage_org_select on storage.objects
for select to authenticated
using (
  bucket_id in ('job-files','knowledge-documents')
  and private.has_org_access(private.try_uuid((storage.foldername(name))[1]))
);
create policy storage_org_insert on storage.objects
for insert to authenticated
with check (
  bucket_id in ('job-files','knowledge-documents')
  and private.has_org_access(private.try_uuid((storage.foldername(name))[1]))
);
create policy storage_org_update on storage.objects
for update to authenticated
using (
  bucket_id in ('job-files','knowledge-documents')
  and private.has_org_access(private.try_uuid((storage.foldername(name))[1]))
)
with check (
  bucket_id in ('job-files','knowledge-documents')
  and private.has_org_access(private.try_uuid((storage.foldername(name))[1]))
);
create policy storage_org_delete on storage.objects
for delete to authenticated
using (
  bucket_id in ('job-files','knowledge-documents')
  and private.has_org_access(private.try_uuid((storage.foldername(name))[1]))
);

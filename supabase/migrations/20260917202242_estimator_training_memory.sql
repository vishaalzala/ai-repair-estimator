create table if not exists public.estimator_training_cases (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'global' check (scope in ('global','organization')),
  organization_id uuid references public.organizations(id) on delete cascade,
  title text not null,
  source_type text not null default 'approved_estimate',
  source_reference text,
  source_document_name text,
  source_photo_archive_name text,
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  vehicle_make text,
  vehicle_model text,
  vehicle_variant text,
  vehicle_year integer check (vehicle_year is null or vehicle_year between 1900 and 2100),
  body_type text,
  fuel_type text,
  colour text,
  repair_area text,
  damage_summary text not null,
  damage_tags text[] not null default '{}',
  estimator_lessons text,
  photo_count integer not null default 0 check (photo_count >= 0),
  photo_manifest jsonb not null default '[]'::jsonb,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists estimator_training_cases_source_reference_uq
  on public.estimator_training_cases(source_reference)
  where source_reference is not null;
create index if not exists estimator_training_cases_vehicle_idx
  on public.estimator_training_cases(status, lower(vehicle_make), lower(vehicle_model), vehicle_year);
create index if not exists estimator_training_cases_damage_tags_idx
  on public.estimator_training_cases using gin(damage_tags);

create table if not exists public.estimator_training_lines (
  id uuid primary key default gen_random_uuid(),
  training_case_id uuid not null references public.estimator_training_cases(id) on delete cascade,
  sort_order integer not null default 0,
  category_code text not null,
  side text,
  operation_code text,
  description text not null,
  labour_hours numeric(8,2),
  approved_amount numeric(12,2),
  blend_selected boolean not null default false,
  report_selected boolean not null default false,
  pricing_status text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists estimator_training_lines_case_idx
  on public.estimator_training_lines(training_case_id, sort_order);

alter table public.estimator_training_cases enable row level security;
alter table public.estimator_training_lines enable row level security;

revoke all on public.estimator_training_cases from anon;
revoke all on public.estimator_training_lines from anon;
grant select, insert, update, delete on public.estimator_training_cases to authenticated, service_role;
grant select, insert, update, delete on public.estimator_training_lines to authenticated, service_role;

create policy "Approved training cases are readable by authenticated users"
on public.estimator_training_cases for select to authenticated
using (
  (select public.is_platform_admin())
  or (
    status = 'approved'
    and (
      scope = 'global'
      or organization_id in (
        select om.organization_id
        from public.organization_members om
        where om.user_id = (select auth.uid()) and om.status = 'active'
      )
    )
  )
);

create policy "Platform admins manage training cases"
on public.estimator_training_cases for all to authenticated
using ((select public.is_platform_admin()))
with check ((select public.is_platform_admin()));

create policy "Approved training lines are readable by authenticated users"
on public.estimator_training_lines for select to authenticated
using (
  (select public.is_platform_admin())
  or exists (
    select 1
    from public.estimator_training_cases c
    where c.id = estimator_training_lines.training_case_id
      and c.status = 'approved'
      and (
        c.scope = 'global'
        or c.organization_id in (
          select om.organization_id
          from public.organization_members om
          where om.user_id = (select auth.uid()) and om.status = 'active'
        )
      )
  )
);

create policy "Platform admins manage training lines"
on public.estimator_training_lines for all to authenticated
using ((select public.is_platform_admin()))
with check ((select public.is_platform_admin()));

comment on table public.estimator_training_cases is 'Human-approved estimator memory cases. Cases guide future AI estimates but do not override current photo evidence or workshop rates.';
comment on column public.estimator_training_cases.estimator_lessons is 'Reusable estimating lessons learned from this approved case; do not treat historical prices as current pricing.';

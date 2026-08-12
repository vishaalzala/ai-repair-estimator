-- Daily Jobs command centre
-- Native workflow state remains in existing module tables.
-- These tables only store planning metadata and standalone workshop tasks.

create table if not exists public.job_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  scheduled_date date,
  due_at timestamptz,
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  is_completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, job_id),
  constraint job_schedules_job_same_org_fk foreign key (organization_id, job_id)
    references public.jobs(organization_id, id) on delete cascade
);

create index if not exists job_schedules_org_date_idx on public.job_schedules(organization_id, scheduled_date);
create index if not exists job_schedules_org_due_idx on public.job_schedules(organization_id, due_at);
create index if not exists job_schedules_job_idx on public.job_schedules(job_id);

create table if not exists public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  notes text,
  category text not null default 'general' check (category in ('general','customer','insurer','parts','estimate','photos','admin','workshop','other')),
  status text not null default 'todo' check (status in ('todo','in_progress','waiting','done','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  assigned_to uuid references auth.users(id) on delete set null,
  due_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_tasks_job_same_org_fk foreign key (organization_id, job_id)
    references public.jobs(organization_id, id) on delete cascade,
  constraint daily_tasks_assigned_member_fk foreign key (organization_id, assigned_to)
    references public.organization_members(organization_id, user_id)
);

create index if not exists daily_tasks_org_due_idx on public.daily_tasks(organization_id, due_at);
create index if not exists daily_tasks_org_status_idx on public.daily_tasks(organization_id, status);
create index if not exists daily_tasks_job_idx on public.daily_tasks(job_id);
create index if not exists daily_tasks_assigned_idx on public.daily_tasks(organization_id, assigned_to);

alter table public.job_schedules enable row level security;
alter table public.daily_tasks enable row level security;

drop policy if exists job_schedules_select_org on public.job_schedules;
create policy job_schedules_select_org on public.job_schedules for select to authenticated
using (private.has_org_access(organization_id));

drop policy if exists job_schedules_insert_org on public.job_schedules;
create policy job_schedules_insert_org on public.job_schedules for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer','parts','technician']::text[])
);

drop policy if exists job_schedules_update_org on public.job_schedules;
create policy job_schedules_update_org on public.job_schedules for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer','parts','technician']::text[]))
with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer','parts','technician']::text[]));

drop policy if exists job_schedules_delete_manager on public.job_schedules;
create policy job_schedules_delete_manager on public.job_schedules for delete to authenticated
using (private.has_org_role(organization_id, array['owner','admin','manager']::text[]));

drop policy if exists daily_tasks_select_org on public.daily_tasks;
create policy daily_tasks_select_org on public.daily_tasks for select to authenticated
using (private.has_org_access(organization_id));

drop policy if exists daily_tasks_insert_org on public.daily_tasks;
create policy daily_tasks_insert_org on public.daily_tasks for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer','parts','technician']::text[])
  and (assigned_to is null or exists (
    select 1 from public.organization_members m
    where m.organization_id = daily_tasks.organization_id
      and m.user_id = daily_tasks.assigned_to
      and m.status = 'active'
  ))
);

drop policy if exists daily_tasks_update_org on public.daily_tasks;
create policy daily_tasks_update_org on public.daily_tasks for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer','parts','technician']::text[]))
with check (
  private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer','parts','technician']::text[])
  and (assigned_to is null or exists (
    select 1 from public.organization_members m
    where m.organization_id = daily_tasks.organization_id
      and m.user_id = daily_tasks.assigned_to
      and m.status = 'active'
  ))
);

drop policy if exists daily_tasks_delete_own_or_manager on public.daily_tasks;
create policy daily_tasks_delete_own_or_manager on public.daily_tasks for delete to authenticated
using (
  created_by = (select auth.uid())
  or private.has_org_role(organization_id, array['owner','admin','manager']::text[])
);

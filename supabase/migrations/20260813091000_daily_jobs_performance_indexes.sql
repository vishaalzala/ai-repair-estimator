-- Cover Daily Jobs foreign keys identified by the Supabase performance advisor.
create index if not exists daily_tasks_assigned_to_idx on public.daily_tasks(assigned_to);
create index if not exists daily_tasks_completed_by_idx on public.daily_tasks(completed_by);
create index if not exists daily_tasks_created_by_idx on public.daily_tasks(created_by);
create index if not exists daily_tasks_org_job_idx on public.daily_tasks(organization_id, job_id);
create index if not exists job_schedules_completed_by_idx on public.job_schedules(completed_by);
create index if not exists job_schedules_created_by_idx on public.job_schedules(created_by);

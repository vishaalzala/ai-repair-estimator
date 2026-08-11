create table public.photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  category text not null default 'accident_damage' check (category in (
    'identification','accident_damage','pre_existing','hidden_damage','extra_damage',
    'strip_down','progress','parts','completed','document'
  )),
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0),
  storage_path_original text not null,
  storage_path_optimized text,
  storage_path_thumbnail text,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  sha256 text,
  caption text,
  captured_at timestamptz,
  sort_order integer not null default 0,
  processing_status text not null default 'pending' check (processing_status in ('pending','ready','failed')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, storage_path_original),
  constraint photos_job_same_org_fk foreign key (organization_id, job_id)
    references public.jobs(organization_id, id) on delete cascade
);

create index photos_job_category_idx on public.photos(job_id, category, sort_order, created_at);
create index photos_org_created_idx on public.photos(organization_id, created_at desc);
create index photos_created_by_idx on public.photos(created_by);

create trigger photos_set_updated_at before update on public.photos
for each row execute function private.set_updated_at();

alter table public.photos enable row level security;

create policy photos_select_org on public.photos
for select to authenticated
using (private.has_org_access(organization_id));

create policy photos_insert_org on public.photos
for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer','technician','parts'])
);

create policy photos_update_org on public.photos
for update to authenticated
using (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer','technician']))
with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer','technician']));

create policy photos_delete_org on public.photos
for delete to authenticated
using (
  created_by = (select auth.uid())
  or private.has_org_role(organization_id, array['owner','admin','manager'])
);

revoke all on table public.photos from anon, authenticated;
grant select, insert, update, delete on public.photos to authenticated;
grant all on public.photos to service_role;

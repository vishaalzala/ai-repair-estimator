create policy report_versions_insert_estimator on public.report_versions
for insert to authenticated
with check (
  generated_by = (select auth.uid())
  and private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer'])
  and exists (
    select 1 from public.reports r
    where r.id = report_id and r.organization_id = organization_id
  )
);

grant insert on public.report_versions to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-files', 'report-files', false, 15728640, array['application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy report_files_select_org on storage.objects
for select to authenticated
using (
  bucket_id = 'report-files'
  and private.try_uuid((storage.foldername(name))[1]) is not null
  and private.has_org_access(private.try_uuid((storage.foldername(name))[1]))
);

create policy report_files_insert_org on storage.objects
for insert to authenticated
with check (
  bucket_id = 'report-files'
  and private.try_uuid((storage.foldername(name))[1]) is not null
  and private.has_org_role(private.try_uuid((storage.foldername(name))[1]), array['owner','admin','manager','estimator','reviewer'])
);

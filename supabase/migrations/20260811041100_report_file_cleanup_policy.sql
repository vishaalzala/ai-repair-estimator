create policy report_files_delete_org on storage.objects
for delete to authenticated
using (
  bucket_id = 'report-files'
  and private.try_uuid((storage.foldername(name))[1]) is not null
  and private.has_org_role(private.try_uuid((storage.foldername(name))[1]), array['owner','admin','manager','estimator','reviewer'])
);

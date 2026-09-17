alter table public.estimator_training_cases
  add column if not exists insurer_name text,
  add column if not exists source_document_storage_path text,
  add column if not exists source_document_mime_type text,
  add column if not exists source_photo_archive_storage_path text,
  add column if not exists ingestion_status text not null default 'ready',
  add column if not exists ingestion_error text,
  add column if not exists ingestion_metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'estimator_training_cases_ingestion_status_check'
      and conrelid = 'public.estimator_training_cases'::regclass
  ) then
    alter table public.estimator_training_cases
      add constraint estimator_training_cases_ingestion_status_check
      check (ingestion_status in ('pending','processing','ready','failed'));
  end if;
end $$;

create index if not exists estimator_training_cases_ingestion_idx
  on public.estimator_training_cases(ingestion_status, updated_at desc);

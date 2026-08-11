alter table public.job_notes
  add column if not exists note_type text not null default 'general',
  add column if not exists visibility text not null default 'internal',
  add column if not exists content text,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.job_notes add constraint job_notes_note_type_check check (note_type in ('repair','general','insurer','technician','parts','supplement','internal','ai'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.job_notes add constraint job_notes_visibility_check check (visibility in ('internal','insurer_pdf','technician_sheet','customer_output'));
exception when duplicate_object then null; end $$;

create index if not exists job_notes_org_job_type_idx on public.job_notes(organization_id, job_id, note_type, created_at desc);
create trigger job_notes_set_updated_at before update on public.job_notes for each row execute function private.set_updated_at();

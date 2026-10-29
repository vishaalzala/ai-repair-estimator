alter table public.jobs
  add column if not exists quote_status text not null default 'awaiting_quoting',
  add column if not exists repair_status text not null default 'not_started';

alter table public.jobs
  add constraint jobs_quote_status_check check (quote_status in (
    'awaiting_quoting','quoting_underway','quote_complete',
    'awaiting_authorisation','on_hold','authorised','declined'
  ));
alter table public.jobs
  add constraint jobs_repair_status_check check (repair_status in (
    'not_started','repair_underway','awaiting_parts','outwork',
    'quality_check','repair_complete','delivered'
  ));
update public.jobs
set quote_status = case
    when status in ('estimating','damage_review','ai_review') then 'quoting_underway'
    when status = 'ready_for_approval' then 'quote_complete'
    when status in ('approved','sent_to_insurer','awaiting_response') then 'awaiting_authorisation'
    when status in ('authorised','completed') then 'authorised'
    when status = 'cancelled' then 'declined'
    else 'awaiting_quoting'
  end,
  repair_status = case
    when status = 'completed' then 'repair_complete'
    when status = 'awaiting_parts' then 'awaiting_parts'
    else 'not_started'
  end;
create index if not exists jobs_org_quote_status_idx on public.jobs(organization_id,quote_status,updated_at desc);
create index if not exists jobs_org_repair_status_idx on public.jobs(organization_id,repair_status,updated_at desc);

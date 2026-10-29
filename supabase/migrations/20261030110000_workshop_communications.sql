-- Tenant-scoped outbound communications. Transport credentials stay server-only.
create table if not exists public.workshop_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  channel text not null check (channel in ('sms','email')),
  recipient text not null,
  subject text,
  body text not null,
  status text not null default 'processing' check (status in ('processing','sent','failed')),
  provider text not null check (provider in ('twilio','resend')),
  provider_message_id text,
  provider_error text,
  idempotency_key uuid not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (organization_id, idempotency_key),
  check (char_length(body) between 1 and 5000)
);
create index if not exists workshop_messages_org_created_idx on public.workshop_messages(organization_id, created_at desc);
create index if not exists workshop_messages_org_job_idx on public.workshop_messages(organization_id, job_id, created_at desc);
create index if not exists workshop_messages_org_customer_idx on public.workshop_messages(organization_id, customer_id, created_at desc);
alter table public.workshop_messages enable row level security;
create policy workshop_messages_read on public.workshop_messages for select to authenticated
  using (private.has_org_access(organization_id));
create policy workshop_messages_insert on public.workshop_messages for insert to authenticated
  with check (private.has_org_role(organization_id,array['owner','admin','manager','estimator','reviewer'])
    and created_by=auth.uid()
    and (job_id is null or exists(select 1 from public.jobs j where j.id=job_id and j.organization_id=workshop_messages.organization_id))
    and (customer_id is null or exists(select 1 from public.customers c where c.id=customer_id and c.organization_id=workshop_messages.organization_id))
    and (job_id is null or customer_id is null or exists (select 1 from public.jobs j where j.id=job_id and j.customer_id=customer_id and j.organization_id=workshop_messages.organization_id)));
create policy workshop_messages_update on public.workshop_messages for update to authenticated
  using (private.has_org_role(organization_id,array['owner','admin','manager','estimator','reviewer']) and created_by=auth.uid())
  with check (private.has_org_role(organization_id,array['owner','admin','manager','estimator','reviewer']) and created_by=auth.uid()
    and (job_id is null or exists(select 1 from public.jobs j where j.id=job_id and j.organization_id=workshop_messages.organization_id))
    and (customer_id is null or exists(select 1 from public.customers c where c.id=customer_id and c.organization_id=workshop_messages.organization_id)));

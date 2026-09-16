-- Super Admin, SaaS plans, AI cost metering and Stripe-ready billing foundation.

create table if not exists public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'super_admin' check (role in ('super_admin','admin','support','billing_admin','ai_admin')),
  status text not null default 'active' check (status in ('active','disabled')),
  mfa_required boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_platform_admin(check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.platform_admins pa where pa.user_id=check_user_id and pa.status='active');
$$;
grant execute on function public.is_platform_admin(uuid) to authenticated;

alter table public.platform_admins enable row level security;
drop policy if exists platform_admins_self_read on public.platform_admins;
create policy platform_admins_self_read on public.platform_admins for select to authenticated using (user_id=auth.uid() or public.is_platform_admin());
drop policy if exists platform_admins_self_update on public.platform_admins;
create policy platform_admins_self_update on public.platform_admins for update to authenticated using (user_id=auth.uid() or public.is_platform_admin()) with check (user_id=auth.uid() or public.is_platform_admin());

-- Initial platform owner for the current installation.
insert into public.platform_admins (user_id,role,status,mfa_required)
select id,'super_admin','active',true from auth.users where lower(email)='vishaalzala@gmail.com'
on conflict (user_id) do update set role='super_admin',status='active',updated_at=now();

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  monthly_price_nzd numeric(12,2) not null default 9.99 check(monthly_price_nzd>=0),
  ai_markup_percent numeric(8,4) not null default 10 check(ai_markup_percent>=0),
  minimum_estimate_charge_nzd numeric(12,2) not null default 0 check(minimum_estimate_charge_nzd>=0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.plans(code,name,description,monthly_price_nzd,ai_markup_percent,minimum_estimate_charge_nzd,active)
values('starter','RepairQuote AI Starter','NZ$9.99/month plus AI usage charged at provider cost + 10%.',9.99,10,0,true)
on conflict(code) do update set name=excluded.name,description=excluded.description,monthly_price_nzd=excluded.monthly_price_nzd,ai_markup_percent=excluded.ai_markup_percent,updated_at=now();

create table if not exists public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.plans(id),
  status text not null default 'trialing' check(status in ('trialing','active','past_due','canceled','paused')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.organization_subscriptions(organization_id,plan_id,status)
select o.id,p.id,'trialing' from public.organizations o cross join public.plans p where p.code='starter'
on conflict(organization_id) do nothing;

create table if not exists public.ai_model_prices (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'openai',
  model text not null,
  input_usd_per_million numeric(14,6) not null,
  cached_input_usd_per_million numeric(14,6) not null default 0,
  output_usd_per_million numeric(14,6) not null,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(provider,model,effective_from)
);
insert into public.ai_model_prices(provider,model,input_usd_per_million,cached_input_usd_per_million,output_usd_per_million,effective_from,active) values
('openai','gpt-5.6-sol',4.00,0.40,20.00,'2026-08-21T00:00:00Z',true),
('openai','gpt-5.6-terra',2.00,0.20,12.00,'2026-07-30T00:00:00Z',true),
('openai','gpt-5.6-luna',0.20,0.02,1.20,'2026-07-30T00:00:00Z',true)
on conflict do nothing;

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.platform_settings(key,value) values
('billing_currency','"NZD"'::jsonb),('usd_to_nzd_rate','1.70'::jsonb),('ai_markup_percent','10'::jsonb)
on conflict(key) do nothing;

create table if not exists public.ai_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  estimate_id uuid references public.estimates(id) on delete set null,
  ai_run_id uuid not null unique references public.ai_analysis_runs(id) on delete cascade,
  provider text not null,
  model text not null,
  input_tokens integer not null default 0,
  cached_input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  provider_cost_usd numeric(16,8) not null default 0,
  fx_rate_usd_nzd numeric(16,8) not null default 1,
  provider_cost_nzd numeric(16,8) not null default 0,
  markup_percent numeric(8,4) not null default 10,
  markup_amount_nzd numeric(16,8) not null default 0,
  customer_charge_nzd numeric(16,8) not null default 0,
  billing_status text not null default 'unbilled' check(billing_status in ('unbilled','pending_invoice','billed','waived')),
  stripe_invoice_item_id text,
  billed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_ledger_org_created_idx on public.ai_usage_ledger(organization_id,created_at desc);
create index if not exists ai_usage_ledger_job_idx on public.ai_usage_ledger(job_id);

create table if not exists public.estimate_ai_charges (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null unique references public.jobs(id) on delete cascade,
  estimate_id uuid references public.estimates(id) on delete set null,
  provider_cost_usd numeric(16,8) not null default 0,
  provider_cost_nzd numeric(16,8) not null default 0,
  markup_percent numeric(8,4) not null default 10,
  markup_amount_nzd numeric(16,8) not null default 0,
  customer_charge_nzd numeric(16,8) not null default 0,
  status text not null default 'unbilled' check(status in ('unbilled','pending_invoice','billed','waived')),
  stripe_invoice_item_id text,
  finalized_at timestamptz,
  billed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.admin_user_directory()
returns table(user_id uuid,email text,full_name text,phone text,created_at timestamptz,last_sign_in_at timestamptz,organizations_count bigint,roles text)
language plpgsql security definer set search_path=public,auth as $$
begin
  if not public.is_platform_admin(auth.uid()) then raise exception 'platform admin required'; end if;
  return query
  select u.id,u.email::text,p.full_name,p.phone,u.created_at,u.last_sign_in_at,
    (select count(*) from public.organization_members om where om.user_id=u.id and om.status='active')::bigint,
    coalesce((select string_agg(distinct om.role,', ' order by om.role) from public.organization_members om where om.user_id=u.id and om.status='active'),'')
  from auth.users u left join public.profiles p on p.id=u.id order by u.created_at desc;
end;$$;
grant execute on function public.admin_user_directory() to authenticated;

alter table public.plans enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.ai_model_prices enable row level security;
alter table public.platform_settings enable row level security;
alter table public.ai_usage_ledger enable row level security;
alter table public.estimate_ai_charges enable row level security;
alter table public.platform_audit_logs enable row level security;

drop policy if exists plans_authenticated_read on public.plans;
create policy plans_authenticated_read on public.plans for select to authenticated using(active or public.is_platform_admin());
drop policy if exists plans_admin_write on public.plans;
create policy plans_admin_write on public.plans for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());

drop policy if exists subscriptions_member_read on public.organization_subscriptions;
create policy subscriptions_member_read on public.organization_subscriptions for select to authenticated using(public.is_platform_admin() or exists(select 1 from public.organization_members om where om.organization_id=organization_subscriptions.organization_id and om.user_id=auth.uid() and om.status='active'));
drop policy if exists subscriptions_admin_write on public.organization_subscriptions;
create policy subscriptions_admin_write on public.organization_subscriptions for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());

drop policy if exists model_prices_admin_all on public.ai_model_prices;
create policy model_prices_admin_all on public.ai_model_prices for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
drop policy if exists model_prices_authenticated_read on public.ai_model_prices;
create policy model_prices_authenticated_read on public.ai_model_prices for select to authenticated using(active or public.is_platform_admin());

drop policy if exists platform_settings_admin_all on public.platform_settings;
create policy platform_settings_admin_all on public.platform_settings for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
drop policy if exists platform_settings_authenticated_read on public.platform_settings;
create policy platform_settings_authenticated_read on public.platform_settings for select to authenticated using(key in ('billing_currency','usd_to_nzd_rate','ai_markup_percent'));

drop policy if exists usage_member_read on public.ai_usage_ledger;
create policy usage_member_read on public.ai_usage_ledger for select to authenticated using(public.is_platform_admin() or exists(select 1 from public.organization_members om where om.organization_id=ai_usage_ledger.organization_id and om.user_id=auth.uid() and om.status='active' and om.role in ('owner','admin','manager')));
drop policy if exists usage_member_insert on public.ai_usage_ledger;
create policy usage_member_insert on public.ai_usage_ledger for insert to authenticated with check(public.is_platform_admin() or exists(select 1 from public.organization_members om where om.organization_id=ai_usage_ledger.organization_id and om.user_id=auth.uid() and om.status='active'));
drop policy if exists usage_member_update on public.ai_usage_ledger;
create policy usage_member_update on public.ai_usage_ledger for update to authenticated using(public.is_platform_admin() or exists(select 1 from public.organization_members om where om.organization_id=ai_usage_ledger.organization_id and om.user_id=auth.uid() and om.status='active')) with check(public.is_platform_admin() or exists(select 1 from public.organization_members om where om.organization_id=ai_usage_ledger.organization_id and om.user_id=auth.uid() and om.status='active'));

drop policy if exists estimate_charges_member_read on public.estimate_ai_charges;
create policy estimate_charges_member_read on public.estimate_ai_charges for select to authenticated using(public.is_platform_admin() or exists(select 1 from public.organization_members om where om.organization_id=estimate_ai_charges.organization_id and om.user_id=auth.uid() and om.status='active' and om.role in ('owner','admin','manager')));
drop policy if exists estimate_charges_member_write on public.estimate_ai_charges;
create policy estimate_charges_member_write on public.estimate_ai_charges for all to authenticated using(public.is_platform_admin() or exists(select 1 from public.organization_members om where om.organization_id=estimate_ai_charges.organization_id and om.user_id=auth.uid() and om.status='active')) with check(public.is_platform_admin() or exists(select 1 from public.organization_members om where om.organization_id=estimate_ai_charges.organization_id and om.user_id=auth.uid() and om.status='active'));

drop policy if exists platform_audit_admin on public.platform_audit_logs;
create policy platform_audit_admin on public.platform_audit_logs for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());

-- Platform administrator cross-tenant read access.
drop policy if exists platform_admin_read_organizations on public.organizations;
create policy platform_admin_read_organizations on public.organizations for select to authenticated using(public.is_platform_admin());
drop policy if exists platform_admin_read_members on public.organization_members;
create policy platform_admin_read_members on public.organization_members for select to authenticated using(public.is_platform_admin());
drop policy if exists platform_admin_read_profiles on public.profiles;
create policy platform_admin_read_profiles on public.profiles for select to authenticated using(public.is_platform_admin());
drop policy if exists platform_admin_read_jobs on public.jobs;
create policy platform_admin_read_jobs on public.jobs for select to authenticated using(public.is_platform_admin());
drop policy if exists platform_admin_read_estimates on public.estimates;
create policy platform_admin_read_estimates on public.estimates for select to authenticated using(public.is_platform_admin());
drop policy if exists platform_admin_read_estimate_items on public.estimate_items;
create policy platform_admin_read_estimate_items on public.estimate_items for select to authenticated using(public.is_platform_admin());
drop policy if exists platform_admin_read_ai_runs on public.ai_analysis_runs;
create policy platform_admin_read_ai_runs on public.ai_analysis_runs for select to authenticated using(public.is_platform_admin());
drop policy if exists platform_admin_knowledge_all on public.knowledge_sources;
create policy platform_admin_knowledge_all on public.knowledge_sources for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
drop policy if exists platform_admin_learning_all on public.learning_candidates;
create policy platform_admin_learning_all on public.learning_candidates for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
drop policy if exists platform_admin_audit_read on public.audit_logs;
create policy platform_admin_audit_read on public.audit_logs for select to authenticated using(public.is_platform_admin());
drop policy if exists platform_admin_knowledge_documents_all on public.knowledge_documents;
create policy platform_admin_knowledge_documents_all on public.knowledge_documents for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
drop policy if exists platform_admin_knowledge_chunks_all on public.knowledge_chunks;
create policy platform_admin_knowledge_chunks_all on public.knowledge_chunks for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());

drop policy if exists platform_admin_knowledge_storage_select on storage.objects;
create policy platform_admin_knowledge_storage_select on storage.objects for select to authenticated using(bucket_id='knowledge-documents' and public.is_platform_admin());
drop policy if exists platform_admin_knowledge_storage_insert on storage.objects;
create policy platform_admin_knowledge_storage_insert on storage.objects for insert to authenticated with check(bucket_id='knowledge-documents' and public.is_platform_admin());
drop policy if exists platform_admin_knowledge_storage_update on storage.objects;
create policy platform_admin_knowledge_storage_update on storage.objects for update to authenticated using(bucket_id='knowledge-documents' and public.is_platform_admin()) with check(bucket_id='knowledge-documents' and public.is_platform_admin());
drop policy if exists platform_admin_knowledge_storage_delete on storage.objects;
create policy platform_admin_knowledge_storage_delete on storage.objects for delete to authenticated using(bucket_id='knowledge-documents' and public.is_platform_admin());

create table public.estimate_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  reason text not null default 'manual_snapshot' check (reason in ('manual_snapshot','approval','issued','revision','supplement_base')),
  status_snapshot text not null,
  currency char(3) not null,
  tax_rate numeric(5,2) not null,
  subtotal_ex_tax numeric(12,2) not null,
  tax_amount numeric(12,2) not null,
  total_inc_tax numeric(12,2) not null,
  category_totals jsonb not null default '{}'::jsonb,
  rate_card_snapshot jsonb not null default '{}'::jsonb,
  pricing_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (estimate_id, version_number),
  unique (organization_id, id),
  constraint estimate_versions_estimate_same_org_fk foreign key (organization_id, estimate_id)
    references public.estimates(organization_id, id) on delete cascade,
  constraint estimate_versions_job_same_org_fk foreign key (organization_id, job_id)
    references public.jobs(organization_id, id) on delete cascade
);

create table public.estimate_version_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  estimate_version_id uuid not null references public.estimate_versions(id) on delete cascade,
  original_item_id uuid,
  category_code text not null,
  category_name text not null,
  component text,
  side text,
  operation_code text,
  description text not null,
  quantity numeric(10,2) not null,
  labour_hours numeric(10,2) not null,
  labour_rate numeric(12,2) not null,
  fixed_amount numeric(12,2) not null,
  part_cost numeric(12,2) not null,
  markup_percent numeric(8,3) not null,
  freight_amount numeric(12,2) not null,
  adjustment_amount numeric(12,2) not null,
  line_total_ex_tax numeric(12,2) not null,
  source_type text not null,
  source_ref text,
  notes text,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  constraint estimate_version_items_version_same_org_fk foreign key (organization_id, estimate_version_id)
    references public.estimate_versions(organization_id, id) on delete cascade
);

create table public.supplements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  base_estimate_version_id uuid not null references public.estimate_versions(id),
  supplement_number integer not null check (supplement_number > 0),
  status text not null default 'draft' check (status in ('draft','ready_for_approval','approved','issued','cancelled')),
  reason text,
  currency char(3) not null default 'NZD',
  tax_rate numeric(5,2) not null default 15.00,
  created_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, supplement_number),
  unique (organization_id, id),
  constraint supplements_job_same_org_fk foreign key (organization_id, job_id)
    references public.jobs(organization_id, id) on delete cascade,
  constraint supplements_base_version_same_org_fk foreign key (organization_id, base_estimate_version_id)
    references public.estimate_versions(organization_id, id)
);

create table public.supplement_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplement_id uuid not null references public.supplements(id) on delete cascade,
  category_id uuid not null references public.estimate_categories(id),
  component text,
  side text,
  operation_code text,
  description text not null,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  labour_hours numeric(10,2) not null default 0 check (labour_hours >= 0),
  labour_rate numeric(12,2) not null default 0 check (labour_rate >= 0),
  fixed_amount numeric(12,2) not null default 0,
  part_cost numeric(12,2) not null default 0 check (part_cost >= 0),
  markup_percent numeric(8,3) not null default 0 check (markup_percent >= 0),
  freight_amount numeric(12,2) not null default 0 check (freight_amount >= 0),
  adjustment_amount numeric(12,2) not null default 0,
  line_total_ex_tax numeric(12,2) not null default 0,
  source_type text not null default 'supplement',
  notes text,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint supplement_items_supplement_same_org_fk foreign key (organization_id, supplement_id)
    references public.supplements(organization_id, id) on delete cascade,
  constraint supplement_items_category_same_org_fk foreign key (organization_id, category_id)
    references public.estimate_categories(organization_id, id)
);

create table public.supplement_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplement_id uuid not null references public.supplements(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status_snapshot text not null,
  subtotal_ex_tax numeric(12,2) not null,
  tax_amount numeric(12,2) not null,
  total_inc_tax numeric(12,2) not null,
  items_snapshot jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (supplement_id, version_number),
  unique (organization_id, id),
  constraint supplement_versions_supplement_same_org_fk foreign key (organization_id, supplement_id)
    references public.supplements(organization_id, id) on delete cascade
);

create index estimate_versions_estimate_idx on public.estimate_versions(estimate_id, version_number desc);
create index estimate_versions_job_idx on public.estimate_versions(job_id, created_at desc);
create index estimate_versions_created_by_idx on public.estimate_versions(created_by);
create index estimate_version_items_version_idx on public.estimate_version_items(estimate_version_id, sort_order);
create index estimate_version_items_org_version_idx on public.estimate_version_items(organization_id, estimate_version_id);
create index supplements_job_idx on public.supplements(job_id, supplement_number desc);
create index supplements_base_version_idx on public.supplements(base_estimate_version_id);
create index supplements_created_by_idx on public.supplements(created_by);
create index supplements_approved_by_idx on public.supplements(approved_by);
create index supplement_items_supplement_idx on public.supplement_items(supplement_id, sort_order);
create index supplement_items_category_idx on public.supplement_items(category_id);
create index supplement_items_created_by_idx on public.supplement_items(created_by);
create index supplement_versions_supplement_idx on public.supplement_versions(supplement_id, version_number desc);
create index supplement_versions_created_by_idx on public.supplement_versions(created_by);

create trigger supplements_set_updated_at before update on public.supplements for each row execute function private.set_updated_at();
create trigger supplement_items_set_updated_at before update on public.supplement_items for each row execute function private.set_updated_at();

create or replace function private.prevent_immutable_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Historical estimate and supplement versions are immutable' using errcode = '55000';
end;
$$;

create trigger estimate_versions_immutable before update or delete on public.estimate_versions
for each row execute function private.prevent_immutable_mutation();
create trigger estimate_version_items_immutable before update or delete on public.estimate_version_items
for each row execute function private.prevent_immutable_mutation();
create trigger supplement_versions_immutable before update or delete on public.supplement_versions
for each row execute function private.prevent_immutable_mutation();

alter table public.estimate_versions enable row level security;
alter table public.estimate_version_items enable row level security;
alter table public.supplements enable row level security;
alter table public.supplement_items enable row level security;
alter table public.supplement_versions enable row level security;

create policy estimate_versions_select_org on public.estimate_versions for select to authenticated using (private.has_org_access(organization_id));
create policy estimate_version_items_select_org on public.estimate_version_items for select to authenticated using (private.has_org_access(organization_id));

create policy supplements_select_org on public.supplements for select to authenticated using (private.has_org_access(organization_id));
create policy supplements_insert_estimator on public.supplements for insert to authenticated with check (created_by = (select auth.uid()) and private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy supplements_update_estimator on public.supplements for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer'])) with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy supplement_items_select_org on public.supplement_items for select to authenticated using (private.has_org_access(organization_id));
create policy supplement_items_insert_estimator on public.supplement_items for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy supplement_items_update_estimator on public.supplement_items for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer'])) with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy supplement_items_delete_estimator on public.supplement_items for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy supplement_versions_select_org on public.supplement_versions for select to authenticated using (private.has_org_access(organization_id));

revoke all on table public.estimate_versions, public.estimate_version_items, public.supplements, public.supplement_items, public.supplement_versions from anon, authenticated;
grant select on public.estimate_versions, public.estimate_version_items, public.supplement_versions to authenticated;
grant select, insert, update on public.supplements to authenticated;
grant select, insert, update, delete on public.supplement_items to authenticated;
grant all on public.estimate_versions, public.estimate_version_items, public.supplements, public.supplement_items, public.supplement_versions to service_role;

create or replace function public.snapshot_estimate(
  p_estimate_id uuid,
  p_reason text default 'manual_snapshot'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_estimate public.estimates%rowtype;
  v_version_id uuid;
  v_version_number integer;
  v_subtotal numeric(12,2);
  v_tax numeric(12,2);
  v_total numeric(12,2);
  v_category_totals jsonb;
  v_rate_snapshot jsonb;
begin
  select * into v_estimate from public.estimates where id = p_estimate_id for update;
  if not found or not private.has_org_access(v_estimate.organization_id) then
    raise exception 'Estimate not found' using errcode = '42501';
  end if;

  if p_reason not in ('manual_snapshot','approval','issued','revision','supplement_base') then
    raise exception 'Invalid snapshot reason' using errcode = '22023';
  end if;

  select coalesce(sum(line_total_ex_tax), 0)::numeric(12,2) into v_subtotal
  from public.estimate_items where estimate_id = p_estimate_id;
  v_tax := round(v_subtotal * (v_estimate.tax_rate / 100), 2);
  v_total := v_subtotal + v_tax;

  select coalesce(jsonb_object_agg(code, total), '{}'::jsonb) into v_category_totals
  from (
    select c.code, round(sum(i.line_total_ex_tax), 2) as total
    from public.estimate_items i
    join public.estimate_categories c on c.id = i.category_id
    where i.estimate_id = p_estimate_id
    group by c.code
  ) totals;

  select coalesce(jsonb_build_object(
    'id', rc.id,
    'name', rc.name,
    'rates', coalesce((select jsonb_agg(jsonb_build_object(
      'category_code', c.code,
      'category_name', c.name,
      'hourly_rate', rcr.hourly_rate,
      'fixed_rate', rcr.fixed_rate
    ) order by c.sort_order)
    from public.rate_card_rates rcr
    join public.estimate_categories c on c.id = rcr.category_id
    where rcr.rate_card_id = rc.id), '[]'::jsonb)
  ), '{}'::jsonb) into v_rate_snapshot
  from public.rate_cards rc
  where rc.id = v_estimate.rate_card_id;

  select coalesce(max(version_number), 0) + 1 into v_version_number
  from public.estimate_versions where estimate_id = p_estimate_id;

  insert into public.estimate_versions (
    organization_id, estimate_id, job_id, version_number, reason, status_snapshot,
    currency, tax_rate, subtotal_ex_tax, tax_amount, total_inc_tax,
    category_totals, rate_card_snapshot, pricing_snapshot, created_by
  ) values (
    v_estimate.organization_id, v_estimate.id, v_estimate.job_id, v_version_number, p_reason, v_estimate.status,
    v_estimate.currency, v_estimate.tax_rate, v_subtotal, v_tax, v_total,
    v_category_totals, v_rate_snapshot,
    jsonb_build_object('calculation', 'sum(line_total_ex_tax) + tax', 'tax_rate', v_estimate.tax_rate),
    (select auth.uid())
  ) returning id into v_version_id;

  insert into public.estimate_version_items (
    organization_id, estimate_version_id, original_item_id, category_code, category_name,
    component, side, operation_code, description, quantity, labour_hours, labour_rate,
    fixed_amount, part_cost, markup_percent, freight_amount, adjustment_amount,
    line_total_ex_tax, source_type, source_ref, notes, sort_order
  )
  select i.organization_id, v_version_id, i.id, c.code, c.name,
    i.component, i.side, i.operation_code, i.description, i.quantity, i.labour_hours, i.labour_rate,
    i.fixed_amount, i.part_cost, i.markup_percent, i.freight_amount, i.adjustment_amount,
    i.line_total_ex_tax, i.source_type, i.source_ref, i.notes, i.sort_order
  from public.estimate_items i
  join public.estimate_categories c on c.id = i.category_id
  where i.estimate_id = p_estimate_id
  order by i.sort_order, i.created_at;

  return v_version_id;
end;
$$;

revoke all on function public.snapshot_estimate(uuid, text) from public, anon;
grant execute on function public.snapshot_estimate(uuid, text) to authenticated;

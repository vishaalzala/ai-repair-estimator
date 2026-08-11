create table public.estimate_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9_]+$'),
  name text not null,
  pricing_basis text not null default 'hourly' check (pricing_basis in ('hourly','fixed','parts','formula','manual','adjustment')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, id)
);

create table public.rate_cards (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  insurer_id uuid references public.insurers(id) on delete set null,
  name text not null,
  description text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id),
  constraint rate_cards_insurer_same_org_fk foreign key (organization_id, insurer_id)
    references public.insurers(organization_id, id) on delete set null (insurer_id)
);

create unique index rate_cards_one_default_idx on public.rate_cards(organization_id) where is_default;

create table public.rate_card_rates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rate_card_id uuid not null references public.rate_cards(id) on delete cascade,
  category_id uuid not null references public.estimate_categories(id) on delete cascade,
  hourly_rate numeric(12,2) check (hourly_rate is null or hourly_rate >= 0),
  fixed_rate numeric(12,2) check (fixed_rate is null or fixed_rate >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rate_card_id, category_id),
  constraint rate_card_rates_card_same_org_fk foreign key (organization_id, rate_card_id)
    references public.rate_cards(organization_id, id) on delete cascade,
  constraint rate_card_rates_category_same_org_fk foreign key (organization_id, category_id)
    references public.estimate_categories(organization_id, id) on delete cascade
);

create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  rate_card_id uuid references public.rate_cards(id) on delete set null,
  estimate_type text not null default 'primary' check (estimate_type in ('primary','customer')),
  status text not null default 'draft' check (status in ('draft','ready_for_approval','approved','issued','superseded','cancelled')),
  currency char(3) not null default 'NZD',
  tax_rate numeric(5,2) not null default 15.00 check (tax_rate >= 0 and tax_rate <= 100),
  notes text,
  created_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, job_id, estimate_type),
  unique (organization_id, id),
  constraint estimates_job_same_org_fk foreign key (organization_id, job_id)
    references public.jobs(organization_id, id) on delete cascade,
  constraint estimates_rate_card_same_org_fk foreign key (organization_id, rate_card_id)
    references public.rate_cards(organization_id, id) on delete set null (rate_card_id)
);

create table public.estimate_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  category_id uuid not null references public.estimate_categories(id),
  component text,
  side text check (side is null or side in ('LH','RH','FRONT','REAR','CENTRE','NA')),
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
  source_type text not null default 'manual' check (source_type in ('manual','ai','rule','parts_provider','supplement')),
  source_ref text,
  ai_confidence numeric(5,4) check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  human_verified boolean not null default true,
  notes text,
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint estimate_items_estimate_same_org_fk foreign key (organization_id, estimate_id)
    references public.estimates(organization_id, id) on delete cascade,
  constraint estimate_items_category_same_org_fk foreign key (organization_id, category_id)
    references public.estimate_categories(organization_id, id)
);

create index estimate_categories_org_sort_idx on public.estimate_categories(organization_id, sort_order);
create index rate_cards_org_active_idx on public.rate_cards(organization_id, is_active);
create index rate_cards_insurer_idx on public.rate_cards(insurer_id);
create index rate_card_rates_card_idx on public.rate_card_rates(rate_card_id, category_id);
create index estimates_job_idx on public.estimates(job_id, status);
create index estimates_rate_card_idx on public.estimates(rate_card_id);
create index estimates_created_by_idx on public.estimates(created_by);
create index estimates_approved_by_idx on public.estimates(approved_by);
create index estimate_items_estimate_sort_idx on public.estimate_items(estimate_id, sort_order, created_at);
create index estimate_items_category_idx on public.estimate_items(category_id);
create index estimate_items_created_by_idx on public.estimate_items(created_by);

create trigger estimate_categories_set_updated_at before update on public.estimate_categories
for each row execute function private.set_updated_at();
create trigger rate_cards_set_updated_at before update on public.rate_cards
for each row execute function private.set_updated_at();
create trigger rate_card_rates_set_updated_at before update on public.rate_card_rates
for each row execute function private.set_updated_at();
create trigger estimates_set_updated_at before update on public.estimates
for each row execute function private.set_updated_at();
create trigger estimate_items_set_updated_at before update on public.estimate_items
for each row execute function private.set_updated_at();

alter table public.estimate_categories enable row level security;
alter table public.rate_cards enable row level security;
alter table public.rate_card_rates enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_items enable row level security;

create policy estimate_categories_select_org on public.estimate_categories for select to authenticated using (private.has_org_access(organization_id));
create policy estimate_categories_write_manager on public.estimate_categories for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','manager']));
create policy estimate_categories_update_manager on public.estimate_categories for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager'])) with check (private.has_org_role(organization_id, array['owner','admin','manager']));
create policy estimate_categories_delete_manager on public.estimate_categories for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager']) and not is_system);

create policy rate_cards_select_org on public.rate_cards for select to authenticated using (private.has_org_access(organization_id));
create policy rate_cards_write_manager on public.rate_cards for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','manager']));
create policy rate_cards_update_manager on public.rate_cards for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager'])) with check (private.has_org_role(organization_id, array['owner','admin','manager']));
create policy rate_cards_delete_manager on public.rate_cards for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager']));

create policy rate_card_rates_select_org on public.rate_card_rates for select to authenticated using (private.has_org_access(organization_id));
create policy rate_card_rates_write_manager on public.rate_card_rates for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','manager']));
create policy rate_card_rates_update_manager on public.rate_card_rates for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager'])) with check (private.has_org_role(organization_id, array['owner','admin','manager']));
create policy rate_card_rates_delete_manager on public.rate_card_rates for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager']));

create policy estimates_select_org on public.estimates for select to authenticated using (private.has_org_access(organization_id));
create policy estimates_insert_estimator on public.estimates for insert to authenticated with check (created_by = (select auth.uid()) and private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy estimates_update_estimator on public.estimates for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer'])) with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy estimates_delete_manager on public.estimates for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager']));

create policy estimate_items_select_org on public.estimate_items for select to authenticated using (private.has_org_access(organization_id));
create policy estimate_items_insert_estimator on public.estimate_items for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy estimate_items_update_estimator on public.estimate_items for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer'])) with check (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));
create policy estimate_items_delete_estimator on public.estimate_items for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','estimator','reviewer']));

revoke all on table public.estimate_categories, public.rate_cards, public.rate_card_rates, public.estimates, public.estimate_items from anon, authenticated;
grant select, insert, update, delete on public.estimate_categories, public.rate_cards, public.rate_card_rates to authenticated;
grant select, insert, update, delete on public.estimates, public.estimate_items to authenticated;
grant all on public.estimate_categories, public.rate_cards, public.rate_card_rates, public.estimates, public.estimate_items to service_role;

create or replace function private.seed_estimate_configuration(_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rate_card_id uuid;
begin
  insert into public.estimate_categories (organization_id, code, name, pricing_basis, sort_order, is_system)
  values
    (_organization_id, 'rr', 'Remove & Refit', 'hourly', 10, true),
    (_organization_id, 'align', 'Square & Align', 'hourly', 20, true),
    (_organization_id, 'cut_weld', 'Cut & Weld', 'hourly', 30, true),
    (_organization_id, 'repair', 'Repair', 'hourly', 40, true),
    (_organization_id, 'paint', 'Paint', 'fixed', 50, true),
    (_organization_id, 'blend', 'Blend', 'fixed', 60, true),
    (_organization_id, 'parts', 'Parts', 'parts', 70, true),
    (_organization_id, 'mechanical', 'Mechanical / General Labour', 'hourly', 80, true),
    (_organization_id, 'electrical', 'Electrical', 'hourly', 90, true),
    (_organization_id, 'diagnostics', 'Diagnostics', 'hourly', 100, true),
    (_organization_id, 'adas', 'ADAS', 'hourly', 110, true),
    (_organization_id, 'srs', 'SRS', 'hourly', 120, true),
    (_organization_id, 'outwork', 'Outwork / Sublet', 'manual', 130, true),
    (_organization_id, 'panel_materials', 'Panel Materials', 'formula', 140, true),
    (_organization_id, 'paint_materials', 'Paint Materials', 'formula', 150, true),
    (_organization_id, 'consumables', 'Consumables', 'manual', 160, true),
    (_organization_id, 'grooming', 'Grooming', 'fixed', 170, true),
    (_organization_id, 'miscellaneous', 'Miscellaneous', 'manual', 180, true),
    (_organization_id, 'adjustment', 'Discount / Adjustment', 'adjustment', 190, true)
  on conflict (organization_id, code) do nothing;

  insert into public.rate_cards (organization_id, name, description, is_default)
  values (_organization_id, 'Default Workshop Rates', 'Initial configurable rate card for this workshop.', true)
  on conflict (organization_id, name) do update set is_default = true
  returning id into v_rate_card_id;

  insert into public.rate_card_rates (organization_id, rate_card_id, category_id, hourly_rate, fixed_rate)
  select _organization_id, v_rate_card_id, c.id,
    case when c.pricing_basis = 'hourly' then 120.00 else null end,
    case when c.code = 'paint' then 450.00 when c.code = 'blend' then 120.00 else null end
  from public.estimate_categories c
  where c.organization_id = _organization_id
  on conflict (rate_card_id, category_id) do nothing;
end;
$$;

create or replace function private.bootstrap_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_members (organization_id, user_id, role, status)
  values (new.id, new.created_by, 'owner', 'active')
  on conflict (organization_id, user_id) do nothing;

  insert into public.workshop_settings (organization_id)
  values (new.id)
  on conflict (organization_id) do nothing;

  insert into public.organization_counters (organization_id, next_job_number)
  values (new.id, 1)
  on conflict (organization_id) do nothing;

  perform private.seed_estimate_configuration(new.id);
  return new;
end;
$$;

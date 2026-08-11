create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  account_reference text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name),
  unique (organization_id, id)
);

create table public.parts_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  provider text not null default 'manual' check (provider in ('manual','partstrader')),
  external_reference text,
  status text not null default 'draft' check (status in ('draft','requested','quotes_received','selected','ordered','closed','cancelled')),
  notes text,
  created_by uuid not null references auth.users(id),
  requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint parts_requests_job_same_org_fk foreign key (organization_id, job_id)
    references public.jobs(organization_id, id) on delete cascade
);

create table public.parts_request_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parts_request_id uuid not null references public.parts_requests(id) on delete cascade,
  description text not null,
  component text,
  side text check (side is null or side in ('LH','RH','FRONT','REAR','CENTRE','NA')),
  part_number text,
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  part_type text not null default 'tbc' check (part_type in ('oem','aftermarket','recycled','other','tbc')),
  status text not null default 'tbc' check (status in ('tbc','requested','quoted','selected','ordered','received','backordered','unavailable')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint parts_request_items_request_same_org_fk foreign key (organization_id, parts_request_id)
    references public.parts_requests(organization_id, id) on delete cascade
);

create table public.parts_quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parts_request_id uuid not null references public.parts_requests(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  provider text not null default 'manual' check (provider in ('manual','partstrader')),
  external_reference text,
  bulk_lot_amount numeric(12,2) not null default 0 check (bulk_lot_amount >= 0),
  freight_amount numeric(12,2) not null default 0 check (freight_amount >= 0),
  provider_fee_amount numeric(12,2) not null default 0 check (provider_fee_amount >= 0),
  quoted_at timestamptz,
  notes text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  constraint parts_quotes_request_same_org_fk foreign key (organization_id, parts_request_id)
    references public.parts_requests(organization_id, id) on delete cascade,
  constraint parts_quotes_supplier_same_org_fk foreign key (organization_id, supplier_id)
    references public.suppliers(organization_id, id) on delete set null (supplier_id)
);

create table public.parts_quote_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parts_quote_id uuid not null references public.parts_quotes(id) on delete cascade,
  request_item_id uuid not null references public.parts_request_items(id) on delete cascade,
  supplier_part_number text,
  part_type text not null default 'other' check (part_type in ('oem','aftermarket','recycled','other')),
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  quantity numeric(10,2) not null default 1 check (quantity > 0),
  markup_percent numeric(8,3) not null default 0 check (markup_percent >= 0),
  item_freight numeric(12,2) not null default 0 check (item_freight >= 0),
  sell_amount numeric(12,2) not null default 0 check (sell_amount >= 0),
  availability text,
  lead_time text,
  is_selected boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parts_quote_items_quote_same_org_fk foreign key (organization_id, parts_quote_id)
    references public.parts_quotes(organization_id, id) on delete cascade,
  constraint parts_quote_items_request_item_same_org_fk foreign key (organization_id, request_item_id)
    references public.parts_request_items(organization_id, id) on delete cascade
);

create index suppliers_org_active_idx on public.suppliers(organization_id, is_active, name);
create index parts_requests_job_idx on public.parts_requests(job_id, created_at desc);
create index parts_requests_org_job_idx on public.parts_requests(organization_id, job_id);
create index parts_requests_created_by_idx on public.parts_requests(created_by);
create index parts_request_items_request_idx on public.parts_request_items(parts_request_id, created_at);
create index parts_request_items_org_request_idx on public.parts_request_items(organization_id, parts_request_id);
create index parts_quotes_request_idx on public.parts_quotes(parts_request_id, created_at desc);
create index parts_quotes_supplier_idx on public.parts_quotes(supplier_id);
create index parts_quotes_created_by_idx on public.parts_quotes(created_by);
create index parts_quotes_org_request_idx on public.parts_quotes(organization_id, parts_request_id);
create index parts_quotes_org_supplier_idx on public.parts_quotes(organization_id, supplier_id);
create index parts_quote_items_quote_idx on public.parts_quote_items(parts_quote_id, created_at);
create index parts_quote_items_request_item_idx on public.parts_quote_items(request_item_id);
create index parts_quote_items_org_quote_idx on public.parts_quote_items(organization_id, parts_quote_id);
create index parts_quote_items_org_request_item_idx on public.parts_quote_items(organization_id, request_item_id);

create trigger suppliers_set_updated_at before update on public.suppliers for each row execute function private.set_updated_at();
create trigger parts_requests_set_updated_at before update on public.parts_requests for each row execute function private.set_updated_at();
create trigger parts_request_items_set_updated_at before update on public.parts_request_items for each row execute function private.set_updated_at();
create trigger parts_quotes_set_updated_at before update on public.parts_quotes for each row execute function private.set_updated_at();
create trigger parts_quote_items_set_updated_at before update on public.parts_quote_items for each row execute function private.set_updated_at();

alter table public.suppliers enable row level security;
alter table public.parts_requests enable row level security;
alter table public.parts_request_items enable row level security;
alter table public.parts_quotes enable row level security;
alter table public.parts_quote_items enable row level security;

create policy suppliers_select_org on public.suppliers for select to authenticated using (private.has_org_access(organization_id));
create policy suppliers_insert_parts on public.suppliers for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','manager','parts','estimator']));
create policy suppliers_update_parts on public.suppliers for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','parts'])) with check (private.has_org_role(organization_id, array['owner','admin','manager','parts']));
create policy suppliers_delete_manager on public.suppliers for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager']));

create policy parts_requests_select_org on public.parts_requests for select to authenticated using (private.has_org_access(organization_id));
create policy parts_requests_insert_org on public.parts_requests for insert to authenticated with check (created_by = (select auth.uid()) and private.has_org_role(organization_id, array['owner','admin','manager','parts','estimator','reviewer']));
create policy parts_requests_update_org on public.parts_requests for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','parts','estimator','reviewer'])) with check (private.has_org_role(organization_id, array['owner','admin','manager','parts','estimator','reviewer']));

create policy parts_request_items_select_org on public.parts_request_items for select to authenticated using (private.has_org_access(organization_id));
create policy parts_request_items_write_org on public.parts_request_items for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','manager','parts','estimator','reviewer']));
create policy parts_request_items_update_org on public.parts_request_items for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','parts','estimator','reviewer'])) with check (private.has_org_role(organization_id, array['owner','admin','manager','parts','estimator','reviewer']));
create policy parts_request_items_delete_org on public.parts_request_items for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','parts','estimator']));

create policy parts_quotes_select_org on public.parts_quotes for select to authenticated using (private.has_org_access(organization_id));
create policy parts_quotes_insert_org on public.parts_quotes for insert to authenticated with check (created_by = (select auth.uid()) and private.has_org_role(organization_id, array['owner','admin','manager','parts','estimator']));
create policy parts_quotes_update_org on public.parts_quotes for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','parts','estimator'])) with check (private.has_org_role(organization_id, array['owner','admin','manager','parts','estimator']));

create policy parts_quote_items_select_org on public.parts_quote_items for select to authenticated using (private.has_org_access(organization_id));
create policy parts_quote_items_insert_org on public.parts_quote_items for insert to authenticated with check (private.has_org_role(organization_id, array['owner','admin','manager','parts','estimator']));
create policy parts_quote_items_update_org on public.parts_quote_items for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','parts','estimator'])) with check (private.has_org_role(organization_id, array['owner','admin','manager','parts','estimator']));
create policy parts_quote_items_delete_org on public.parts_quote_items for delete to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager','parts','estimator']));

revoke all on table public.suppliers, public.parts_requests, public.parts_request_items, public.parts_quotes, public.parts_quote_items from anon, authenticated;
grant select, insert, update, delete on public.suppliers to authenticated;
grant select, insert, update on public.parts_requests, public.parts_quotes to authenticated;
grant select, insert, update, delete on public.parts_request_items, public.parts_quote_items to authenticated;
grant all on public.suppliers, public.parts_requests, public.parts_request_items, public.parts_quotes, public.parts_quote_items to service_role;

alter table public.estimate_items
  add column if not exists extra_selected boolean not null default false;

alter table public.estimate_version_items
  add column if not exists report_selected boolean not null default false,
  add column if not exists blend_selected boolean not null default false,
  add column if not exists extra_selected boolean not null default false;

alter table public.workshop_settings
  add column if not exists panel_materials_enabled boolean not null default true,
  add column if not exists panel_materials_percent numeric(6,3) not null default 5.000 check (panel_materials_percent >= 0 and panel_materials_percent <= 100),
  add column if not exists paint_setup_enabled boolean not null default true,
  add column if not exists paint_setup_amount numeric(12,2) not null default 70.00 check (paint_setup_amount >= 0),
  add column if not exists environmental_fee_enabled boolean not null default true,
  add column if not exists environmental_fee_amount numeric(12,2) not null default 10.00 check (environmental_fee_amount >= 0);

comment on column public.estimate_items.extra_selected is
  'Estimator-selected additional/supplementary cost. Extra lines remain visible but are excluded from the current estimate total until accepted.';
comment on column public.estimate_version_items.report_selected is
  'Snapshot of report-only state. Report-only lines are shown with price but excluded from current estimate totals.';
comment on column public.estimate_version_items.extra_selected is
  'Snapshot of pending-extra state. Extra lines are shown separately and excluded from current estimate totals.';

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
  v_report_subtotal numeric(12,2);
  v_extra_subtotal numeric(12,2);
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

  select
    coalesce(sum(line_total_ex_tax) filter (where not report_selected and not extra_selected), 0)::numeric(12,2),
    coalesce(sum(line_total_ex_tax) filter (where report_selected and not extra_selected), 0)::numeric(12,2),
    coalesce(sum(line_total_ex_tax) filter (where extra_selected), 0)::numeric(12,2)
  into v_subtotal, v_report_subtotal, v_extra_subtotal
  from public.estimate_items
  where estimate_id = p_estimate_id;

  v_tax := round(v_subtotal * (v_estimate.tax_rate / 100), 2);
  v_total := v_subtotal + v_tax;

  select coalesce(jsonb_object_agg(code, total), '{}'::jsonb) into v_category_totals
  from (
    select c.code, round(sum(i.line_total_ex_tax), 2) as total
    from public.estimate_items i
    join public.estimate_categories c on c.id = i.category_id
    where i.estimate_id = p_estimate_id
      and not i.report_selected
      and not i.extra_selected
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
    jsonb_build_object(
      'calculation', 'sum(included line_total_ex_tax) + tax',
      'tax_rate', v_estimate.tax_rate,
      'report_only_subtotal', v_report_subtotal,
      'extra_subtotal', v_extra_subtotal,
      'report_and_extra_excluded_from_current_total', true
    ),
    (select auth.uid())
  ) returning id into v_version_id;

  insert into public.estimate_version_items (
    organization_id, estimate_version_id, original_item_id, category_code, category_name,
    component, side, operation_code, description, quantity, labour_hours, labour_rate,
    fixed_amount, part_cost, markup_percent, freight_amount, adjustment_amount,
    line_total_ex_tax, source_type, source_ref, report_selected, blend_selected, extra_selected, notes, sort_order
  )
  select i.organization_id, v_version_id, i.id, c.code, c.name,
    i.component, i.side, i.operation_code, i.description, i.quantity, i.labour_hours, i.labour_rate,
    i.fixed_amount, i.part_cost, i.markup_percent, i.freight_amount, i.adjustment_amount,
    i.line_total_ex_tax, i.source_type, i.source_ref, i.report_selected, i.blend_selected, i.extra_selected, i.notes, i.sort_order
  from public.estimate_items i
  join public.estimate_categories c on c.id = i.category_id
  where i.estimate_id = p_estimate_id
  order by i.sort_order, i.created_at;

  return v_version_id;
end;
$$;

revoke all on function public.snapshot_estimate(uuid, text) from public, anon;
grant execute on function public.snapshot_estimate(uuid, text) to authenticated;

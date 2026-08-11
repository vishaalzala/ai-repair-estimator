create or replace function public.snapshot_estimate(
  p_estimate_id uuid,
  p_reason text default 'manual_snapshot'
)
returns uuid
language plpgsql
security definer
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
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_estimate from public.estimates where id = p_estimate_id for update;
  if not found or not private.has_org_role(v_estimate.organization_id, array['owner','admin','manager','estimator','reviewer']) then
    raise exception 'Estimate not found or access denied' using errcode = '42501';
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
    v_user_id
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

  insert into public.activity_events (organization_id, job_id, actor_user_id, event_type, title, details)
  values (
    v_estimate.organization_id,
    v_estimate.job_id,
    v_user_id,
    'estimate_version_created',
    'Estimate version created',
    jsonb_build_object('version_id', v_version_id, 'version_number', v_version_number, 'reason', p_reason, 'total', v_total)
  );

  return v_version_id;
end;
$$;

revoke all on function public.snapshot_estimate(uuid, text) from public, anon;
grant execute on function public.snapshot_estimate(uuid, text) to authenticated;

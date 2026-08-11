create or replace function public.snapshot_supplement(
  p_supplement_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_supplement public.supplements%rowtype;
  v_version_id uuid;
  v_version_number integer;
  v_subtotal numeric(12,2);
  v_tax numeric(12,2);
  v_total numeric(12,2);
  v_items jsonb;
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_supplement from public.supplements where id = p_supplement_id for update;
  if not found or not private.has_org_role(v_supplement.organization_id, array['owner','admin','manager','estimator','reviewer']) then
    raise exception 'Supplement not found or access denied' using errcode = '42501';
  end if;

  select coalesce(sum(line_total_ex_tax), 0)::numeric(12,2) into v_subtotal
  from public.supplement_items where supplement_id = p_supplement_id;
  v_tax := round(v_subtotal * (v_supplement.tax_rate / 100), 2);
  v_total := v_subtotal + v_tax;

  select coalesce(jsonb_agg(jsonb_build_object(
    'original_item_id', i.id,
    'category_code', c.code,
    'category_name', c.name,
    'component', i.component,
    'side', i.side,
    'operation_code', i.operation_code,
    'description', i.description,
    'quantity', i.quantity,
    'labour_hours', i.labour_hours,
    'labour_rate', i.labour_rate,
    'fixed_amount', i.fixed_amount,
    'part_cost', i.part_cost,
    'markup_percent', i.markup_percent,
    'freight_amount', i.freight_amount,
    'adjustment_amount', i.adjustment_amount,
    'line_total_ex_tax', i.line_total_ex_tax,
    'source_type', i.source_type,
    'notes', i.notes,
    'sort_order', i.sort_order
  ) order by i.sort_order, i.created_at), '[]'::jsonb) into v_items
  from public.supplement_items i
  join public.estimate_categories c on c.id = i.category_id
  where i.supplement_id = p_supplement_id;

  select coalesce(max(version_number), 0) + 1 into v_version_number
  from public.supplement_versions where supplement_id = p_supplement_id;

  insert into public.supplement_versions (
    organization_id, supplement_id, version_number, status_snapshot,
    subtotal_ex_tax, tax_amount, total_inc_tax, items_snapshot, created_by
  ) values (
    v_supplement.organization_id, v_supplement.id, v_version_number, v_supplement.status,
    v_subtotal, v_tax, v_total, v_items, v_user_id
  ) returning id into v_version_id;

  insert into public.activity_events (organization_id, job_id, actor_user_id, event_type, title, details)
  values (
    v_supplement.organization_id,
    v_supplement.job_id,
    v_user_id,
    'supplement_version_created',
    'Supplement version created',
    jsonb_build_object(
      'supplement_id', v_supplement.id,
      'supplement_number', v_supplement.supplement_number,
      'version_id', v_version_id,
      'version_number', v_version_number,
      'total', v_total
    )
  );

  return v_version_id;
end;
$$;

revoke all on function public.snapshot_supplement(uuid) from public, anon;
grant execute on function public.snapshot_supplement(uuid) to authenticated;

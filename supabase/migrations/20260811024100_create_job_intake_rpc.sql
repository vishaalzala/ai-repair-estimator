create or replace function public.create_job_intake(
  p_organization_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_customer_id uuid;
  v_vehicle_id uuid;
  v_insurer_id uuid;
  v_job_id uuid;
  v_insurer_name text := nullif(trim(coalesce(p_payload ->> 'insurer_name', '')), '');
  v_first_name text := nullif(trim(coalesce(p_payload ->> 'customer_first_name', '')), '');
  v_last_name text := nullif(trim(coalesce(p_payload ->> 'customer_last_name', '')), '');
  v_excess numeric(12,2);
  v_model_year integer;
  v_odometer integer;
  v_accident_date date;
begin
  if v_user_id is null or not private.has_org_role(
    p_organization_id,
    array['owner','admin','manager','estimator','reviewer']
  ) then
    raise exception 'Not authorized to create jobs for this organization' using errcode = '42501';
  end if;

  if v_first_name is null and v_last_name is null then
    raise exception 'Customer name is required' using errcode = '22023';
  end if;

  begin
    v_model_year := nullif(trim(coalesce(p_payload ->> 'model_year', '')), '')::integer;
    v_odometer := nullif(trim(coalesce(p_payload ->> 'odometer_km', '')), '')::integer;
    v_excess := nullif(trim(coalesce(p_payload ->> 'excess_amount', '')), '')::numeric;
    v_accident_date := nullif(trim(coalesce(p_payload ->> 'accident_date', '')), '')::date;
  exception when invalid_text_representation or datetime_field_overflow then
    raise exception 'Invalid numeric or date value in job intake' using errcode = '22023';
  end;

  insert into public.customers (
    organization_id, customer_type, first_name, last_name, email, phone, created_by
  ) values (
    p_organization_id,
    'individual',
    v_first_name,
    v_last_name,
    nullif(trim(coalesce(p_payload ->> 'customer_email', '')), ''),
    nullif(trim(coalesce(p_payload ->> 'customer_phone', '')), ''),
    v_user_id
  ) returning id into v_customer_id;

  insert into public.vehicles (
    organization_id, customer_id, registration, vin, make, model, variant, model_year,
    colour, paint_code, odometer_km, body_type, fuel_type, is_ev, is_hybrid, adas_present, created_by
  ) values (
    p_organization_id,
    v_customer_id,
    nullif(upper(trim(coalesce(p_payload ->> 'registration', ''))), ''),
    nullif(upper(trim(coalesce(p_payload ->> 'vin', ''))), ''),
    nullif(trim(coalesce(p_payload ->> 'make', '')), ''),
    nullif(trim(coalesce(p_payload ->> 'model', '')), ''),
    nullif(trim(coalesce(p_payload ->> 'variant', '')), ''),
    v_model_year,
    nullif(trim(coalesce(p_payload ->> 'colour', '')), ''),
    nullif(trim(coalesce(p_payload ->> 'paint_code', '')), ''),
    v_odometer,
    nullif(trim(coalesce(p_payload ->> 'body_type', '')), ''),
    nullif(trim(coalesce(p_payload ->> 'fuel_type', '')), ''),
    coalesce((p_payload ->> 'is_ev')::boolean, false),
    coalesce((p_payload ->> 'is_hybrid')::boolean, false),
    case when p_payload ? 'adas_present' and p_payload ->> 'adas_present' <> '' then (p_payload ->> 'adas_present')::boolean else null end,
    v_user_id
  ) returning id into v_vehicle_id;

  if v_insurer_name is not null then
    select i.id into v_insurer_id
    from public.insurers i
    where i.organization_id = p_organization_id
      and lower(i.name) = lower(v_insurer_name)
    limit 1;

    if v_insurer_id is null then
      insert into public.insurers (organization_id, name)
      values (p_organization_id, v_insurer_name)
      returning id into v_insurer_id;
    end if;
  end if;

  insert into public.jobs (
    organization_id, customer_id, vehicle_id, status, repair_type, repair_size,
    work_source, job_reference, created_by
  ) values (
    p_organization_id,
    v_customer_id,
    v_vehicle_id,
    'photos_required',
    nullif(trim(coalesce(p_payload ->> 'repair_type', '')), ''),
    nullif(trim(coalesce(p_payload ->> 'repair_size', '')), ''),
    nullif(trim(coalesce(p_payload ->> 'work_source', '')), ''),
    nullif(trim(coalesce(p_payload ->> 'job_reference', '')), ''),
    v_user_id
  ) returning id into v_job_id;

  insert into public.claims (
    organization_id, job_id, insurer_id, claim_number, policy_number,
    assessor_name, assessor_email, assessor_phone, excess_amount,
    accident_date, accident_location, accident_description, authority_reference
  ) values (
    p_organization_id,
    v_job_id,
    v_insurer_id,
    nullif(trim(coalesce(p_payload ->> 'claim_number', '')), ''),
    nullif(trim(coalesce(p_payload ->> 'policy_number', '')), ''),
    nullif(trim(coalesce(p_payload ->> 'assessor_name', '')), ''),
    nullif(trim(coalesce(p_payload ->> 'assessor_email', '')), ''),
    nullif(trim(coalesce(p_payload ->> 'assessor_phone', '')), ''),
    v_excess,
    v_accident_date,
    nullif(trim(coalesce(p_payload ->> 'accident_location', '')), ''),
    nullif(trim(coalesce(p_payload ->> 'accident_description', '')), ''),
    nullif(trim(coalesce(p_payload ->> 'authority_reference', '')), '')
  );

  return v_job_id;
end;
$$;

revoke all on function public.create_job_intake(uuid, jsonb) from public, anon;
grant execute on function public.create_job_intake(uuid, jsonb) to authenticated;

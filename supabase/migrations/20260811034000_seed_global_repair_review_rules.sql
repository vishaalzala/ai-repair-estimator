do $$
declare
  v_rule_id uuid;
  v_version_id uuid;
begin
  insert into public.rules (organization_id, scope, code, name, description, enforcement_level, status)
  values (null, 'global', 'door_replace_dependencies', 'Door replacement dependencies', 'When a door replacement is present, review transfer items, trial fit, alignment and adjacent finish operations.', 'required_review', 'active')
  on conflict (organization_id, code) do update set name = excluded.name, description = excluded.description, enforcement_level = excluded.enforcement_level, status = excluded.status
  returning id into v_rule_id;
  insert into public.rule_versions (rule_id, version, conditions, actions, change_note, published_at)
  values (v_rule_id, 1,
    '{"all":[{"field":"estimate_text","operator":"contains_any","value":["door"]},{"field":"estimate_text","operator":"contains_any","value":["replace","replacement"]}]}'::jsonb,
    '[{"check_type":"door_transfers","title":"Review door transfer operations","detail":"Check glass, regulator/motor, lock, handles, wiring, speaker, trim, seals and mouldings for transfer or replacement requirements.","severity":"review"},{"check_type":"door_alignment","title":"Review trial fit and alignment","detail":"Confirm trial fit, panel gaps and alignment operations where required.","severity":"review"},{"check_type":"adjacent_finish","title":"Review adjacent blend requirements","detail":"Check whether adjacent panels require blend or finish operations based on the repair and paint system.","severity":"review"}]'::jsonb,
    'Initial global estimating review rule', now())
  on conflict (rule_id, version) do update set conditions = excluded.conditions, actions = excluded.actions, change_note = excluded.change_note, published_at = excluded.published_at
  returning id into v_version_id;
  update public.rules set current_version_id = v_version_id where id = v_rule_id;

  insert into public.rules (organization_id, scope, code, name, description, enforcement_level, status)
  values (null, 'global', 'front_impact_review', 'Front impact review', 'Front impacts should trigger review of reinforcement, absorber, supports, cooling, mounts and related mechanical/safety systems.', 'required_review', 'active')
  on conflict (organization_id, code) do update set name = excluded.name, description = excluded.description, enforcement_level = excluded.enforcement_level, status = excluded.status
  returning id into v_rule_id;
  insert into public.rule_versions (rule_id, version, conditions, actions, change_note, published_at)
  values (v_rule_id, 1,
    '{"any":[{"field":"claim_text","operator":"contains_any","value":["front impact","front collision","front-end","front end"]},{"field":"damage_text","operator":"contains_any","value":["front bumper","bonnet","hood","headlamp","radiator support","slam panel"]}]}'::jsonb,
    '[{"check_type":"front_structure","title":"Review front reinforcement and absorber","detail":"Confirm whether reinforcement, absorber, retainers and mountings need inspection after the front impact.","severity":"review"},{"check_type":"front_supports","title":"Review front supports and cooling","detail":"Check slam/radiator support, cooling pack, undertray and relevant mountings where impact evidence supports inspection.","severity":"review"},{"check_type":"front_mechanical","title":"Review steering, suspension and alignment","detail":"Where impact reaches wheel, suspension or structural areas, confirm steering, suspension and alignment checks.","severity":"information"}]'::jsonb,
    'Initial global estimating review rule', now())
  on conflict (rule_id, version) do update set conditions = excluded.conditions, actions = excluded.actions, change_note = excluded.change_note, published_at = excluded.published_at
  returning id into v_version_id;
  update public.rules set current_version_id = v_version_id where id = v_rule_id;

  insert into public.rules (organization_id, scope, code, name, description, enforcement_level, status)
  values (null, 'global', 'adas_disturbance_review', 'ADAS disturbance review', 'Vehicles with ADAS require a calibration/scan review when relevant sensors, cameras, radar or mounting areas are disturbed.', 'required_review', 'active')
  on conflict (organization_id, code) do update set name = excluded.name, description = excluded.description, enforcement_level = excluded.enforcement_level, status = excluded.status
  returning id into v_rule_id;
  insert into public.rule_versions (rule_id, version, conditions, actions, change_note, published_at)
  values (v_rule_id, 1,
    '{"all":[{"field":"vehicle.adas_present","operator":"equals","value":true},{"field":"combined_text","operator":"contains_any","value":["radar","camera","sensor","windscreen","windshield","front bumper","grille","mirror"]}]}'::jsonb,
    '[{"check_type":"adas_calibration","title":"Review ADAS calibration requirement","detail":"Confirm the applicable OEM/insurer procedure for scan, aiming or calibration after the affected ADAS component or mounting area is disturbed.","severity":"review"}]'::jsonb,
    'Initial global estimating review rule', now())
  on conflict (rule_id, version) do update set conditions = excluded.conditions, actions = excluded.actions, change_note = excluded.change_note, published_at = excluded.published_at
  returning id into v_version_id;
  update public.rules set current_version_id = v_version_id where id = v_rule_id;

  insert into public.rules (organization_id, scope, code, name, description, enforcement_level, status)
  values (null, 'global', 'srs_review', 'SRS review', 'SRS or restraint-system evidence must trigger a dedicated safety review rather than an assumed charge.', 'mandatory', 'active')
  on conflict (organization_id, code) do update set name = excluded.name, description = excluded.description, enforcement_level = excluded.enforcement_level, status = excluded.status
  returning id into v_rule_id;
  insert into public.rule_versions (rule_id, version, conditions, actions, change_note, published_at)
  values (v_rule_id, 1,
    '{"field":"combined_text","operator":"contains_any","value":["airbag","srs","seat belt pretensioner","pretensioner","restraint"]}'::jsonb,
    '[{"check_type":"srs_system","title":"SRS / restraint review required","detail":"Confirm applicable restraint components, diagnostic checks and OEM procedures. Do not assume hidden SRS damage without evidence.","severity":"blocking"}]'::jsonb,
    'Initial global estimating review rule', now())
  on conflict (rule_id, version) do update set conditions = excluded.conditions, actions = excluded.actions, change_note = excluded.change_note, published_at = excluded.published_at
  returning id into v_version_id;
  update public.rules set current_version_id = v_version_id where id = v_rule_id;

  insert into public.rules (organization_id, scope, code, name, description, enforcement_level, status)
  values (null, 'global', 'parts_tbc_block', 'Unresolved parts TBC', 'Unresolved TBC parts must be reviewed before a final insurer estimate is issued.', 'mandatory', 'active')
  on conflict (organization_id, code) do update set name = excluded.name, description = excluded.description, enforcement_level = excluded.enforcement_level, status = excluded.status
  returning id into v_rule_id;
  insert into public.rule_versions (rule_id, version, conditions, actions, change_note, published_at)
  values (v_rule_id, 1,
    '{"field":"parts_statuses","operator":"contains_any","value":["tbc","requested","quoted"]}'::jsonb,
    '[{"check_type":"parts_tbc","title":"Resolve parts pricing/status","detail":"One or more replacement parts are not yet selected or finalised. Review before final issue.","severity":"blocking"}]'::jsonb,
    'Initial global estimating review rule', now())
  on conflict (rule_id, version) do update set conditions = excluded.conditions, actions = excluded.actions, change_note = excluded.change_note, published_at = excluded.published_at
  returning id into v_version_id;
  update public.rules set current_version_id = v_version_id where id = v_rule_id;
end $$;

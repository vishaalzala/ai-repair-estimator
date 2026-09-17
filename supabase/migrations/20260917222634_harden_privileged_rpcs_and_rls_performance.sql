create schema if not exists private;
grant usage on schema private to authenticated, service_role;

create or replace function private.is_platform_admin_impl(check_user_id uuid default auth.uid()) returns boolean language sql stable security definer set search_path = '' as $$ select check_user_id is not distinct from auth.uid() and exists (select 1 from public.platform_admins pa where pa.user_id=auth.uid() and pa.status='active'); $$;
create or replace function private.is_platform_super_admin_impl(check_user_id uuid default auth.uid()) returns boolean language sql stable security definer set search_path = '' as $$ select check_user_id is not distinct from auth.uid() and exists (select 1 from public.platform_admins pa where pa.user_id=auth.uid() and pa.status='active' and pa.role='super_admin'); $$;

create or replace function private.admin_user_directory_impl() returns table(user_id uuid,email text,full_name text,phone text,created_at timestamptz,last_sign_in_at timestamptz,organizations_count bigint,roles text) language plpgsql security definer set search_path = '' as $$ begin if not private.is_platform_admin_impl(auth.uid()) then raise exception 'platform admin required' using errcode='42501'; end if; return query select u.id,u.email::text,p.full_name,p.phone,u.created_at,u.last_sign_in_at,(select count(*) from public.organization_members om where om.user_id=u.id and om.status='active')::bigint,coalesce((select string_agg(distinct om.role, ', ' order by om.role) from public.organization_members om where om.user_id=u.id and om.status='active'),'') from auth.users u left join public.profiles p on p.id=u.id order by u.created_at desc; end; $$;

create or replace function private.accept_organization_invitation_impl(p_token_hash text) returns uuid language plpgsql security definer set search_path = '' as $$ declare v_user_id uuid := (select auth.uid()); v_email text; v_invitation public.organization_invitations%rowtype; begin if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if; select lower(email) into v_email from auth.users where id=v_user_id; if v_email is null then raise exception 'Verified account email required' using errcode='42501'; end if; select * into v_invitation from public.organization_invitations where token_hash=p_token_hash and status='pending' for update; if not found or v_invitation.expires_at<=now() then raise exception 'Invitation is invalid or expired' using errcode='22023'; end if; if lower(v_invitation.email)<>v_email then raise exception 'Invitation email does not match signed-in account' using errcode='42501'; end if; insert into public.organization_members(organization_id,user_id,role,status) values(v_invitation.organization_id,v_user_id,v_invitation.role,'active') on conflict(organization_id,user_id) do update set role=excluded.role,status='active'; update public.organization_invitations set status='accepted',accepted_by=v_user_id,accepted_at=now() where id=v_invitation.id; return v_invitation.organization_id; end; $$;

create or replace function private.snapshot_supplement_impl(p_supplement_id uuid) returns uuid language plpgsql security definer set search_path = '' as $$ declare v_supplement public.supplements%rowtype; v_version_id uuid; v_version_number integer; v_subtotal numeric(12,2); v_tax numeric(12,2); v_total numeric(12,2); v_items jsonb; v_user_id uuid := (select auth.uid()); begin if v_user_id is null then raise exception 'Authentication required' using errcode='42501'; end if; select * into v_supplement from public.supplements where id=p_supplement_id for update; if not found or not private.has_org_role(v_supplement.organization_id,array['owner','admin','manager','estimator','reviewer']) then raise exception 'Supplement not found or access denied' using errcode='42501'; end if; select coalesce(sum(line_total_ex_tax),0)::numeric(12,2) into v_subtotal from public.supplement_items where supplement_id=p_supplement_id; v_tax:=round(v_subtotal*(v_supplement.tax_rate/100),2); v_total:=v_subtotal+v_tax; select coalesce(jsonb_agg(jsonb_build_object('original_item_id',i.id,'category_code',c.code,'category_name',c.name,'component',i.component,'side',i.side,'operation_code',i.operation_code,'description',i.description,'quantity',i.quantity,'labour_hours',i.labour_hours,'labour_rate',i.labour_rate,'fixed_amount',i.fixed_amount,'part_cost',i.part_cost,'markup_percent',i.markup_percent,'freight_amount',i.freight_amount,'adjustment_amount',i.adjustment_amount,'line_total_ex_tax',i.line_total_ex_tax,'source_type',i.source_type,'notes',i.notes,'sort_order',i.sort_order) order by i.sort_order,i.created_at),'[]'::jsonb) into v_items from public.supplement_items i join public.estimate_categories c on c.id=i.category_id where i.supplement_id=p_supplement_id; select coalesce(max(version_number),0)+1 into v_version_number from public.supplement_versions where supplement_id=p_supplement_id; insert into public.supplement_versions(organization_id,supplement_id,version_number,status_snapshot,subtotal_ex_tax,tax_amount,total_inc_tax,items_snapshot,created_by) values(v_supplement.organization_id,v_supplement.id,v_version_number,v_supplement.status,v_subtotal,v_tax,v_total,v_items,v_user_id) returning id into v_version_id; insert into public.activity_events(organization_id,job_id,actor_user_id,event_type,title,details) values(v_supplement.organization_id,v_supplement.job_id,v_user_id,'supplement_version_created','Supplement version created',jsonb_build_object('supplement_id',v_supplement.id,'supplement_number',v_supplement.supplement_number,'version_id',v_version_id,'version_number',v_version_number,'total',v_total)); return v_version_id; end; $$;

create or replace function private.touch_platform_admin_login_impl() returns void language plpgsql security definer set search_path = '' as $$ begin update public.platform_admins set last_login_at=now(),updated_at=now() where user_id=auth.uid() and status='active'; end; $$;

revoke all on function private.is_platform_admin_impl(uuid) from public,anon;
revoke all on function private.is_platform_super_admin_impl(uuid) from public,anon;
revoke all on function private.admin_user_directory_impl() from public,anon;
revoke all on function private.accept_organization_invitation_impl(text) from public,anon;
revoke all on function private.snapshot_supplement_impl(uuid) from public,anon;
revoke all on function private.touch_platform_admin_login_impl() from public,anon;
grant execute on function private.is_platform_admin_impl(uuid) to authenticated,service_role;
grant execute on function private.is_platform_super_admin_impl(uuid) to authenticated,service_role;
grant execute on function private.admin_user_directory_impl() to authenticated,service_role;
grant execute on function private.accept_organization_invitation_impl(text) to authenticated,service_role;
grant execute on function private.snapshot_supplement_impl(uuid) to authenticated,service_role;
grant execute on function private.touch_platform_admin_login_impl() to authenticated,service_role;

create or replace function public.is_platform_admin(check_user_id uuid default auth.uid()) returns boolean language sql stable security invoker set search_path='' as $$ select private.is_platform_admin_impl(check_user_id); $$;
create or replace function public.is_platform_super_admin(check_user_id uuid default auth.uid()) returns boolean language sql stable security invoker set search_path='' as $$ select private.is_platform_super_admin_impl(check_user_id); $$;
create or replace function public.admin_user_directory() returns table(user_id uuid,email text,full_name text,phone text,created_at timestamptz,last_sign_in_at timestamptz,organizations_count bigint,roles text) language sql security invoker set search_path='' as $$ select * from private.admin_user_directory_impl(); $$;
create or replace function public.accept_organization_invitation(p_token_hash text) returns uuid language sql security invoker set search_path='' as $$ select private.accept_organization_invitation_impl(p_token_hash); $$;
create or replace function public.snapshot_supplement(p_supplement_id uuid) returns uuid language sql security invoker set search_path='' as $$ select private.snapshot_supplement_impl(p_supplement_id); $$;
create or replace function public.touch_platform_admin_login() returns void language sql security invoker set search_path='' as $$ select private.touch_platform_admin_login_impl(); $$;

revoke execute on function public.is_platform_admin(uuid) from public,anon;
revoke execute on function public.is_platform_super_admin(uuid) from public,anon;
revoke execute on function public.admin_user_directory() from public,anon;
revoke execute on function public.accept_organization_invitation(text) from public,anon;
revoke execute on function public.snapshot_supplement(uuid) from public,anon;
revoke execute on function public.touch_platform_admin_login() from public,anon;
grant execute on function public.is_platform_admin(uuid) to authenticated,service_role;
grant execute on function public.is_platform_super_admin(uuid) to authenticated,service_role;
grant execute on function public.admin_user_directory() to authenticated,service_role;
grant execute on function public.accept_organization_invitation(text) to authenticated,service_role;
grant execute on function public.snapshot_supplement(uuid) to authenticated,service_role;
grant execute on function public.touch_platform_admin_login() to authenticated,service_role;

drop policy if exists platform_admins_self_read on public.platform_admins;
create policy platform_admins_self_read on public.platform_admins for select to authenticated using ((user_id=(select auth.uid())) or (select public.is_platform_admin()));
drop policy if exists subscriptions_member_read on public.organization_subscriptions;
create policy subscriptions_member_read on public.organization_subscriptions for select to authenticated using ((select public.is_platform_admin()) or exists(select 1 from public.organization_members om where om.organization_id=organization_subscriptions.organization_id and om.user_id=(select auth.uid()) and om.status='active'));
drop policy if exists usage_member_read on public.ai_usage_ledger;
create policy usage_member_read on public.ai_usage_ledger for select to authenticated using ((select public.is_platform_admin()) or exists(select 1 from public.organization_members om where om.organization_id=ai_usage_ledger.organization_id and om.user_id=(select auth.uid()) and om.status='active' and om.role=any(array['owner','admin','manager'])));
drop policy if exists usage_member_insert on public.ai_usage_ledger;
create policy usage_member_insert on public.ai_usage_ledger for insert to authenticated with check ((select public.is_platform_admin()) or exists(select 1 from public.organization_members om where om.organization_id=ai_usage_ledger.organization_id and om.user_id=(select auth.uid()) and om.status='active'));
drop policy if exists usage_member_update on public.ai_usage_ledger;
create policy usage_member_update on public.ai_usage_ledger for update to authenticated using ((select public.is_platform_admin()) or exists(select 1 from public.organization_members om where om.organization_id=ai_usage_ledger.organization_id and om.user_id=(select auth.uid()) and om.status='active')) with check ((select public.is_platform_admin()) or exists(select 1 from public.organization_members om where om.organization_id=ai_usage_ledger.organization_id and om.user_id=(select auth.uid()) and om.status='active'));
drop policy if exists estimate_charges_member_read on public.estimate_ai_charges;
create policy estimate_charges_member_read on public.estimate_ai_charges for select to authenticated using ((select public.is_platform_admin()) or exists(select 1 from public.organization_members om where om.organization_id=estimate_ai_charges.organization_id and om.user_id=(select auth.uid()) and om.status='active' and om.role=any(array['owner','admin','manager'])));
drop policy if exists estimate_charges_member_write on public.estimate_ai_charges;
create policy estimate_charges_member_write on public.estimate_ai_charges for all to authenticated using ((select public.is_platform_admin()) or exists(select 1 from public.organization_members om where om.organization_id=estimate_ai_charges.organization_id and om.user_id=(select auth.uid()) and om.status='active')) with check ((select public.is_platform_admin()) or exists(select 1 from public.organization_members om where om.organization_id=estimate_ai_charges.organization_id and om.user_id=(select auth.uid()) and om.status='active'));

create index if not exists ai_usage_ledger_estimate_fk_idx on public.ai_usage_ledger(estimate_id);
create index if not exists email_events_org_outbound_message_fk_idx on public.email_events(organization_id,outbound_message_id);
create index if not exists estimate_ai_charges_org_idx on public.estimate_ai_charges(organization_id);
create index if not exists estimate_ai_charges_estimate_idx on public.estimate_ai_charges(estimate_id);
create index if not exists estimate_versions_org_estimate_idx on public.estimate_versions(organization_id,estimate_id);
create index if not exists estimate_versions_org_job_idx on public.estimate_versions(organization_id,job_id);
create index if not exists estimator_training_cases_approved_by_idx on public.estimator_training_cases(approved_by);
create index if not exists estimator_training_cases_created_by_idx on public.estimator_training_cases(created_by);
create index if not exists estimator_training_cases_org_idx on public.estimator_training_cases(organization_id);
create index if not exists organization_subscriptions_plan_idx on public.organization_subscriptions(plan_id);
create index if not exists outbound_messages_org_job_idx on public.outbound_messages(organization_id,job_id);
create index if not exists outbound_messages_org_report_version_idx on public.outbound_messages(organization_id,report_version_id);
create index if not exists platform_audit_logs_actor_idx on public.platform_audit_logs(actor_user_id);
create index if not exists platform_settings_updated_by_idx on public.platform_settings(updated_by);
create index if not exists report_versions_org_report_idx on public.report_versions(organization_id,report_id);
create index if not exists reports_org_estimate_version_idx on public.reports(organization_id,estimate_version_id);
create index if not exists reports_template_idx on public.reports(template_id);
create index if not exists reports_org_template_idx on public.reports(organization_id,template_id);
create index if not exists supplement_items_org_category_idx on public.supplement_items(organization_id,category_id);
create index if not exists supplement_items_org_supplement_idx on public.supplement_items(organization_id,supplement_id);
create index if not exists supplement_versions_org_supplement_idx on public.supplement_versions(organization_id,supplement_id);
create index if not exists supplements_org_base_version_idx on public.supplements(organization_id,base_estimate_version_id);
create index if not exists supplements_org_job_idx on public.supplements(organization_id,job_id);

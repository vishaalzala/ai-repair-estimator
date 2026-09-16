create or replace function public.is_platform_super_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists(select 1 from public.platform_admins pa where pa.user_id=check_user_id and pa.status='active' and pa.role='super_admin');
$$;
grant execute on function public.is_platform_super_admin(uuid) to authenticated;

create or replace function public.touch_platform_admin_login()
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  update public.platform_admins set last_login_at=now(),updated_at=now() where user_id=auth.uid() and status='active';
end;
$$;
grant execute on function public.touch_platform_admin_login() to authenticated;

drop policy if exists platform_admins_self_update on public.platform_admins;
drop policy if exists platform_admins_super_admin_update on public.platform_admins;
create policy platform_admins_super_admin_update on public.platform_admins for update to authenticated using(public.is_platform_super_admin()) with check(public.is_platform_super_admin());

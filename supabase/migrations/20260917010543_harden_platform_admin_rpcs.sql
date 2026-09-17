-- Harden Super Admin helper functions exposed through PostgREST.
-- Keep the signed-in admin helpers available where the app/RLS requires them,
-- but never allow anonymous callers or arbitrary user-id probing.

create or replace function public.is_platform_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    check_user_id is not distinct from auth.uid()
    and exists (
      select 1
      from public.platform_admins pa
      where pa.user_id = auth.uid()
        and pa.status = 'active'
    );
$$;

create or replace function public.is_platform_super_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select
    check_user_id is not distinct from auth.uid()
    and exists (
      select 1
      from public.platform_admins pa
      where pa.user_id = auth.uid()
        and pa.status = 'active'
        and pa.role = 'super_admin'
    );
$$;

revoke execute on function public.is_platform_admin(uuid) from public, anon;
revoke execute on function public.is_platform_super_admin(uuid) from public, anon;
revoke execute on function public.admin_user_directory() from public, anon;
revoke execute on function public.touch_platform_admin_login() from public, anon;

-- This function exists only as a trigger implementation and must never be an app-callable RPC.
revoke execute on function public.capture_ai_edit_learning_candidate() from public, anon, authenticated;

grant execute on function public.is_platform_admin(uuid) to authenticated;
grant execute on function public.is_platform_super_admin(uuid) to authenticated;
grant execute on function public.admin_user_directory() to authenticated;
grant execute on function public.touch_platform_admin_login() to authenticated;

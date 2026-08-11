create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','manager','estimator','reviewer','parts','technician','read_only')),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','expired','revoked')),
  expires_at timestamptz not null,
  invited_by uuid not null references auth.users(id),
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, email, status)
);

create index organization_invitations_org_status_idx on public.organization_invitations(organization_id, status, created_at desc);
create index organization_invitations_email_idx on public.organization_invitations(lower(email), status);
create index organization_invitations_invited_by_idx on public.organization_invitations(invited_by);
create index organization_invitations_accepted_by_idx on public.organization_invitations(accepted_by);

alter table public.organization_invitations enable row level security;
create policy organization_invitations_select_manager on public.organization_invitations for select to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager']));
create policy organization_invitations_insert_manager on public.organization_invitations for insert to authenticated with check (invited_by = (select auth.uid()) and private.has_org_role(organization_id, array['owner','admin','manager']));
create policy organization_invitations_update_manager on public.organization_invitations for update to authenticated using (private.has_org_role(organization_id, array['owner','admin','manager'])) with check (private.has_org_role(organization_id, array['owner','admin','manager']));
revoke all on table public.organization_invitations from anon, authenticated;
grant select, insert, update on public.organization_invitations to authenticated;
grant all on public.organization_invitations to service_role;

create or replace function public.accept_organization_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_email text;
  v_invitation public.organization_invitations%rowtype;
begin
  if v_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select lower(email) into v_email from auth.users where id = v_user_id;
  if v_email is null then raise exception 'Verified account email required' using errcode = '42501'; end if;

  select * into v_invitation
  from public.organization_invitations
  where token_hash = p_token_hash and status = 'pending'
  for update;

  if not found or v_invitation.expires_at <= now() then
    raise exception 'Invitation is invalid or expired' using errcode = '22023';
  end if;
  if lower(v_invitation.email) <> v_email then
    raise exception 'Invitation email does not match signed-in account' using errcode = '42501';
  end if;

  insert into public.organization_members (organization_id, user_id, role, status)
  values (v_invitation.organization_id, v_user_id, v_invitation.role, 'active')
  on conflict (organization_id, user_id) do update set role = excluded.role, status = 'active';

  update public.organization_invitations
  set status = 'accepted', accepted_by = v_user_id, accepted_at = now()
  where id = v_invitation.id;

  return v_invitation.organization_id;
end;
$$;

revoke all on function public.accept_organization_invitation(text) from public, anon;
grant execute on function public.accept_organization_invitation(text) to authenticated;

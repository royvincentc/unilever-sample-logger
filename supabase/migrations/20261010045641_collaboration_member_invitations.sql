-- Only the server may claim an explicitly approved email after Firebase verification.
create table public.collab_member_invitations (
  workspace_id uuid not null references public.collab_workspaces on delete cascade,
  email text not null check (email=lower(trim(email))),
  role text not null check (role in ('admin','editor','viewer')),
  claimed_uid text, claimed_at timestamptz,
  primary key(workspace_id,email)
);
alter table public.collab_member_invitations enable row level security;
revoke all on public.collab_member_invitations from public,anon,authenticated;
grant all on public.collab_member_invitations to service_role;
create function public.collab_claim_invitation(p_workspace uuid,p_uid text,p_email text)
returns setof public.collab_memberships language plpgsql security invoker set search_path=public,pg_temp as $$
declare invitation public.collab_member_invitations;
begin
  if p_uid is null or p_uid='' or p_email is null then return; end if;
  select * into invitation from public.collab_member_invitations
    where workspace_id=p_workspace and email=lower(trim(p_email)) for update;
  if not found then return; end if;
  if invitation.claimed_uid is not null then
    -- A consumed invitation never recreates or reactivates a revoked membership.
    if invitation.claimed_uid<>p_uid then return; end if;
  else
    insert into public.collab_memberships(workspace_id,uid,role,active)
      values(p_workspace,p_uid,invitation.role,true) on conflict do nothing;
    update public.collab_member_invitations set claimed_uid=p_uid,claimed_at=now()
      where workspace_id=p_workspace and email=invitation.email;
  end if;
  return query select * from public.collab_memberships
    where workspace_id=p_workspace and uid=p_uid and active;
end $$;
revoke all on function public.collab_claim_invitation(uuid,text,text) from public,anon,authenticated;
grant execute on function public.collab_claim_invitation(uuid,text,text) to service_role;

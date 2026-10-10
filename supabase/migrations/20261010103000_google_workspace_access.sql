-- Collaboration now authenticates Google OAuth sessions in the application API.
-- Keep all database access behind the server-side service role; Realtime no longer
-- accepts Firebase ID tokens or queries collaboration tables from browsers.
drop policy if exists collab_members_self on public.collab_memberships;
drop policy if exists collab_resources_members on public.collab_resources;
revoke all on public.collab_memberships, public.collab_resources from public, anon, authenticated;

-- Every authenticated Google account gets workspace access as an editor.
-- Existing active admins remain admins. A verified email can carry its prior
-- invitation-linked role across the migration from Firebase UID to Google sub.
create or replace function public.collab_google_membership(p_workspace uuid, p_uid text, p_email text)
returns setof public.collab_memberships
language plpgsql security invoker set search_path=public,pg_temp as $$
declare
  invitation public.collab_member_invitations;
  old_member public.collab_memberships;
  current_member public.collab_memberships;
begin
  if p_workspace is null or p_uid is null or p_uid='' or p_email is null or p_email='' then return; end if;

  select * into current_member from public.collab_memberships
    where workspace_id=p_workspace and uid=p_uid;
  if found then
    if not current_member.active then
      update public.collab_memberships set active=true, role='editor'
        where workspace_id=p_workspace and uid=p_uid;
    elsif current_member.role='viewer' then
      update public.collab_memberships set role='editor'
        where workspace_id=p_workspace and uid=p_uid and active and role='viewer';
    end if;
    return query select * from public.collab_memberships
      where workspace_id=p_workspace and uid=p_uid;
    return;
  end if;

  select * into invitation from public.collab_member_invitations
    where workspace_id=p_workspace and email=lower(trim(p_email)) for update;

  if found and invitation.claimed_uid is null then
    insert into public.collab_memberships(workspace_id,uid,role,active)
      values(p_workspace,p_uid,invitation.role,true) on conflict do nothing;
    update public.collab_member_invitations set claimed_uid=p_uid,claimed_at=now()
      where workspace_id=p_workspace and email=invitation.email and claimed_uid is null;
  elsif found and invitation.claimed_uid<>p_uid then
    select * into old_member from public.collab_memberships
      where workspace_id=p_workspace and uid=invitation.claimed_uid for update;
    -- Carry data/admin status only from an active old identity. All signed-in
    -- users still get a fresh editor membership below if that identity is gone
    -- or inactive.
    if found and old_member.active then
      select * into current_member from public.collab_memberships
        where workspace_id=p_workspace and uid=p_uid for update;
      if found then
        if old_member.role='admin' then
          update public.collab_memberships set role='admin'
            where workspace_id=p_workspace and uid=p_uid and active;
        end if;
        delete from public.collab_memberships where workspace_id=p_workspace and uid=old_member.uid;
      else
        update public.collab_memberships set uid=p_uid
          where workspace_id=p_workspace and uid=old_member.uid;
      end if;
      update public.collab_member_invitations set claimed_uid=p_uid,claimed_at=now()
        where workspace_id=p_workspace and email=invitation.email and claimed_uid=invitation.claimed_uid;
    end if;
  end if;

  insert into public.collab_memberships(workspace_id,uid,role,active)
    values(p_workspace,p_uid,'editor',true) on conflict do nothing;
  update public.collab_memberships set role='editor', active=true
    where workspace_id=p_workspace and uid=p_uid and (not active or role='viewer');
  return query select * from public.collab_memberships
    where workspace_id=p_workspace and uid=p_uid;
end $$;

revoke all on function public.collab_google_membership(uuid,text,text) from public,anon,authenticated;
grant execute on function public.collab_google_membership(uuid,text,text) to service_role;

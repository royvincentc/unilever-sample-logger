-- Apply only to an isolated, reviewed Supabase staging project before production.
create table public.collab_workspaces (id uuid primary key, name text not null);
create table public.collab_memberships (
  workspace_id uuid references public.collab_workspaces on delete cascade,
  uid text not null, role text not null check(role in ('admin','editor','viewer')),
  active boolean not null default true, primary key(workspace_id,uid)
);
create table public.collab_resources (
  id uuid primary key, workspace_id uuid not null references public.collab_workspaces,
  kind text not null check(kind in ('board','drawing')), name text not null,
  revision bigint not null, generation bigint not null, deleted_at timestamptz,
  data jsonb not null, updated_at timestamptz not null default now(),
  drive_revision bigint, drive_status text not null default 'not configured'
);
create index collab_resources_workspace on public.collab_resources(workspace_id,updated_at);
create table public.collab_receipts (
  workspace_id uuid not null references public.collab_workspaces, operation_id text not null,
  actor_uid text not null, hash text not null, result jsonb not null,
  created_at timestamptz not null default now(), primary key(workspace_id,operation_id)
);
create table public.collab_presence (
  workspace_id uuid not null references public.collab_workspaces, resource_id uuid not null references public.collab_resources,
  uid text not null, session text not null, name text not null, cursor jsonb, expires_at timestamptz not null,
  primary key(workspace_id,resource_id,uid,session)
);
create index collab_presence_expiry on public.collab_presence(expires_at);
create table public.collab_drive_destinations (
  workspace_id uuid primary key references public.collab_workspaces,
  folder_id text not null, drive_id text, configured_by text not null, updated_at timestamptz not null default now()
);
create table public.collab_drive_jobs (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.collab_workspaces,
  resource_id uuid not null references public.collab_resources, revision bigint not null,
  snapshot jsonb not null, status text not null default 'pending', attempts int not null default 0,
  next_attempt timestamptz not null default now(), lease_until timestamptz, fence uuid,
  folder_id text, file_id text, preview_id text, export_id text, content_hash text,
  file_version text, error text, saved_at timestamptz, preview jsonb,
  unique(resource_id,revision)
);
create index collab_drive_due on public.collab_drive_jobs(status,next_attempt);

alter table public.collab_workspaces enable row level security;
alter table public.collab_memberships enable row level security;
alter table public.collab_resources enable row level security;
alter table public.collab_receipts enable row level security;
alter table public.collab_presence enable row level security;
alter table public.collab_drive_destinations enable row level security;
alter table public.collab_drive_jobs enable row level security;
revoke all on public.collab_workspaces,public.collab_memberships,public.collab_resources,public.collab_receipts,public.collab_presence,public.collab_drive_destinations,public.collab_drive_jobs from anon,authenticated;
grant all on public.collab_workspaces,public.collab_memberships,public.collab_resources,public.collab_receipts,public.collab_presence,public.collab_drive_destinations,public.collab_drive_jobs to service_role;
-- Authenticated Realtime reads only. Never grant direct client mutations.
grant select on public.collab_memberships,public.collab_resources to authenticated;
create policy collab_members_self on public.collab_memberships for select to authenticated using (
  uid = auth.jwt()->>'sub' and active and auth.jwt()->>'iss' = 'https://securetoken.google.com/unilever-qc'
  and auth.jwt()#>>'{firebase,sign_in_provider}'='google.com' and auth.jwt()->>'email_verified'='true'
);
create policy collab_resources_members on public.collab_resources for select to authenticated using (
  exists(select 1 from public.collab_memberships m where m.workspace_id=collab_resources.workspace_id and m.uid=auth.jwt()->>'sub' and m.active)
  and auth.jwt()->>'iss' = 'https://securetoken.google.com/unilever-qc'
  and auth.jwt()#>>'{firebase,sign_in_provider}'='google.com' and auth.jwt()->>'email_verified'='true'
);

create function public.collab_commit(p_workspace uuid,p_actor text,p_operation text,p_hash text,p_expected bigint,p_resource jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare member_role text; current_revision bigint; receipt public.collab_receipts; result jsonb; resource_id uuid;
begin
  select role into member_role from public.collab_memberships where workspace_id=p_workspace and uid=p_actor and active for share;
  if member_role is null or member_role='viewer' then raise exception 'permission_denied'; end if;
  if p_resource->>'workspace_id' <> p_workspace::text then raise exception 'permission_denied'; end if;
  resource_id := (p_resource->>'id')::uuid;
  perform pg_advisory_xact_lock(hashtextextended(p_workspace::text || resource_id::text,0));
  select * into receipt from public.collab_receipts where workspace_id=p_workspace and operation_id=p_operation;
  if found then
    if receipt.hash<>p_hash or receipt.actor_uid<>p_actor then raise exception 'operation_id_conflict'; end if;
    return receipt.result;
  end if;
  select revision into current_revision from public.collab_resources where id=resource_id and workspace_id=p_workspace for update;
  if coalesce(current_revision,0)<>p_expected then raise exception 'revision_conflict'; end if;
  if (p_resource->>'revision')::bigint<>p_expected+1 then raise exception 'invalid_revision'; end if;
  insert into public.collab_resources(id,workspace_id,kind,name,revision,generation,deleted_at,data,updated_at)
    values(resource_id,p_workspace,p_resource->>'kind',p_resource->>'name',(p_resource->>'revision')::bigint,(p_resource->>'generation')::bigint,(p_resource->>'deleted_at')::timestamptz,p_resource->'data',now())
    on conflict(id) do update set name=excluded.name,revision=excluded.revision,generation=excluded.generation,deleted_at=excluded.deleted_at,data=excluded.data,updated_at=excluded.updated_at;
  -- Receipts contain immutable acknowledgment metadata, not a complete board per keystroke.
  select jsonb_build_object('resource',jsonb_build_object('id',r.id,'workspace_id',r.workspace_id,'revision',r.revision,'generation',r.generation)) into result from public.collab_resources r where id=resource_id;
  insert into public.collab_receipts values(p_workspace,p_operation,p_actor,p_hash,result,now());
  if exists(select 1 from public.collab_drive_destinations where workspace_id=p_workspace) then
    -- Coalesce pending debounce jobs; preserve failed/in-flight checkpoints for retry.
    -- Unclaimed jobs with no reserved external IDs can be replaced safely.
    -- Do not retain a full superseded snapshot for every text keystroke.
    delete from public.collab_drive_jobs j where j.resource_id=(p_resource->>'id')::uuid and j.status='pending' and j.file_id is null;
    insert into public.collab_drive_jobs(workspace_id,resource_id,revision,snapshot,next_attempt)
      select p_workspace,r.id,p_expected+1,to_jsonb(r),now()+interval '30 seconds' from public.collab_resources r where r.id=resource_id on conflict do nothing;
    update public.collab_resources set drive_status='pending' where id=resource_id;
  end if;
  return result;
end $$;
revoke all on function public.collab_commit(uuid,text,text,text,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.collab_commit(uuid,text,text,text,bigint,jsonb) to service_role;

create function public.collab_claim_drive(p_job uuid,p_fence uuid) returns setof public.collab_drive_jobs
language sql security invoker set search_path=public,pg_temp as $$
  update public.collab_drive_jobs set status='saving',fence=p_fence,lease_until=now()+interval '5 minutes',attempts=attempts+1
  where id=p_job and next_attempt<=now() and (status in ('pending','failed') or (status='saving' and lease_until<now())) returning *;
$$;
revoke all on function public.collab_claim_drive(uuid,uuid) from public,anon,authenticated;
grant execute on function public.collab_claim_drive(uuid,uuid) to service_role;

-- Provision explicitly using tools/collaboration/provision-members.ts; no automatic enrollment.
-- Enable collab_resources in the Realtime publication using reviewed dashboard settings.

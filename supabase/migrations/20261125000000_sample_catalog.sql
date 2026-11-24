create table public.collab_sample_catalogs (
  workspace_id uuid primary key references public.collab_workspaces on delete cascade,
  revision integer not null check (revision > 0),
  catalog jsonb not null check (jsonb_typeof(catalog) = 'object'),
  updated_by text not null
);

alter table public.collab_sample_catalogs enable row level security;
revoke all on public.collab_sample_catalogs from public, anon, authenticated;
grant select, insert, update on public.collab_sample_catalogs to service_role;

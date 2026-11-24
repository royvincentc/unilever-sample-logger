create table public.sheet_personnel (
  spreadsheet_id text not null,
  year text not null check (year ~ '^20[0-9]{2}$'),
  lists jsonb not null check (jsonb_typeof(lists) = 'object'),
  synced_at bigint not null,
  primary key (spreadsheet_id, year)
);

alter table public.sheet_personnel enable row level security;
revoke all on public.sheet_personnel from public, anon, authenticated;
grant select, insert, update on public.sheet_personnel to service_role;

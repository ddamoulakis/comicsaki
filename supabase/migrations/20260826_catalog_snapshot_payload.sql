-- Additive: week snapshots store the list payload so an issue can belong to many weeks.
alter table public.catalog_release_snapshots
  add column if not exists payload jsonb not null default '[]'::jsonb;

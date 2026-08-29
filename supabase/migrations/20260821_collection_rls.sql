-- Collection RLS + flag columns (idempotent)
-- Run in Supabase SQL Editor if collection load / delete / flags fail.

alter table if exists public.collections enable row level security;
alter table if exists public.collection_items enable row level security;

alter table if exists public.collection_items
  add column if not exists is_read boolean not null default false,
  add column if not exists is_wishlist boolean not null default false,
  add column if not exists is_favorite boolean not null default false;

-- collections
drop policy if exists "collections_select_own" on public.collections;
create policy "collections_select_own"
  on public.collections for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "collections_insert_own" on public.collections;
create policy "collections_insert_own"
  on public.collections for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "collections_update_own" on public.collections;
create policy "collections_update_own"
  on public.collections for update
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "collections_delete_own" on public.collections;
create policy "collections_delete_own"
  on public.collections for delete
  to authenticated
  using (auth.uid() = user_id);

-- collection_items (via owning collection)
drop policy if exists "collection_items_select_own" on public.collection_items;
create policy "collection_items_select_own"
  on public.collection_items for select
  to authenticated
  using (
    collection_id in (select id from public.collections where user_id = auth.uid())
  );

drop policy if exists "collection_items_insert_own" on public.collection_items;
create policy "collection_items_insert_own"
  on public.collection_items for insert
  to authenticated
  with check (
    collection_id in (select id from public.collections where user_id = auth.uid())
  );

drop policy if exists "collection_items_update_own" on public.collection_items;
create policy "collection_items_update_own"
  on public.collection_items for update
  to authenticated
  using (
    collection_id in (select id from public.collections where user_id = auth.uid())
  );

drop policy if exists "collection_items_delete_own" on public.collection_items;
create policy "collection_items_delete_own"
  on public.collection_items for delete
  to authenticated
  using (
    collection_id in (select id from public.collections where user_id = auth.uid())
  );

-- Catalog tables need readable rows for collection detail enrichment
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'issues') then
    execute 'alter table public.issues enable row level security';
    execute 'drop policy if exists "issues_select_all" on public.issues';
    execute 'create policy "issues_select_all" on public.issues for select to authenticated, anon using (true)';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'series') then
    execute 'alter table public.series enable row level security';
    execute 'drop policy if exists "series_select_all" on public.series';
    execute 'create policy "series_select_all" on public.series for select to authenticated, anon using (true)';
  end if;
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'publishers') then
    execute 'alter table public.publishers enable row level security';
    execute 'drop policy if exists "publishers_select_all" on public.publishers';
    execute 'create policy "publishers_select_all" on public.publishers for select to authenticated, anon using (true)';
  end if;
end $$;

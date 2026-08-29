-- Πίνακας αγγελιών χρηστών
create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  description text,
  price numeric(10, 2),
  cover_url text,
  condition text default 'VF',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- RLS
alter table public.listings enable row level security;

-- Όλοι βλέπουν αγγελίες
create policy "listings_select_all"
  on public.listings for select
  using (true);

-- Μόνο ο ιδιοκτήτης μπορεί να εισάγει
create policy "listings_insert_own"
  on public.listings for insert
  with check (auth.uid() = user_id);

-- Μόνο ο ιδιοκτήτης μπορεί να ενημερώσει
create policy "listings_update_own"
  on public.listings for update
  using (auth.uid() = user_id);

-- Μόνο ο ιδιοκτήτης μπορεί να διαγράψει
create policy "listings_delete_own"
  on public.listings for delete
  using (auth.uid() = user_id);

-- Trigger για updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger listings_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();

-- Index για ταξινόμηση
create index if not exists listings_created_at_idx on public.listings (created_at desc);

-- Storage bucket για εικόνες αγγελιών
insert into storage.buckets (id, name, public)
values ('listing-images', 'listing-images', true)
on conflict (id) do nothing;

create policy "listing_images_select"
  on storage.objects for select
  using (bucket_id = 'listing-images');

create policy "listing_images_insert"
  on storage.objects for insert
  with check (bucket_id = 'listing-images' and auth.uid() is not null);

create policy "listing_images_delete"
  on storage.objects for delete
  using (bucket_id = 'listing-images' and auth.uid() = owner);

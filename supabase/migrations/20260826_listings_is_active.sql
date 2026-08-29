-- Active / inactive marketplace listings
alter table public.listings
  add column if not exists is_active boolean not null default true;

create index if not exists listings_is_active_idx on public.listings (is_active);
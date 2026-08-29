-- Interactions for marketplace listings

create table if not exists public.listing_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete cascade not null,
  buyer_id uuid references auth.users(id) on delete cascade not null,
  seller_id uuid references auth.users(id) on delete cascade not null,
  offered_price numeric(10, 2),
  status text not null default 'pending',
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.listing_offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete cascade not null,
  buyer_id uuid references auth.users(id) on delete cascade not null,
  seller_id uuid references auth.users(id) on delete cascade not null,
  amount numeric(10, 2) not null,
  note text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists public.listing_messages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete cascade not null,
  sender_id uuid references auth.users(id) on delete cascade not null,
  recipient_id uuid references auth.users(id) on delete cascade not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings(id) on delete cascade not null,
  reporter_id uuid references auth.users(id) on delete cascade not null,
  reason text not null default 'general',
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

alter table public.listing_purchase_requests enable row level security;
alter table public.listing_offers enable row level security;
alter table public.listing_messages enable row level security;
alter table public.listing_reports enable row level security;

create policy "purchase_requests_select_participants"
  on public.listing_purchase_requests for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "purchase_requests_insert_buyer"
  on public.listing_purchase_requests for insert
  with check (
    auth.uid() = buyer_id
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.user_id = seller_id
        and l.user_id <> auth.uid()
    )
  );

create policy "purchase_requests_update_seller"
  on public.listing_purchase_requests for update
  using (auth.uid() = seller_id);

create policy "listing_offers_select_participants"
  on public.listing_offers for select
  using (auth.uid() = buyer_id or auth.uid() = seller_id);

create policy "listing_offers_insert_buyer"
  on public.listing_offers for insert
  with check (
    auth.uid() = buyer_id
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.user_id = seller_id
        and l.user_id <> auth.uid()
    )
  );

create policy "listing_offers_update_seller"
  on public.listing_offers for update
  using (auth.uid() = seller_id);

create policy "listing_messages_select_participants"
  on public.listing_messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

create policy "listing_messages_insert_sender"
  on public.listing_messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.user_id = recipient_id
        and l.user_id <> auth.uid()
    )
  );

create policy "listing_reports_select_reporter"
  on public.listing_reports for select
  using (auth.uid() = reporter_id);

create policy "listing_reports_insert_reporter"
  on public.listing_reports for insert
  with check (
    auth.uid() = reporter_id
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.user_id <> auth.uid()
    )
  );

create index if not exists listing_purchase_requests_listing_id_idx
  on public.listing_purchase_requests (listing_id, created_at desc);
create index if not exists listing_offers_listing_id_idx
  on public.listing_offers (listing_id, created_at desc);
create index if not exists listing_messages_listing_id_idx
  on public.listing_messages (listing_id, created_at desc);
create index if not exists listing_reports_listing_id_idx
  on public.listing_reports (listing_id, created_at desc);

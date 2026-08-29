-- Προφίλ χρηστών marketplace (χωρίς ακριβή διεύθυνση)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  city text,
  country text default 'Ελλάδα',
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Συμπλήρωση στηλών αν ο πίνακας δημιουργήθηκε παλιότερα χωρίς αυτές
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists country text default 'Ελλάδα';
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists created_at timestamptz default now() not null;
alter table public.profiles add column if not exists updated_at timestamptz default now() not null;

update public.profiles
set country = 'Ελλάδα'
where country is null or trim(country) = '';

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
  on public.profiles for select
  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant select on public.seller_ratings to anon, authenticated;
grant insert, update on public.seller_ratings to authenticated;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Αυτόματη δημιουργία προφίλ κατά την εγγραφή
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, city, country)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    null,
    'Ελλάδα'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Έλεγχος πληρότητας προφίλ για αγγελίες
create or replace function public.profile_is_complete(user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = user_id
      and length(trim(coalesce(p.display_name, ''))) > 0
      and length(trim(coalesce(p.city, ''))) > 0
      and length(trim(coalesce(p.country, ''))) > 0
  );
$$;

-- Βαθμολογίες πωλητών
create table if not exists public.seller_ratings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references auth.users(id) on delete cascade not null,
  reviewer_id uuid references auth.users(id) on delete cascade not null,
  score smallint not null check (score >= 1 and score <= 5),
  comment text,
  created_at timestamptz default now() not null,
  unique (seller_id, reviewer_id)
);

create index if not exists seller_ratings_seller_id_idx on public.seller_ratings (seller_id);

alter table public.seller_ratings enable row level security;

drop policy if exists "seller_ratings_select_all" on public.seller_ratings;
create policy "seller_ratings_select_all"
  on public.seller_ratings for select
  using (true);

drop policy if exists "seller_ratings_insert_own" on public.seller_ratings;
create policy "seller_ratings_insert_own"
  on public.seller_ratings for insert
  with check (
    auth.uid() = reviewer_id
    and reviewer_id <> seller_id
  );

drop policy if exists "seller_ratings_update_own" on public.seller_ratings;
create policy "seller_ratings_update_own"
  on public.seller_ratings for update
  using (auth.uid() = reviewer_id);

-- Απαιτείται πλήρες προφίλ για δημοσίευση αγγελίας
drop policy if exists "listings_insert_own" on public.listings;
create policy "listings_insert_own"
  on public.listings for insert
  with check (
    auth.uid() = user_id
    and public.profile_is_complete(auth.uid())
  );

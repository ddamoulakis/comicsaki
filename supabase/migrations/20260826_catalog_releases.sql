-- Cached Metron week lists + issue detail payloads.
-- Written by the catalog edge function (service role). Clients may only read.

create table if not exists public.catalog_release_snapshots (
  id uuid primary key default gen_random_uuid(),
  date_field text not null check (date_field in ('store', 'foc')),
  after_date date not null,
  before_date date not null,
  publisher_name text not null default '',
  series_query text not null default '',
  complete boolean not null default false,
  issue_count integer not null default 0,
  payload jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now(),
  unique (date_field, after_date, before_date, publisher_name, series_query)
);

create table if not exists public.catalog_releases (
  snapshot_id uuid not null references public.catalog_release_snapshots(id) on delete cascade,
  metron_id bigint not null,
  series_id bigint,
  series_name text not null,
  series_volume integer,
  number text not null,
  publisher text,
  store_date date,
  cover_date date,
  image text,
  fetched_at timestamptz not null default now(),
  primary key (snapshot_id, metron_id)
);

create index if not exists catalog_releases_store_date_idx
  on public.catalog_releases (store_date);

create table if not exists public.catalog_issue_details (
  metron_id bigint primary key,
  payload jsonb not null,
  fetched_at timestamptz not null default now()
);

-- One row: serializes Metron API calls across rotating edge IPs.
create table if not exists public.catalog_metron_gate (
  id integer primary key default 1 check (id = 1),
  retry_after_until timestamptz,
  burst_remaining integer,
  burst_reset timestamptz,
  last_request_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.catalog_metron_gate (id) values (1)
  on conflict (id) do nothing;

alter table public.catalog_release_snapshots enable row level security;
alter table public.catalog_releases enable row level security;
alter table public.catalog_issue_details enable row level security;
alter table public.catalog_metron_gate enable row level security;

drop policy if exists "catalog_snapshots_select" on public.catalog_release_snapshots;
create policy "catalog_snapshots_select"
  on public.catalog_release_snapshots for select using (true);

drop policy if exists "catalog_releases_select" on public.catalog_releases;
create policy "catalog_releases_select"
  on public.catalog_releases for select using (true);

drop policy if exists "catalog_issue_details_select" on public.catalog_issue_details;
create policy "catalog_issue_details_select"
  on public.catalog_issue_details for select using (true);

grant select on public.catalog_release_snapshots to anon, authenticated;
grant select on public.catalog_releases to anon, authenticated;
grant select on public.catalog_issue_details to anon, authenticated;

create or replace function public.catalog_acquire_metron_slot(min_gap_ms integer default 3200)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.catalog_metron_gate%rowtype;
  wait_ms integer;
  now_ts timestamptz := clock_timestamp();
  max_wait_ms constant integer := 15000;
begin
  insert into public.catalog_metron_gate (id) values (1) on conflict do nothing;
  select * into g from public.catalog_metron_gate where id = 1 for update;

  if g.retry_after_until is not null and g.retry_after_until > now_ts then
    return jsonb_build_object(
      'allowed', false,
      'retry_after_sec', greatest(1, ceil(extract(epoch from (g.retry_after_until - now_ts))))
    );
  end if;

  if g.last_request_at is not null then
    wait_ms := min_gap_ms - floor(extract(epoch from (now_ts - g.last_request_at)) * 1000)::integer;
    if wait_ms > max_wait_ms then
      return jsonb_build_object(
        'allowed', false,
        'retry_after_sec', greatest(1, ceil(wait_ms / 1000.0))
      );
    end if;
    if wait_ms > 0 then
      perform pg_sleep(wait_ms / 1000.0);
      now_ts := clock_timestamp();
    end if;
  end if;

  update public.catalog_metron_gate
    set last_request_at = now_ts, updated_at = now_ts
    where id = 1;

  return jsonb_build_object('allowed', true, 'retry_after_sec', 0);
end;
$$;

revoke all on function public.catalog_acquire_metron_slot(integer) from public, anon, authenticated;
grant execute on function public.catalog_acquire_metron_slot(integer) to service_role;

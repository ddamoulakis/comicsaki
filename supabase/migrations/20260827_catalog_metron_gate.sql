-- Gate + slot function in case 20260826_catalog_releases already ran without them.

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

alter table public.catalog_metron_gate enable row level security;

alter table public.catalog_release_snapshots
  add column if not exists payload jsonb not null default '[]'::jsonb;

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

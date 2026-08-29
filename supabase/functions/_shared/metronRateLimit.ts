import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export const METRON_BASE = 'https://metron.cloud/api';
export const MIN_GAP_MS = 3200;
export const RETRY_BUFFER_SEC = 2;
/** Wait in this isolate only. Longer waits must not spawn a new edge IP retry. */
export const MAX_SAME_ISOLATE_WAIT_MS = 15_000;

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Expose-Headers':
    'Retry-After, X-RateLimit-Burst-Limit, X-RateLimit-Burst-Remaining, X-RateLimit-Burst-Reset, X-RateLimit-Sustained-Limit, X-RateLimit-Sustained-Remaining, X-RateLimit-Sustained-Reset',
};

const RATE_HEADER_NAMES = [
  'Retry-After',
  'X-RateLimit-Burst-Limit',
  'X-RateLimit-Burst-Remaining',
  'X-RateLimit-Burst-Reset',
  'X-RateLimit-Sustained-Limit',
  'X-RateLimit-Sustained-Remaining',
  'X-RateLimit-Sustained-Reset',
] as const;

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function metronAuths(): string[] {
  const token = (Deno.env.get('METRON_TOKEN') ?? '').trim();
  const user = (Deno.env.get('METRON_USER') ?? '').trim();
  const pass = (Deno.env.get('METRON_PASS') ?? '').trim();
  const auths: string[] = [];
  if (token) auths.push(`Bearer ${token}`);
  if (user && pass) auths.push(`Basic ${btoa(`${user}:${pass}`)}`);
  return auths;
}

export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(url, key, { auth: { persistSession: false } });
}

export function copyRateLimitHeaders(from: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of RATE_HEADER_NAMES) {
    const value = from.get(name);
    if (value) out[name] = value;
  }
  return out;
}

/** Seconds to wait after a 429, including the Metron clock-skew buffer. */
export function retryAfterSeconds(res: Response): number {
  const header = Number(res.headers.get('Retry-After'));
  if (Number.isFinite(header) && header > 0) {
    return header + RETRY_BUFFER_SEC;
  }
  const burstReset = Number(res.headers.get('X-RateLimit-Burst-Reset'));
  if (Number.isFinite(burstReset) && burstReset > 0) {
    return Math.max(1, Math.ceil(burstReset - Date.now() / 1000) + RETRY_BUFFER_SEC);
  }
  return 60 + RETRY_BUFFER_SEC;
}

export type Slot = { allowed: true } | { allowed: false; retryAfterSec: number };

export async function acquireMetronSlot(sb: SupabaseClient): Promise<Slot> {
  const { data, error } = await sb.rpc('catalog_acquire_metron_slot', { min_gap_ms: MIN_GAP_MS });
  if (error) {
    console.error('catalog_acquire_metron_slot', error.message);
    return { allowed: true };
  }
  const row = data as { allowed?: boolean; retry_after_sec?: number } | null;
  if (row && row.allowed === false) {
    return { allowed: false, retryAfterSec: Math.max(1, Number(row.retry_after_sec) || 60) };
  }
  return { allowed: true };
}

export async function noteMetronResponse(sb: SupabaseClient, res: Response): Promise<void> {
  const burstRemaining = Number(res.headers.get('X-RateLimit-Burst-Remaining'));
  const burstResetUnix = Number(res.headers.get('X-RateLimit-Burst-Reset'));
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (Number.isFinite(burstRemaining)) patch.burst_remaining = burstRemaining;
  if (Number.isFinite(burstResetUnix) && burstResetUnix > 0) {
    patch.burst_reset = new Date(burstResetUnix * 1000).toISOString();
  }
  if (res.status === 429) {
    const sec = retryAfterSeconds(res);
    patch.retry_after_until = new Date(Date.now() + sec * 1000).toISOString();
  } else if (Number.isFinite(burstRemaining) && burstRemaining <= 0 && Number.isFinite(burstResetUnix)) {
    patch.retry_after_until = new Date(burstResetUnix * 1000 + RETRY_BUFFER_SEC * 1000).toISOString();
  } else {
    patch.retry_after_until = null;
  }
  const { error } = await sb.from('catalog_metron_gate').update(patch).eq('id', 1);
  if (error) console.error('catalog_metron_gate update', error.message);
}

/**
 * One Metron request. Never retries 429 from this isolate onto a new connection/IP.
 * Same-isolate wait+once is allowed only when Retry-After fits the edge timeout budget.
 */
let isolateLastAt = 0;

async function isolateGap() {
  const wait = MIN_GAP_MS - (Date.now() - isolateLastAt);
  if (wait > 0 && wait <= MAX_SAME_ISOLATE_WAIT_MS) await sleep(wait);
  isolateLastAt = Date.now();
}

export async function metronFetchOnce(
  sb: SupabaseClient,
  path: string,
  query: Record<string, string> = {},
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const slot = await acquireMetronSlot(sb);
  if (!slot.allowed) {
    return new Response(JSON.stringify({ error: 'Metron rate limited' }), {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(slot.retryAfterSec),
      },
    });
  }

  await isolateGap();

  const auths = metronAuths();
  if (auths.length === 0) {
    return new Response(JSON.stringify({ error: 'Metron credentials not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const params = new URLSearchParams(query);
  const qs = params.toString();
  const metronUrl = qs ? `${METRON_BASE}${path}?${qs}` : `${METRON_BASE}${path}`;
  const headers: Record<string, string> = {
    'User-Agent': 'Comicsaki/1.0 (comicsaki@gmail.com)',
    Accept: 'application/json',
    ...extraHeaders,
  };

  let last: Response | null = null;
  for (let i = 0; i < auths.length; i++) {
    if (i > 0) {
      const slot = await acquireMetronSlot(sb);
      if (!slot.allowed) {
        return new Response(JSON.stringify({ error: 'Metron rate limited' }), {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Retry-After': String(slot.retryAfterSec),
          },
        });
      }
    }
    last = await fetch(metronUrl, { headers: { ...headers, Authorization: auths[i] } });
    await noteMetronResponse(sb, last);
    if (last.status === 429) return last;
    if (last.status !== 401 || i === auths.length - 1) break;
  }
  return last!;
}

/** If 429 and wait is short, sleep in this isolate and try the same URL once. */
export async function metronFetchRespecting429(
  sb: SupabaseClient,
  path: string,
  query: Record<string, string> = {},
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const first = await metronFetchOnce(sb, path, query, extraHeaders);
  if (first.status !== 429) return first;

  const waitMs = retryAfterSeconds(first) * 1000;
  if (waitMs > MAX_SAME_ISOLATE_WAIT_MS) return first;

  await sleep(waitMs);
  return metronFetchOnce(sb, path, query, extraHeaders);
}

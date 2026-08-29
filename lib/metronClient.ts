/**
 * Shared Metron proxy client.
 *
 * Serializes leftover proxy calls (series nav, light enrichment). Week lists and
 * issue detail go through `catalog` instead. Never retries HTTP 429 — that is
 * what got the Metron account disabled (Retry-After ignored + new edge IPs).
 */

import { env } from '@/lib/env';
import { supabaseFunctionHeaders } from '@/lib/supabase';

/** Stay under Metron's 20 req/min burst if several leftover proxy calls fire. */
const MIN_GAP_MS = 3200;
const REQUEST_TIMEOUT_MS = 25_000;
const COOLDOWN_BUFFER_MS = 2000;
const MAX_QUEUE_WAIT_MS = 15_000;

type Priority = 'high' | 'low';

type QueueJob = {
  priority: Priority;
  run: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

const jobs: QueueJob[] = [];
let pumping = false;
let lastStartedAt = 0;
let cooldownUntil = 0;

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function rateLimitError(retryAfterSec: number) {
  const err = new Error(
    `Πολλά αιτήματα στο Metron — περίμενε ${retryAfterSec}s και ξαναδοκίμασε.`,
  );
  err.name = 'MetronRateLimitError';
  return err;
}

function retryAfterMs(res: Response): number {
  const header = Number(res.headers.get('retry-after'));
  if (Number.isFinite(header) && header > 0) {
    return header * 1000 + COOLDOWN_BUFFER_MS;
  }
  const burstReset = Number(res.headers.get('x-ratelimit-burst-reset'));
  if (Number.isFinite(burstReset) && burstReset > 0) {
    return Math.max(1000, burstReset * 1000 - Date.now()) + COOLDOWN_BUFFER_MS;
  }
  return 60_000 + COOLDOWN_BUFFER_MS;
}

function rejectQueued(error: Error) {
  while (jobs.length > 0) {
    const job = jobs.shift();
    job?.reject(error);
  }
}

async function fetchOnce(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: await supabaseFunctionHeaders(),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function dropPendingLowPriority() {
  for (let i = jobs.length - 1; i >= 0; i--) {
    if (jobs[i].priority !== 'low') continue;
    const [removed] = jobs.splice(i, 1);
    const err = new Error('Cancelled for high-priority Metron request');
    err.name = 'AbortError';
    removed.reject(err);
  }
}

function enqueue<T>(priority: Priority, run: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (priority === 'high') dropPendingLowPriority();
    jobs.push({
      priority,
      run: () => run(),
      resolve: (value) => resolve(value as T),
      reject,
    });
    void pump();
  });
}

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    while (jobs.length > 0) {
      const remainingCooldown = cooldownUntil - Date.now();
      if (remainingCooldown > MAX_QUEUE_WAIT_MS) {
        const sec = Math.ceil(remainingCooldown / 1000);
        rejectQueued(rateLimitError(sec));
        break;
      }
      if (remainingCooldown > 0) await sleep(remainingCooldown);

      const highIdx = jobs.findIndex((j) => j.priority === 'high');
      const idx = highIdx >= 0 ? highIdx : 0;
      const job = jobs.splice(idx, 1)[0];
      if (!job) break;

      const gap = Math.max(0, MIN_GAP_MS - (Date.now() - lastStartedAt));
      if (gap > 0) await sleep(gap);
      lastStartedAt = Date.now();

      try {
        job.resolve(await job.run());
      } catch (error) {
        job.reject(error);
      }
    }
  } finally {
    pumping = false;
    if (jobs.length > 0) void pump();
  }
}

/** Low-level fetch through the Supabase metron-proxy edge function. */
export async function metronProxyFetch(
  path: string,
  query: Record<string, string> = {},
  options?: { priority?: Priority },
): Promise<Response> {
  if (!env.supabaseUrl) {
    throw new Error('Supabase URL not configured');
  }

  const priority = options?.priority ?? 'high';
  const params = new URLSearchParams({ path, ...query });
  const url = `${env.supabaseUrl}/functions/v1/metron-proxy?${params}`;

  try {
    const res = await enqueue(priority, () => fetchOnce(url));
    if (res.status === 429) {
      const wait = retryAfterMs(res);
      cooldownUntil = Math.max(cooldownUntil, Date.now() + wait);
      rejectQueued(rateLimitError(Math.ceil(wait / 1000)));
    }
    return res;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw error;
  }
}

export async function metronGetJson<T>(
  path: string,
  query: Record<string, string> = {},
  options?: { priority?: Priority },
): Promise<T> {
  const res = await metronProxyFetch(path, query, options);
  if (res.status === 429) {
    throw rateLimitError(Math.ceil(retryAfterMs(res) / 1000));
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Metron proxy error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

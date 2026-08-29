import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  adminClient,
  copyRateLimitHeaders,
  corsHeaders,
  metronFetchRespecting429,
  retryAfterSeconds,
} from '../_shared/metronRateLimit.ts';

const MAX_PAGES = 12;
const WEEK_FRESH_MS = 6 * 60 * 60 * 1000;
const ISSUE_FRESH_MS = 7 * 24 * 60 * 60 * 1000;
const WALK_LOCK_MS = 2 * 60 * 1000;

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function rateLimited(res: Response, extra: Record<string, unknown> = {}) {
  const sec = retryAfterSeconds(res);
  return json(
    { error: 'Metron rate limited', ...extra },
    429,
    { 'Retry-After': String(sec), ...copyRateLimitHeaders(res.headers) },
  );
}

type ListIssue = {
  id: number;
  series?: { id?: number; name?: string; volume?: number };
  number?: string;
  cover_date?: string | null;
  store_date?: string | null;
  image?: string | null;
};

type ClientIssue = {
  id: number;
  series: { id: number; name: string; volume: number };
  number: string;
  cover_date: string | null;
  store_date: string | null;
  image: string | null;
  publisher: { id: number; name: string } | null;
};

function toClientIssue(issue: ListIssue): ClientIssue {
  return {
    id: issue.id,
    series: {
      id: issue.series?.id ?? 0,
      name: issue.series?.name ?? '',
      volume: issue.series?.volume ?? 1,
    },
    number: String(issue.number ?? ''),
    cover_date: issue.cover_date ?? null,
    store_date: issue.store_date ?? null,
    image: issue.image ?? null,
    publisher: null,
  };
}

function isPastRange(before: string) {
  const today = new Date().toISOString().slice(0, 10);
  return before < today;
}

async function handleWeek(url: URL) {
  const after = url.searchParams.get('after') ?? '';
  const before = url.searchParams.get('before') ?? '';
  const dateField = url.searchParams.get('date_field') === 'foc' ? 'foc' : 'store';
  const publisherName = (url.searchParams.get('publisher_name') ?? '').trim();
  const seriesQuery = (url.searchParams.get('series_q') ?? '').trim();
  const dated = Boolean(after && before);

  if (!dated && !seriesQuery) {
    return json({ error: 'after/before or series_q is required' }, 400);
  }

  const sb = adminClient();
  const { data: snap } = dated
    ? await sb
        .from('catalog_release_snapshots')
        .select('id, complete, fetched_at, issue_count, payload')
        .eq('date_field', dateField)
        .eq('after_date', after)
        .eq('before_date', before)
        .eq('publisher_name', publisherName)
        .eq('series_query', seriesQuery)
        .maybeSingle()
    : { data: null };

  const payload = Array.isArray(snap?.payload) ? snap.payload : [];
  const ageMs = snap?.fetched_at ? Date.now() - new Date(snap.fetched_at).getTime() : Infinity;
  const fresh =
    dated &&
    snap?.complete &&
    payload.length > 0 &&
    (isPastRange(before) || ageMs < WEEK_FRESH_MS);

  if (fresh && snap) {
    return json({ results: payload, count: payload.length, cached: true });
  }

  // Another isolate is already walking this week — do not start a second Metron crawl.
  if (dated && snap && !snap.complete && ageMs < WALK_LOCK_MS) {
    if (payload.length > 0) {
      return json({ results: payload, count: payload.length, cached: true, partial: true });
    }
    return json({ error: 'Catalog refresh in progress' }, 503, { 'Retry-After': '20' });
  }

  // Stale-but-present list: prefer cache over a new walk when the week is in the past.
  if (dated && payload.length > 0 && isPastRange(before)) {
    return json({ results: payload, count: payload.length, cached: true });
  }

  if (dated) {
    await sb.from('catalog_release_snapshots').upsert(
      {
        date_field: dateField,
        after_date: after,
        before_date: before,
        publisher_name: publisherName,
        series_query: seriesQuery,
        complete: false,
        issue_count: payload.length,
        payload,
        fetched_at: new Date().toISOString(),
      },
      { onConflict: 'date_field,after_date,before_date,publisher_name,series_query' },
    );
  }

  const query: Record<string, string> = { page_size: dated ? '100' : '40' };
  if (dated) {
    if (dateField === 'foc') {
      query.foc_date_range_after = after;
      query.foc_date_range_before = before;
    } else {
      query.store_date_range_after = after;
      query.store_date_range_before = before;
    }
  }
  if (publisherName) query.publisher_name = publisherName;
  if (seriesQuery) query.series_q = seriesQuery;

  const merged = new Map<number, ListIssue>();
  let truncated = false;
  let lastRes: Response | null = null;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await metronFetchRespecting429(sb, '/issue/', { ...query, page: String(page) });
    lastRes = res;
    if (res.status === 401) {
      return json({ error: 'Invalid username/password.' }, 401);
    }
    if (res.status === 429) {
      truncated = true;
      if (merged.size === 0 && payload.length > 0) {
        return json({ results: payload, count: payload.length, cached: true, partial: true });
      }
      if (merged.size === 0) return rateLimited(res);
      break;
    }
    if (!res.ok) {
      if (merged.size === 0 && payload.length > 0) {
        return json({ results: payload, count: payload.length, cached: true, partial: true });
      }
      if (merged.size === 0) return json({ error: `Metron error ${res.status}` }, res.status);
      truncated = true;
      break;
    }
    const data = await res.json();
    const results: ListIssue[] = data.results ?? [];
    for (const issue of results) {
      if (issue?.id) merged.set(issue.id, issue);
    }
    if (!data.next || results.length === 0) break;
    if (page === MAX_PAGES) truncated = true;
  }

  const issues = [...merged.values()].map(toClientIssue);
  if (!dated) {
    if (issues.length === 0 && lastRes?.status === 429) return rateLimited(lastRes);
    return json({ results: issues, count: issues.length, cached: false });
  }

  const saved = issues.length > 0 ? issues : payload;
  const { error: snapErr } = await sb.from('catalog_release_snapshots').upsert(
    {
      date_field: dateField,
      after_date: after,
      before_date: before,
      publisher_name: publisherName,
      series_query: seriesQuery,
      complete: !truncated && issues.length > 0,
      issue_count: saved.length,
      payload: saved,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'date_field,after_date,before_date,publisher_name,series_query' },
  );
  if (snapErr) console.error('catalog snapshot upsert', snapErr.message);

  if (issues.length === 0 && lastRes?.status === 429) return rateLimited(lastRes);

  return json({
    results: saved,
    count: saved.length,
    cached: false,
    partial: truncated,
  });
}

async function handleIssue(id: string) {
  const metronId = Number(id);
  if (!Number.isFinite(metronId) || metronId <= 0) {
    return json({ error: 'invalid issue id' }, 400);
  }

  const sb = adminClient();
  const { data: cached } = await sb
    .from('catalog_issue_details')
    .select('payload, fetched_at')
    .eq('metron_id', metronId)
    .maybeSingle();

  if (
    cached?.payload &&
    Date.now() - new Date(cached.fetched_at).getTime() < ISSUE_FRESH_MS
  ) {
    return json({ ...cached.payload, _cached: true });
  }

  const extra: Record<string, string> = {};
  if (cached?.fetched_at) {
    extra['If-Modified-Since'] = new Date(cached.fetched_at).toUTCString();
  }

  const res = await metronFetchRespecting429(sb, `/issue/${metronId}/`, {}, extra);
  if (res.status === 304 && cached?.payload) {
    return json({ ...cached.payload, _cached: true });
  }
  if (!res.ok) {
    if (cached?.payload) return json({ ...cached.payload, _cached: true });
    if (res.status === 429) return rateLimited(res);
    const text = await res.text().catch(() => '');
    return json({ error: text || `Metron error ${res.status}` }, res.status);
  }
  const payload = await res.json();
  if (payload && typeof payload === 'object' && payload.foc && !payload.foc_date) {
    payload.foc_date = payload.foc;
  }
  const { error: detailErr } = await sb.from('catalog_issue_details').upsert({
    metron_id: metronId,
    payload,
    fetched_at: new Date().toISOString(),
  });
  if (detailErr) console.error('catalog issue upsert', detailErr.message);
  return json(payload);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const issueId = url.searchParams.get('issue_id');
    if (issueId) return await handleIssue(issueId);
    return await handleWeek(url);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

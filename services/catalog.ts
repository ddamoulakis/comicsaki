/**
 * Catalog client — week lists and issue detail via the catalog edge function
 * (Supabase cache + one Metron walk on miss).
 */

import { env } from '@/lib/env';
import { supabaseFunctionHeaders } from '@/lib/supabase';
import { getArchiveIssueById } from '@/lib/archiveIssueStore';
import { getGreekMarketIssueById } from '@/services/greekReleases';

export type CatalogIssue = {
  id: number;
  series: { id: number; name: string; volume: number };
  number: string;
  cover_date: string | null;
  store_date: string | null;
  image: string | null;
  publisher?: { id: number; name: string } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday–Sunday in the device's local calendar — must match the market week. */
export function getStoreWeekRange(offsetWeeks = 0): { after: string; before: string } {
  const now = new Date();
  now.setDate(now.getDate() + offsetWeeks * 7);
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { after: localDate(monday), before: localDate(sunday) };
}

type WeekResponse = {
  results?: CatalogIssue[];
  count?: number;
  cached?: boolean;
  error?: string;
};

function rateLimitMessage(res: Response) {
  const retryAfter = Number(res.headers.get('retry-after'));
  const wait =
    Number.isFinite(retryAfter) && retryAfter > 0 ? ` ${Math.ceil(retryAfter)}s` : ' λίγο';
  return `Πολλά αιτήματα στο Metron — περίμενε${wait} και ξαναδοκίμασε.`;
}

async function catalogFetch(query: Record<string, string>): Promise<Response> {
  if (!env.supabaseUrl) throw new Error('Supabase URL not configured');
  const params = new URLSearchParams(query);
  const url = `${env.supabaseUrl}/functions/v1/catalog?${params}`;
  const res = await fetch(url, { headers: await supabaseFunctionHeaders() });
  return res;
}

export async function fetchCatalogWeek(opts: {
  after?: string;
  before?: string;
  dateField?: 'store' | 'foc';
  publisherName?: string;
  seriesQuery?: string;
}): Promise<CatalogIssue[]> {
  const query: Record<string, string> = {};
  if (opts.after && opts.before) {
    query.after = opts.after;
    query.before = opts.before;
    query.date_field = opts.dateField === 'foc' ? 'foc' : 'store';
  }
  if (opts.publisherName) query.publisher_name = opts.publisherName;
  if (opts.seriesQuery) query.series_q = opts.seriesQuery;

  const res = await catalogFetch(query);
  const data = (await res.json().catch(() => ({}))) as WeekResponse;
  if (res.status === 401) {
    throw new Error('Τα στοιχεία σύνδεσης του καταλόγου απορρίφθηκαν. Ξαναδοκίμασε σε λίγο.');
  }
  if (res.status === 429) {
    throw new Error(rateLimitMessage(res));
  }
  if (!res.ok) {
    throw new Error(data.error || `Metron error ${res.status}`);
  }
  return data.results ?? [];
}

export async function fetchCatalogIssue(id: string): Promise<CatalogIssue> {
  const numericId = Number(id);
  if (Number.isFinite(numericId) && numericId >= 8_000_000 && numericId < 9_000_000) {
    const archived = getArchiveIssueById(numericId);
    if (!archived) throw new Error('Δεν βρέθηκε αυτός ο τίτλος αρχείου.');
    return archived as CatalogIssue;
  }
  if (Number.isFinite(numericId) && numericId >= 9_000_000) {
    const greek = getGreekMarketIssueById(numericId);
    if (!greek) throw new Error('Δεν βρέθηκε αυτή η ελληνική κυκλοφορία.');
    return greek as CatalogIssue;
  }
  const res = await catalogFetch({ issue_id: String(id) });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    throw new Error('Ο κατάλογος δεν μπόρεσε να συνδεθεί. Ξαναδοκίμασε σε λίγο.');
  }
  if (res.status === 429) {
    throw new Error(rateLimitMessage(res));
  }
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Metron error ${res.status}`);
  }
  return data as CatalogIssue;
}

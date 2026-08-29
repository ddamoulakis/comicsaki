import { Platform } from 'react-native';
import { requireSupabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/env';
import { detectComicMarket, shouldFallbackToMetronCover } from '@/lib/comicLanguage';
import { isHttpUrl, isCatalogCoverUrl, isMetronCoverUrl, isOfficialCoverUrl } from '@/lib/coverUrl';
import { isSupabaseIssueId } from '@/lib/issueId';
import { lookupExactGreekCatalogCover } from '@/lib/greekCatalogMatch';
import { metronAliasTitles, resolveGreekCoverUrl, resolveGreekYear } from '@/services/greekReleases';
import {
  resolveHistoricalGreekYearAsync,
} from '@/services/greekCatalog';
import { resolveMetronCoverUrl, resolveMetronIssueMeta } from '@/services/metron';
import { collectionItemCoverUrl, resolveGreekEditionCoverUrl } from '@/lib/collectionCover';
import type { CollectionItem } from '@/types/collection';
import type { CollectionItemRow, UnifiedIssueSearchRow } from '@/types/supabase';

function isPersistableCoverUrl(url: string | undefined): url is string {
  if (!isOfficialCoverUrl(url)) return false;
  if (/localhost|127\.0\.0\.1/i.test(url)) return false;
  if (/\/api\/greek-covers\b/i.test(url)) return false;
  return true;
}

function persistIssueCovers(rows: { issueId: string; coverUrl: string }[]) {
  if (!rows.length || !isSupabaseConfigured()) return;
  void (async () => {
    try {
      const supabase = requireSupabase();
      await Promise.all(
        rows.slice(0, 24).map((row) =>
          supabase.from('issues').update({ cover_url: row.coverUrl }).eq('id', row.issueId),
        ),
      );
    } catch {
      // Display already updated.
    }
  })();
}

function pickIssueCoverUpdate(
  current: string | null | undefined,
  candidate: string | undefined,
  input: { series?: string; issue?: string; publisher?: string },
): string | undefined {
  const next = candidate?.trim() || undefined;
  const cur = current?.trim() || undefined;
  if (!next && !cur) return undefined;

  const market = detectComicMarket(input.series ?? '', input.publisher ?? '');
  const greekCatalog = resolveGreekEditionCoverUrl(
    input.series,
    input.issue,
    input.publisher,
  );

  if (isCatalogCoverUrl(greekCatalog) && isMetronCoverUrl(cur)) return greekCatalog;

  if (market === 'greek' && isCatalogCoverUrl(greekCatalog)) {
    if (!cur || isMetronCoverUrl(cur)) return greekCatalog;
  }

  if (!next) return undefined;
  if (!cur) return next;
  if (isMetronCoverUrl(cur) && market === 'greek' && isCatalogCoverUrl(greekCatalog)) {
    return greekCatalog;
  }
  if (isCatalogCoverUrl(next) && !isOfficialCoverUrl(cur)) return next;
  if (isOfficialCoverUrl(next) && !isOfficialCoverUrl(cur)) return next;
  return undefined;
}

function resolveFastCatalogCoverUrl(input: {
  series?: string;
  issue?: string;
  publisher?: string;
}): string | undefined {
  const series = input.series?.trim() ?? '';
  const issue = input.issue?.trim() ?? '';
  const publisher = input.publisher?.trim() ?? '';
  if (!series) return undefined;

  const exact = lookupExactGreekCatalogCover(series, issue, publisher);
  if (isCatalogCoverUrl(exact)) return exact;

  const greek = resolveGreekCoverUrl(series, issue, publisher);
  if (isCatalogCoverUrl(greek)) return greek;
  return undefined;
}

function displayedCollectionCover(item: CollectionItem): string | undefined {
  return collectionItemCoverUrl(item);
}

function attachFastCatalogCovers(items: CollectionItem[]): CollectionItem[] {
  const persist: { issueId: string; coverUrl: string }[] = [];
  const next = items.map((item) => {
    const cover = displayedCollectionCover(item);
    if (!cover || cover === item.coverUrl) return item;
    if (item.issueId && isPersistableCoverUrl(cover)) {
      persist.push({ issueId: item.issueId, coverUrl: cover });
    }
    return { ...item, coverUrl: cover };
  });
  persistIssueCovers(persist);
  return next;
}

function itemCoverKey(item: Pick<CollectionItem, 'series' | 'issue' | 'publisher'>): string {
  return `${item.series}::${item.issue}::${item.publisher}`;
}

const metronCoverAttempted = new Set<string>();

/** Metron (and remaining catalog) covers after the list is already on screen. */
export async function enrichMissingOfficialCovers(
  items: CollectionItem[],
  onUpdate?: (next: CollectionItem[]) => void,
): Promise<CollectionItem[]> {
  const missing = items.filter((item) => {
    const greek = resolveGreekEditionCoverUrl(item.series, item.issue, item.publisher);
    if (isCatalogCoverUrl(greek) && isMetronCoverUrl(item.coverUrl)) return true;
    return !isCatalogCoverUrl(collectionItemCoverUrl(item));
  });
  if (missing.length === 0) return items;

  const seen = new Set<string>();
  const jobs: CollectionItem[] = [];
  for (const item of missing) {
    const key = itemCoverKey(item);
    if (seen.has(key) || metronCoverAttempted.has(key)) continue;
    seen.add(key);
    metronCoverAttempted.add(key);
    jobs.push(item);
  }
  if (jobs.length === 0) return items;

  let current = items;
  const persist: { issueId: string; coverUrl: string }[] = [];

  for (const job of jobs) {
    try {
      const cover = await resolveCatalogCoverUrl({
        series: job.series,
        issue: job.issue,
        publisher: job.publisher,
      });
      if (!isCatalogCoverUrl(cover)) continue;
      const key = itemCoverKey(job);
      current = current.map((item) => {
        if (itemCoverKey(item) !== key) return item;
        if (isMetronCoverUrl(item.coverUrl) && isCatalogCoverUrl(cover)) {
          return { ...item, coverUrl: cover };
        }
        if (!isOfficialCoverUrl(item.coverUrl)) return { ...item, coverUrl: cover };
        return item;
      });
      onUpdate?.(current);
      if (isPersistableCoverUrl(cover)) {
        for (const item of current) {
          if (itemCoverKey(item) === key && item.issueId) {
            persist.push({ issueId: item.issueId, coverUrl: cover });
          }
        }
      }
    } catch {
      // Keep going — one miss must not block the rest.
    }
  }

  persistIssueCovers(persist);
  return current;
}

function extractYear(...parts: Array<string | null | undefined>): string | undefined {
  for (const part of parts) {
    if (!part) continue;
    const marked = part.match(/(?:έτος|year)\s*[:=]?\s*((?:19|20)\d{2})/i);
    if (marked?.[1]) return marked[1];
    const bare = part.match(/(?:^|[^\d])((?:19|20)\d{2})(?:[^\d]|$)/);
    if (bare?.[1]) {
      const y = Number(bare[1]);
      if (y >= 1930 && y <= new Date().getFullYear() + 3) return bare[1];
    }
  }
  return undefined;
}

function withYearNote(notes: string | null | undefined, year?: string): string | null {
  const base = (notes ?? '').trim();
  if (!year) return base || null;
  if (extractYear(base) === year) return base || `Έτος: ${year}`;
  if (!base) return `Έτος: ${year}`;
  if (/έτος\s*[:=]?\s*(?:19|20)\d{2}/i.test(base)) {
    return base.replace(/(έτος\s*[:=]?\s*)(?:19|20)\d{2}/i, `$1${year}`);
  }
  return `Έτος: ${year}\n${base}`;
}

async function resolveCatalogCoverUrl(input: {
  series?: string;
  issue?: string;
  publisher?: string;
  coverUrl?: string;
}): Promise<string | undefined> {
  const series = input.series?.trim() ?? '';
  const issue = input.issue?.trim() ?? '';
  const publisher = input.publisher?.trim() ?? '';
  if (!series) return undefined;

  const market = detectComicMarket(series, publisher);
  const greekCover = resolveGreekEditionCoverUrl(series, issue, publisher);

  if (isCatalogCoverUrl(input.coverUrl) && !isMetronCoverUrl(input.coverUrl)) {
    return input.coverUrl;
  }

  if (isCatalogCoverUrl(greekCover)) return greekCover;

  if (isSupabaseConfigured()) {
    try {
      const q = [series.replace(/\s*\([^)]*\)\s*$/u, '').trim(), issue !== '-' ? issue : '']
        .filter(Boolean)
        .join(' ');
      const rows = await searchIssues(q);
      const hit = rows.find((r) => isOfficialCoverUrl(r.cover_url ?? undefined));
      if (hit?.cover_url) return hit.cover_url;
    } catch {
      // ignore
    }
  }

  const tryMetron =
    (market !== 'greek' || shouldFallbackToMetronCover(series, publisher)) &&
    !isCatalogCoverUrl(greekCover);
  if (tryMetron) {
    const titles =
      market === 'greek'
        ? metronAliasTitles(series)
        : [series.replace(/\s*\([^)]*\)\s*$/u, '').trim()];
    for (const title of titles) {
      const url = await resolveMetronCoverUrl(title, issue !== '-' ? issue : undefined);
      if (isOfficialCoverUrl(url)) return url;
    }
  }

  return resolveGreekCoverUrl(series, undefined, publisher);
}

async function resolveCatalogYear(input: {
  series?: string;
  issue?: string;
  publisher?: string;
  notes?: string | null;
  year?: string;
}): Promise<string | undefined> {
  const fromInput = extractYear(input.year, input.notes);
  if (fromInput) return fromInput;

  const series = input.series?.trim() ?? '';
  const issue = input.issue?.trim() ?? '';
  const publisher = input.publisher?.trim() ?? '';
  if (!series) return undefined;

  const historicalYear = await resolveHistoricalGreekYearAsync(series, issue, publisher);
  if (historicalYear) return historicalYear;

  const greekYear = resolveGreekYear(series, issue, publisher);
  if (greekYear) return greekYear;

  const market = detectComicMarket(series, publisher);
  const titles =
    market === 'greek' ? metronAliasTitles(series) : [series.replace(/\s*\([^)]*\)\s*$/u, '').trim()];
  for (const title of titles) {
    const meta = await resolveMetronIssueMeta(title, issue !== '-' ? issue : undefined);
    if (meta?.year) return meta.year;
  }
  return undefined;
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m;
  }
  return String(err ?? 'Άγνωστο σφάλμα');
}

function mapCollectionRow(row: CollectionItemRow): CollectionItem {
  const issue = row.issue;
  const series = issue?.series;

  return {
    id: row.id,
    issueId: issue?.id,
    series: series?.title ?? issue?.title ?? 'Άγνωστη σειρά',
    issue: issue?.issue_number ?? '-',
    publisher: series?.publisher?.name ?? '—',
    coverUrl: issue?.cover_url ?? undefined,
    category: series?.category ?? 'Άλλο',
    condition: row.condition_grade ?? 'VF',
    qty: row.quantity,
    year: extractYear(row.notes) || undefined,
    isRead: row.is_read ?? false,
    isWishlist: row.is_wishlist ?? false,
    isFavorite: row.is_favorite ?? false,
  };
}

function normalizeRow(row: Record<string, unknown>): CollectionItemRow {
  const issueRaw = row.issue as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
  const issue = Array.isArray(issueRaw) ? issueRaw[0] : issueRaw;
  const seriesRaw = issue?.series as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
  const series = Array.isArray(seriesRaw) ? seriesRaw[0] : seriesRaw;
  const publisherRaw = series?.publisher as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
  const publisher = Array.isArray(publisherRaw) ? publisherRaw[0] : publisherRaw;

  return {
    id: String(row.id),
    quantity: Number(row.quantity ?? 1),
    condition_grade: (row.condition_grade as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    is_read: Boolean(row.is_read),
    is_wishlist: Boolean(row.is_wishlist),
    is_favorite: Boolean(row.is_favorite),
    issue: issue
      ? {
          id: String(issue.id),
          issue_number: String(issue.issue_number ?? '-'),
          title: (issue.title as string | null) ?? null,
          cover_url: (issue.cover_url as string | null) ?? null,
          series: series
            ? {
                title: String(series.title ?? 'Άγνωστη σειρά'),
                category: (series.category as string | null) ?? null,
                publisher: publisher ? { name: String(publisher.name ?? '—') } : null,
              }
            : null,
        }
      : null,
  };
}

type IssueDetails = NonNullable<CollectionItemRow['issue']>;

async function fetchIssueDetailsMap(
  supabase: ReturnType<typeof requireSupabase>,
  issueIds: string[],
): Promise<Map<string, IssueDetails>> {
  const map = new Map<string, IssueDetails>();
  if (issueIds.length === 0) return map;

  // Nested join (best case)
  const nested = await supabase
    .from('issues')
    .select(
      `
      id,
      issue_number,
      title,
      cover_url,
      series (
        title,
        category,
        publishers ( name )
      )
    `,
    )
    .in('id', issueIds);

  if (!nested.error && nested.data) {
    for (const row of nested.data as Record<string, unknown>[]) {
      const seriesRaw = row.series as Record<string, unknown> | Record<string, unknown>[] | null;
      const series = Array.isArray(seriesRaw) ? seriesRaw[0] : seriesRaw;
      const publisherRaw = series?.publishers as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | null
        | undefined;
      // also accept publisher alias if schema uses that embed name
      const publisherAlt = series?.publisher as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | null
        | undefined;
      const publisher = Array.isArray(publisherRaw)
        ? publisherRaw[0]
        : publisherRaw ?? (Array.isArray(publisherAlt) ? publisherAlt[0] : publisherAlt);

      const id = String(row.id);
      map.set(id, {
        id,
        issue_number: String(row.issue_number ?? '-'),
        title: (row.title as string | null) ?? null,
        cover_url: (row.cover_url as string | null) ?? null,
        series: series
          ? {
              title: String(series.title ?? 'Άγνωστη σειρά'),
              category: (series.category as string | null) ?? null,
              publisher: publisher ? { name: String(publisher.name ?? '—') } : null,
            }
          : null,
      });
    }
    return map;
  }

  // Flat fallback — no joins
  const flat = await supabase
    .from('issues')
    .select('id, issue_number, title, cover_url, series_id')
    .in('id', issueIds);

  if (flat.error || !flat.data) return map;

  const seriesIds = [
    ...new Set(
      flat.data
        .map((r: { series_id?: string | null }) => r.series_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const seriesById = new Map<string, { title: string; category: string | null; publisher_id: string | null }>();
  const publisherById = new Map<string, string>();

  if (seriesIds.length > 0) {
    const { data: seriesRows } = await supabase
      .from('series')
      .select('id, title, category, publisher_id')
      .in('id', seriesIds);
    for (const s of seriesRows ?? []) {
      seriesById.set(String(s.id), {
        title: String(s.title ?? 'Άγνωστη σειρά'),
        category: (s.category as string | null) ?? null,
        publisher_id: (s.publisher_id as string | null) ?? null,
      });
    }

    const pubIds = [
      ...new Set(
        [...seriesById.values()]
          .map((s) => s.publisher_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (pubIds.length > 0) {
      const { data: pubs } = await supabase.from('publishers').select('id, name').in('id', pubIds);
      for (const p of pubs ?? []) {
        publisherById.set(String(p.id), String(p.name ?? '—'));
      }
    }
  }

  for (const row of flat.data as { id: string; issue_number?: string; title?: string | null; cover_url?: string | null; series_id?: string | null }[]) {
    const id = String(row.id);
    const seriesMeta = row.series_id ? seriesById.get(String(row.series_id)) : undefined;
    map.set(id, {
      id,
      issue_number: String(row.issue_number ?? '-'),
      title: row.title ?? null,
      cover_url: row.cover_url ?? null,
      series: seriesMeta
        ? {
            title: seriesMeta.title,
            category: seriesMeta.category,
            publisher: seriesMeta.publisher_id
              ? { name: publisherById.get(seriesMeta.publisher_id) ?? '—' }
              : null,
          }
        : null,
    });
  }

  return map;
}

export async function fetchUserCollection(options?: {
  /** Skip Metron/catalog cover+year lookups so the UI is not blocked on rate limits. */
  enrichCovers?: boolean;
}): Promise<CollectionItem[]> {
  const enrichCovers = options?.enrichCovers !== false;
  const supabase = requireSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw new Error(errMsg(userError));
  if (!user) return [];

  const { data: collections, error: collectionError } = await supabase
    .from('collections')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  if (collectionError) throw new Error(`Συλλογή: ${errMsg(collectionError)}`);
  const collectionId = collections?.[0]?.id;
  if (!collectionId) return [];

  // Flat items first — avoids embed/RLS failures on nested selects
  let itemRows: Record<string, unknown>[] | null = null;
  const withFlags = await supabase
    .from('collection_items')
    .select('id, quantity, condition_grade, notes, issue_id, is_read, is_wishlist, is_favorite, created_at')
    .eq('collection_id', collectionId)
    .order('created_at', { ascending: false });

  if (withFlags.error) {
    // Columns is_read / is_wishlist / is_favorite may be missing
    const basic = await supabase
      .from('collection_items')
      .select('id, quantity, condition_grade, notes, issue_id, created_at')
      .eq('collection_id', collectionId)
      .order('created_at', { ascending: false });
    if (basic.error) throw new Error(`Τεύχη συλλογής: ${errMsg(basic.error)}`);
    itemRows = (basic.data ?? []) as Record<string, unknown>[];
  } else {
    itemRows = (withFlags.data ?? []) as Record<string, unknown>[];
  }

  const issueIds = [
    ...new Set(
      itemRows
        .map((r) => (r.issue_id != null ? String(r.issue_id) : ''))
        .filter(Boolean),
    ),
  ];
  const issueMap = await fetchIssueDetailsMap(supabase, issueIds);

  const mapped = itemRows.map((raw) => {
    const issueId = raw.issue_id != null ? String(raw.issue_id) : '';
    const issue = issueId ? issueMap.get(issueId) ?? null : null;
    const normalized = normalizeRow({ ...raw, issue });
    const item = mapCollectionRow(normalized);
    if (!issue && issueId) {
      return {
        ...item,
        issueId,
        series: 'Προστέθηκε (χωρίς λεπτομέρειες)',
      };
    }
    return item;
  });

  const withFast = attachFastCatalogCovers(mapped);
  if (!enrichCovers) return withFast;

  if (issueIds.length === 0) return attachCatalogCovers(withFast);

  let withDbCovers = withFast;
  try {
    const { data: covers } = await supabase
      .from('unified_issue_search')
      .select('issue_id, cover_url')
      .in('issue_id', issueIds);

    const coverByIssueId = new Map<string, string>();
    for (const row of covers ?? []) {
      const issueId = String((row as { issue_id?: string }).issue_id ?? '');
      const coverUrl = (row as { cover_url?: string | null }).cover_url ?? '';
      if (issueId && isOfficialCoverUrl(coverUrl)) coverByIssueId.set(issueId, coverUrl);
    }

    withDbCovers = withFast.map((item) => {
      if (isOfficialCoverUrl(item.coverUrl)) return item;
      const coverUrl = item.issueId ? coverByIssueId.get(item.issueId) : undefined;
      return coverUrl ? { ...item, coverUrl } : item;
    });
  } catch {
    withDbCovers = withFast;
  }

  return attachCatalogCovers(withDbCovers);
}

async function attachCatalogCovers(items: CollectionItem[]): Promise<CollectionItem[]> {
  const missingCover = items.filter((i) => !isOfficialCoverUrl(i.coverUrl));
  const missingYear = items.filter((i) => !i.year);
  if (missingCover.length === 0 && missingYear.length === 0) return items;

  const coverResolved = new Map<string, string>();
  const yearResolved = new Map<string, string>();
  const uniqueKeys = [
    ...new Set(
      [...missingCover, ...missingYear].map((i) => `${i.series}::${i.issue}::${i.publisher}`),
    ),
  ].slice(0, 16);

  await Promise.all(
    uniqueKeys.map(async (key) => {
      const [series, issue, publisher] = key.split('::');
      try {
        const [cover, year] = await Promise.all([
          resolveCatalogCoverUrl({ series, issue, publisher }),
          resolveCatalogYear({ series, issue, publisher }),
        ]);
        if (isCatalogCoverUrl(cover)) coverResolved.set(key, cover);
        if (year) yearResolved.set(key, year);
      } catch {
        // Cover/year lookup is best-effort — never fail the collection list.
      }
    }),
  );

  if (coverResolved.size === 0 && yearResolved.size === 0) return items;

  const persist: { issueId: string; coverUrl: string }[] = [];
  const next = items.map((item) => {
    const key = `${item.series}::${item.issue}::${item.publisher}`;
    const catalogCover = coverResolved.get(key);
    const greekDisplay = displayedCollectionCover(item);
    const nextCover =
      greekDisplay && greekDisplay !== item.coverUrl
        ? greekDisplay
        : isOfficialCoverUrl(item.coverUrl)
          ? item.coverUrl
          : catalogCover ?? item.coverUrl;
    if (
      item.issueId &&
      isPersistableCoverUrl(nextCover) &&
      nextCover !== item.coverUrl &&
      (isMetronCoverUrl(item.coverUrl) || !isOfficialCoverUrl(item.coverUrl))
    ) {
      persist.push({ issueId: item.issueId, coverUrl: nextCover });
    }
    return {
      ...item,
      coverUrl: nextCover,
      year: item.year || yearResolved.get(key),
    };
  });

  if (persist.length && isSupabaseConfigured()) {
    void (async () => {
      try {
        const supabase = requireSupabase();
        await Promise.all(
          persist.slice(0, 16).map((row) =>
            supabase.from('issues').update({ cover_url: row.coverUrl }).eq('id', row.issueId),
          ),
        );
      } catch {
        // List already shows the official cover.
      }
    })();
  }

  return next;
}

export async function searchIssues(query: string): Promise<UnifiedIssueSearchRow[]> {
  const supabase = requireSupabase();
  const q = query.trim();
  if (!q) return [];

  const { data, error } = await supabase
    .from('unified_issue_search')
    .select('*')
    .or(
      [
        `series_title.ilike.%${q}%`,
        `issue_title.ilike.%${q}%`,
        `issue_number.ilike.%${q}%`,
        `publisher_name.ilike.%${q}%`,
        `isbn.ilike.%${q}%`,
        `barcode.ilike.%${q}%`,
      ].join(','),
    )
    .limit(25);

  if (error) {
    // View may not exist yet — fallback to issues table search.
    const { data: fallback, error: fallbackError } = await supabase
      .from('issues')
      .select(
        `
        id,
        issue_number,
        title,
        isbn,
        barcode,
        is_reprint,
        is_special_edition,
        series:series (
          title,
          category,
          publisher:publishers ( name )
        )
      `,
      )
      .or(`issue_number.ilike.%${q}%,title.ilike.%${q}%`)
      .limit(25);

    if (fallbackError) throw fallbackError;

    return (fallback ?? []).map((row: any) => ({
      issue_id: row.id,
      issue_number: row.issue_number,
      issue_title: row.title,
      series_title: row.series?.title,
      publisher_name: row.series?.publisher?.name,
      category: row.series?.category,
      barcode: row.barcode,
      isbn: row.isbn,
      is_reprint: row.is_reprint,
      is_special_edition: row.is_special_edition,
    }));
  }

  return data ?? [];
}

async function findOrCreateIssue(
  supabase: ReturnType<typeof requireSupabase>,
  input: AddCollectionItemInput,
): Promise<string> {
  const seriesName = input.series?.trim();
  const issueNumber = input.issue?.trim();
  const publisherName = input.publisher?.trim();

  if (!seriesName || !issueNumber) {
    throw new Error('Συμπλήρωσε σειρά και τεύχος.');
  }

  let publisherId: string | null = null;
  const cleanPublisher =
    publisherName && publisherName !== '—' && publisherName !== '-' ? publisherName : '';

  if (cleanPublisher) {
    const { data: pubs } = await supabase
      .from('publishers')
      .select('id')
      .ilike('name', cleanPublisher)
      .limit(1);

    if (pubs?.[0]) {
      publisherId = pubs[0].id;
    } else {
      const { data: newPub, error: pubErr } = await supabase
        .from('publishers')
        .insert({ name: cleanPublisher })
        .select('id')
        .single();
      if (pubErr) throw new Error(`Publisher: ${pubErr.message}`);
      publisherId = newPub.id;
    }
  }

  let seriesId: string | null = null;
  let seriesQuery = supabase.from('series').select('id, publisher_id').ilike('title', seriesName).limit(1);
  if (publisherId) {
    seriesQuery = seriesQuery.eq('publisher_id', publisherId);
  }
  const { data: existingSeries, error: seriesLookupErr } = await seriesQuery;
  if (seriesLookupErr) throw new Error(`Series lookup: ${seriesLookupErr.message}`);

  if (existingSeries?.[0]) {
    seriesId = existingSeries[0].id;
    const row = existingSeries[0] as { id: string; publisher_id?: string | null };
    if (publisherId && !row.publisher_id) {
      await supabase.from('series').update({ publisher_id: publisherId }).eq('id', seriesId);
    }
    if (input.category?.trim()) {
      await supabase.from('series').update({ category: input.category.trim() }).eq('id', seriesId);
    }
  } else {
    const insertData: Record<string, unknown> = {
      title: seriesName,
      category: input.category?.trim() || null,
    };
    if (publisherId) insertData.publisher_id = publisherId;

    const { data: newSeries, error: seriesErr } = await supabase
      .from('series')
      .insert(insertData)
      .select('id')
      .single();
    if (seriesErr) throw new Error(`Series: ${seriesErr.message}`);
    seriesId = newSeries.id;
  }

  const { data: existingIssue, error: issueLookupErr } = await supabase
    .from('issues')
    .select('id, cover_url')
    .eq('series_id', seriesId)
    .eq('issue_number', issueNumber)
    .limit(1);
  if (issueLookupErr) throw new Error(`Issue lookup: ${issueLookupErr.message}`);

  if (existingIssue?.[0]) {
    const currentCover = (existingIssue[0] as { cover_url?: string | null }).cover_url ?? undefined;
    const coverToSave = await resolveCoverForSave(input);
    const nextCover = pickIssueCoverUpdate(currentCover, coverToSave, input);
    if (nextCover && nextCover !== currentCover) {
      const { error: coverErr } = await supabase
        .from('issues')
        .update({ cover_url: nextCover })
        .eq('id', existingIssue[0].id);
      if (coverErr && !/cover_url/i.test(coverErr.message)) {
        // ignore non-schema errors for cover update
      }
    }
    return existingIssue[0].id;
  }

  const coverToSave = await resolveCoverForSave(input);
  const baseRow: Record<string, unknown> = {
    series_id: seriesId,
    issue_number: issueNumber,
    title: input.series,
  };

  let { data: newIssue, error: issueErr } = await supabase
    .from('issues')
    .insert({
      ...baseRow,
      ...(coverToSave ? { cover_url: coverToSave } : {}),
    })
    .select('id')
    .single();

  if (issueErr && /cover_url/i.test(issueErr.message)) {
    const retry = await supabase.from('issues').insert(baseRow).select('id').single();
    newIssue = retry.data;
    issueErr = retry.error;
  }

  if (issueErr) throw new Error(`Issue: ${issueErr.message}`);
  if (!newIssue?.id) throw new Error('Issue: δεν δημιουργήθηκε εγγραφή.');

  return newIssue.id;
}

async function uploadScanCover(localUri: string): Promise<string> {
  const supabase = requireSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Πρέπει να είσαι συνδεδεμένος.');

  const rawExt = localUri.split('.').pop()?.toLowerCase()?.split('?')[0] ?? 'jpg';
  const ext = ['png', 'jpg', 'jpeg', 'webp'].includes(rawExt) ? rawExt : 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const fileName = `covers/${user.id}/${Date.now()}.${ext === 'jpeg' ? 'jpg' : ext}`;

  let uploadData: Uint8Array | Blob;
  if (Platform.OS === 'web') {
    const res = await fetch(localUri);
    uploadData = await res.blob();
  } else {
    const FileSystem = await import('expo-file-system/legacy');
    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
    uploadData = bytes;
  }

  const { error } = await supabase.storage
    .from('listing-images')
    .upload(fileName, uploadData, { contentType: mimeType, upsert: true });
  if (error) throw new Error(`Upload cover: ${error.message}`);

  const { data } = supabase.storage.from('listing-images').getPublicUrl(fileName);
  return data.publicUrl;
}

async function resolveCoverForSave(input: AddCollectionItemInput): Promise<string | undefined> {
  const greekCatalog = resolveGreekEditionCoverUrl(
    input.series,
    input.issue,
    input.publisher,
  );
  if (isCatalogCoverUrl(greekCatalog)) return greekCatalog;

  if (isCatalogCoverUrl(input.coverUrl) && !isMetronCoverUrl(input.coverUrl)) {
    return input.coverUrl;
  }

  const catalog = await resolveCatalogCoverUrl({
    series: input.series,
    issue: input.issue,
    publisher: input.publisher,
    coverUrl: input.coverUrl,
  });
  if (isCatalogCoverUrl(catalog)) return catalog;

  const scan = input.scanUri || input.coverUrl;
  if (scan && !isHttpUrl(scan)) {
    try {
      return await uploadScanCover(scan);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export type AddCollectionItemInput = {
  issueId?: string;
  series?: string;
  issue?: string;
  publisher?: string;
  category?: string;
  condition?: string;
  quantity?: number;
  notes?: string;
  year?: string;
  /** Official catalog cover (https) */
  coverUrl?: string;
  /** Local scan photo — uploaded if no official cover */
  scanUri?: string;
};

export async function addCollectionItem(input: AddCollectionItemInput): Promise<string> {
  const supabase = requireSupabase();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error('Πρέπει να είσαι συνδεδεμένος για αποθήκευση στη συλλογή.');

  // Χρησιμοποιούμε catalog issueId ΜΟΝΟ αν δόθηκε ρητά.
  // Το fuzzy searchIssues("Batman 17") έπιανε λάθος τεύχος και χάνονταν Anubis/Gemini δεδομένα.
  let issueId = input.issueId?.trim() || undefined;
  if (!isSupabaseIssueId(issueId)) {
    issueId = undefined;
  }

  if (!issueId) {
    issueId = await findOrCreateIssue(supabase, input);
  } else {
    const coverToSave = await resolveCoverForSave(input);
    if (coverToSave) {
      await supabase.from('issues').update({ cover_url: coverToSave }).eq('id', issueId);
    }
  }

  const { data: collections, error: collectionError } = await supabase
    .from('collections')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1);

  if (collectionError) throw new Error(`Collection: ${collectionError.message}`);

  let collectionId = collections?.[0]?.id;

  if (!collectionId) {
    const { data: created, error: createError } = await supabase
      .from('collections')
      .insert({ user_id: user.id, name: 'Η συλλογή μου', is_public: false })
      .select('id')
      .single();

    if (createError) throw new Error(`Create collection: ${createError.message}`);
    collectionId = created.id;
  }

  const year = extractYear(input.year, input.notes);

  const { data, error } = await supabase.from('collection_items').insert({
    collection_id: collectionId,
    issue_id: issueId,
    quantity: input.quantity ?? 1,
    condition_grade: input.condition ?? 'VF',
    notes: withYearNote(input.notes, year),
  }).select('id').single();

  if (error) {
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('collection_items')
        .select('id')
        .eq('collection_id', collectionId)
        .eq('issue_id', issueId)
        .maybeSingle();
      if (existing?.id) return existing.id;
      return '';
    }
    throw new Error(`Αποθήκευση: ${error.message}`);
  }
  if (!data?.id) throw new Error('Αποθήκευση: δεν δημιουργήθηκε εγγραφή.');
  return data.id;
}

export async function updateCollectionItemFlags(
  itemId: string,
  flags: { isRead?: boolean; isWishlist?: boolean; isFavorite?: boolean },
): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('collection_items')
    .update({
      ...(flags.isRead !== undefined && { is_read: flags.isRead }),
      ...(flags.isWishlist !== undefined && { is_wishlist: flags.isWishlist }),
      ...(flags.isFavorite !== undefined && { is_favorite: flags.isFavorite }),
    })
    .eq('id', itemId);
  if (error) throw error;
}

export async function deleteCollectionItem(itemId: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from('collection_items')
    .delete()
    .eq('id', itemId);
  if (error) throw error;
}

export async function findCollectionItemId(series: string, issueNumber: string): Promise<string | null> {
  const items = await fetchUserCollection({ enrichCovers: false });
  const key = `${series.trim().toLowerCase().replace(/^the\s+/, '').replace(/\s+/g, ' ')}#${String(issueNumber).replace(/^#/, '').replace(/\.0+$/, '').trim()}`;
  const hit = items.find((item) => {
    const itemKey = `${item.series.trim().toLowerCase().replace(/^the\s+/, '').replace(/\s+/g, ' ')}#${String(item.issue).replace(/^#/, '').replace(/\.0+$/, '').trim()}`;
    return itemKey === key;
  });
  return hit?.id ?? null;
}

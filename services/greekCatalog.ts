import { isSupabaseConfigured } from '@/lib/env';
import {
  findTightGreekScanHits,
  rankGreekCatalogRows,
  searchGreekCatalogLocal,
  localGreekCatalogRows,
  type GreekCatalogHit,
  type GreekCatalogRow,
  type GreekCatalogSearchInfo,
} from '@/lib/greekCatalogMatch';
import { getSupabase } from '@/lib/supabase';

export type { GreekCatalogHit } from '@/lib/greekCatalogMatch';
export { searchGreekCatalogLocal } from '@/lib/greekCatalogMatch';

type RemoteIssueRow = {
  id: string;
  catalog_key: string;
  issue_number: string;
  title?: string | null;
  year?: number | null;
  cover_url?: string | null;
  source_url?: string | null;
  series?:
    | {
        id: string;
        catalog_key: string;
        name: string;
        publisher: string;
        aliases?: string[] | null;
        format?: string | null;
      }
    | {
        id: string;
        catalog_key: string;
        name: string;
        publisher: string;
        aliases?: string[] | null;
        format?: string | null;
      }[]
    | null;
};

function flattenRemote(data: RemoteIssueRow[]): GreekCatalogRow[] {
  return data.flatMap((issue) => {
    const series = Array.isArray(issue.series) ? issue.series[0] : issue.series;
    if (!series) return [];
    return [
      {
        issueId: issue.id,
        catalogKey: issue.catalog_key,
        seriesKey: series.catalog_key,
        seriesName: series.name,
        aliases: series.aliases ?? [],
        publisher: series.publisher,
        format: series.format ?? undefined,
        issueNumber: issue.issue_number,
        issueTitle: issue.title ?? undefined,
        year: issue.year ?? undefined,
        coverUrl: issue.cover_url ?? undefined,
        sourceUrl: issue.source_url ?? undefined,
      },
    ];
  });
}

async function loadRemoteRows(): Promise<GreekCatalogRow[] | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('greek_issues')
      .select(
        'id, catalog_key, issue_number, title, year, cover_url, source_url, series:greek_series ( id, catalog_key, name, publisher, aliases, format )',
      )
      .limit(5000);
    if (error || !data?.length) return null;
    const rows = flattenRemote(data as RemoteIssueRow[]);
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

/** Historical catalog: Supabase when migrated, otherwise local seed. */
export async function searchGreekCatalog(
  query: string,
  info?: GreekCatalogSearchInfo,
): Promise<GreekCatalogHit[]> {
  const q = query.trim();
  if (!q && !info?.title) return [];
  const remote = await loadRemoteRows();
  if (remote) return rankGreekCatalogRows(remote, q || info?.title || '', info);
  return searchGreekCatalogLocal(q || info?.title || '', info);
}

function mergeGreekCatalogHits(
  primary: GreekCatalogHit[],
  supplement: GreekCatalogHit[],
): GreekCatalogHit[] {
  if (!primary.length) return supplement.slice(0, 8);
  if (!supplement.length) return primary.slice(0, 8);

  const byKey = new Map<string, GreekCatalogHit>();
  for (const hit of primary) byKey.set(hit.catalogKey, hit);
  for (const hit of supplement) {
    const existing = byKey.get(hit.catalogKey);
    if (!existing) {
      byKey.set(hit.catalogKey, hit);
      continue;
    }
    if (!existing.coverUrl && hit.coverUrl) {
      byKey.set(hit.catalogKey, { ...existing, coverUrl: hit.coverUrl });
    }
  }
  return [...byKey.values()].slice(0, 8);
}

/** Cover scan: exact issue or album title, never the first issue of the franchise. */
export async function searchGreekCatalogTight(
  info: GreekCatalogSearchInfo,
): Promise<GreekCatalogHit[]> {
  if (!info.title?.trim()) return [];
  const localHits = findTightGreekScanHits(localGreekCatalogRows(), info);
  const remote = await loadRemoteRows();
  if (!remote) return localHits;
  const remoteHits = findTightGreekScanHits(remote, info);
  return mergeGreekCatalogHits(remoteHits, localHits);
}

export function resolveHistoricalGreekCoverUrl(
  series: string,
  issueNumber?: string,
  publisher?: string,
): string | undefined {
  const hits = searchGreekCatalogLocal(series, { title: series, issue: issueNumber, publisher });
  return hits.find((h) => h.coverUrl)?.coverUrl;
}

export function resolveHistoricalGreekYear(
  series: string,
  issueNumber?: string,
  publisher?: string,
): string | undefined {
  if (!issueNumber?.trim()) return undefined;
  const hits = searchGreekCatalogLocal(series, { title: series, issue: issueNumber, publisher });
  return hits.find((h) => h.year)?.year;
}

export async function resolveHistoricalGreekCoverUrlAsync(
  series: string,
  issueNumber?: string,
  publisher?: string,
): Promise<string | undefined> {
  const hits = await searchGreekCatalog(series, { title: series, issue: issueNumber, publisher });
  return hits.find((h) => h.coverUrl)?.coverUrl;
}

export async function resolveHistoricalGreekYearAsync(
  series: string,
  issueNumber?: string,
  publisher?: string,
): Promise<string | undefined> {
  if (!issueNumber?.trim()) return undefined;
  const hits = await searchGreekCatalog(series, { title: series, issue: issueNumber, publisher });
  return hits.find((h) => h.year)?.year;
}

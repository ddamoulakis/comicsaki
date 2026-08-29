/**
 * Metron Cloud API service
 * https://metron.cloud/api/v1/
 * Auth: HTTP Basic (username + password)
 * License: CC-BY-SA — commercial use permitted with attribution
 */

import { metronGetJson } from '@/lib/metronClient';
import type { CoverEdition, CoverMatch, EditionKind } from '@/types/coverLookup';
import { editionKindLabels } from '@/types/coverLookup';

async function metronGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  return metronGetJson<T>(path, params);
}

// ─── Metron API response shapes ───────────────────────────────────────────────

type MetronIssue = {
  id: number;
  series: {
    id: number;
    name: string;
    volume: number;
    year_began: number;
  };
  number: string;
  /** Display name from list endpoint, e.g. "Amazing Spider-Man (1963) #300 Facsimile". */
  issue?: string | null;
  cover_date: string | null;
  store_date: string | null;
  image: string | null;
  publisher: { id: number; name: string } | null;
  cv_id: number | null;
  gcd_id: number | null;
};

export function inferEditionKind(text: string): { kind: EditionKind; shortLabel: string } {
  const t = text.toLowerCase();
  if (/\bfacsimile\b/.test(t)) return { kind: 'facsimile', shortLabel: editionKindLabels.facsimile };
  if (/\b2nd\s*print|\bsecond\s*print/.test(t)) {
    return { kind: '2nd_print', shortLabel: editionKindLabels['2nd_print'] };
  }
  if (/\b3rd\s*print|\bthird\s*print|\breprint\b/.test(t)) {
    return { kind: 'reprint', shortLabel: editionKindLabels.reprint };
  }
  if (/\bvariant\b|\bcover\s*[b-z]\b|\bvirgin\b|\bincentive\b/.test(t)) {
    return { kind: 'variant', shortLabel: editionKindLabels.variant };
  }
  return { kind: '1st_print', shortLabel: editionKindLabels['1st_print'] };
}

type MetronListResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

// ─── Public search function ────────────────────────────────────────────────────

export type MetronSearchResult = {
  matches: CoverMatch[];
  total: number;
};

/**
 * Search Metron for issues matching a series title + optional issue number.
 * Maps results to CoverMatch objects ready for the cover-results screen.
 */
export async function searchMetronIssues(
  seriesQuery: string,
  issueNumber?: string,
  opts?: { pageSize?: number; fallbackWithoutNumber?: boolean },
): Promise<MetronSearchResult> {
  const params: Record<string, string> = {
    series_q: seriesQuery,
    page_size: String(opts?.pageSize ?? 25),
  };

  if (issueNumber && issueNumber !== '-') {
    params.number = issueNumber;
  }

  const data = await metronGet<MetronListResponse<MetronIssue>>('/issue/', params);

  if (!data.results || data.results.length === 0) {
    if (issueNumber && opts?.fallbackWithoutNumber !== false) {
      const broader = await metronGet<MetronListResponse<MetronIssue>>('/issue/', {
        series_q: seriesQuery,
        page_size: '10',
      });
      return {
        matches: broader.results.map(issueToMatch),
        total: broader.count,
      };
    }
    return { matches: [], total: 0 };
  }

  return {
    matches: data.results.map(issueToMatch),
    total: data.count,
  };
}

async function searchIssueList(params: Record<string, string>): Promise<MetronSearchResult> {
  const data = await metronGet<MetronListResponse<MetronIssue>>('/issue/', {
    page_size: '25',
    ...params,
  });
  const results = data.results ?? [];
  return {
    matches: results.map(issueToMatch),
    total: data.count ?? results.length,
  };
}

/** Exact UPC as stored in Metron (often 12-digit UPC-A + 5-digit add-on). */
export async function searchMetronByUpc(upc: string): Promise<MetronSearchResult> {
  const value = upc.trim();
  if (!value) return { matches: [], total: 0 };
  return searchIssueList({ upc: value });
}

/**
 * Prefix match for mobile scanners that drop the 5-digit EAN add-on.
 * https://github.com/Metron-Project/metron/blob/master/api/README.md
 */
export async function searchMetronByUpcPrefix(upc12: string): Promise<MetronSearchResult> {
  const value = upc12.trim();
  if (!value) return { matches: [], total: 0 };
  return searchIssueList({ upc_starts_with: value });
}

export async function searchMetronByIsbn(isbn: string): Promise<MetronSearchResult> {
  const value = isbn.trim();
  if (!value) return { matches: [], total: 0 };
  return searchIssueList({ isbn: value });
}

/**
 * Official Metron cover URL for series + issue (not the user's scan photo).
 */
export async function resolveMetronCoverUrl(
  series: string,
  issueNumber?: string,
): Promise<string | undefined> {
  const meta = await resolveMetronIssueMeta(series, issueNumber);
  return meta?.coverUrl;
}

export async function resolveMetronIssueMeta(
  series: string,
  issueNumber?: string,
): Promise<{ coverUrl?: string; year?: string } | undefined> {
  const seriesQ = series.trim();
  if (!seriesQ) return undefined;
  try {
    const { matches } = await searchMetronIssues(
      seriesQ,
      issueNumber && issueNumber !== '-' ? issueNumber : undefined,
    );
    const exact = issueNumber
      ? matches.find((m) => String(m.issue).trim() === String(issueNumber).trim())
      : undefined;
    const pick = exact ?? matches[0];
    if (!pick) return undefined;
    return {
      coverUrl: pick.coverUrl,
      year: pick.editions?.[0]?.year || undefined,
    };
  } catch {
    return undefined;
  }
}

function issueToMatch(issue: MetronIssue): CoverMatch {
  const seriesName = issue.series?.name ?? 'Unknown Series';
  // Never fallback to series title for publisher (it creates wrong "publisher" values).
  const publisherName = issue.publisher?.name ?? '—';
  const year =
    issue.cover_date?.substring(0, 4) ||
    issue.store_date?.substring(0, 4) ||
    '';
  // Μην χρησιμοποιείς series.year_began ως fallback — βάζει λάθος έτος (π.χ. 1980 αντί 1993)

  const editionBlob = [seriesName, issue.issue, issue.number].filter(Boolean).join(' ');
  const { kind, shortLabel } = inferEditionKind(editionBlob);

  const editions: CoverEdition[] = [
    {
      id: `metron-${issue.id}-${kind}`,
      issueId: String(issue.id),
      kind,
      label: year ? `${shortLabel} · ${year}` : shortLabel,
      year: year || undefined,
      publisher: publisherName !== '—' ? publisherName : undefined,
      confidence: 0.9,
      sourceName: 'Metron',
    },
  ];

  return {
    id: `metron-${issue.id}`,
    issueId: String(issue.id),
    series: seriesName,
    issue: issue.number ?? '-',
    title: `${seriesName} #${issue.number ?? ''}`.trim(),
    publisher: publisherName,
    category: /marvel|dc\b/i.test(publisherName) ? 'Super ήρωες' : undefined,
    coverUrl: issue.image ?? undefined,
    confidence: 0.9,
    sourceName: 'Metron',
    editions,
  };
}

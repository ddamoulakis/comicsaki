/**
 * Manual-entry verification: catalog existence check + optional cover image match.
 * Text finds candidates; visual match (when a photo is provided) confirms the pick
 * and supplies official publisher / series / issue / year / cover.
 */

import { detectComicMarket, isGreekLicenseePublisher } from '@/lib/comicLanguage';
import { isOfficialCoverUrl } from '@/lib/coverUrl';
import { rankCoversByVisualMatch } from '@/lib/coverSimilarity';
import { isMetronConfigured } from '@/lib/env';
import { lookupCoverByText } from '@/services/coverLookup';
import { searchMetronIssues } from '@/services/metron';
import type { CoverEdition, CoverMatch } from '@/types/coverLookup';

const VISUAL_VERIFY_MIN = 0.68;
const TEXT_VERIFY_MIN = 0.82;

export type ManualVerifyCandidate = {
  match: CoverMatch;
  edition: CoverEdition;
  visualScore: number;
  textScore: number;
  /** Strong enough to treat fields as catalog-confirmed. */
  verified: boolean;
};

export type ManualVerifyResult = {
  status: 'verified' | 'ambiguous' | 'not_found';
  candidates: ManualVerifyCandidate[];
  best: ManualVerifyCandidate | null;
  usedVisual: boolean;
  market: 'greek' | 'foreign';
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u0370-\u03ff\u1f00-\u1fff]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleSimilarity(expected: string, candidate: string): number {
  const a = normalize(expected);
  const b = normalize(candidate);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.85;
  const aTokens = a.split(' ').filter((t) => t.length > 1);
  const bTokens = b.split(' ').filter((t) => t.length > 1);
  if (!aTokens.length || !bTokens.length) return 0;
  const overlap = aTokens.filter((t) => bTokens.includes(t)).length;
  return overlap / Math.max(aTokens.length, bTokens.length);
}

function textScoreFor(
  input: { series: string; issue: string; publisher?: string; year?: string },
  match: CoverMatch,
  edition: CoverEdition,
): number {
  const seriesSim = titleSimilarity(input.series, match.series || match.title || '');
  const hasIssue = Boolean(input.issue.trim()) && input.issue.trim() !== '-';
  const pub = normalize(input.publisher ?? '');
  const pubHit =
    pub &&
    (normalize(match.publisher).includes(pub) ||
      normalize(edition.publisher ?? '').includes(pub) ||
      normalize(pub).includes(normalize(match.publisher).slice(0, 5)))
      ? 1
      : 0;
  const yearHit =
    input.year?.trim() && edition.year && edition.year === input.year.trim() ? 1 : 0;

  // Series-only search: rank by title (+ publisher), don't require issue yet.
  if (!hasIssue) {
    return seriesSim * 0.85 + pubHit * 0.15;
  }

  const issueExact =
    String(match.issue).trim() === input.issue.trim() ? 1 : 0;
  const issueLoose = String(match.issue)
    .toLowerCase()
    .includes(input.issue.trim().toLowerCase())
    ? 0.5
    : 0;

  return seriesSim * 0.55 + Math.max(issueExact, issueLoose) * 0.3 + pubHit * 0.1 + yearHit * 0.05;
}

function catalogCoverUrl(match: CoverMatch): string {
  return isOfficialCoverUrl(match.coverUrl) ? match.coverUrl : '';
}

export function fieldsFromCandidate(c: ManualVerifyCandidate) {
  const { match, edition } = c;
  return {
    issueId: edition.issueId ?? match.issueId,
    publisher: edition.publisher || match.publisher || '',
    series: match.series || '',
    issue: match.issue === '-' ? '' : match.issue || '',
    year: edition.year || '',
    edition: edition.label || '',
    category: match.category || '',
    coverUrl: catalogCoverUrl(match),
    sourceName: match.sourceName,
  };
}

async function fetchCatalogMatches(input: {
  series: string;
  issue: string;
  publisher?: string;
}): Promise<{ matches: CoverMatch[]; market: 'greek' | 'foreign' }> {
  const series = input.series.trim();
  const issue = input.issue.trim();
  const publisher = (input.publisher ?? '').trim();
  const query = [series, issue, publisher].filter(Boolean).join(' ');
  const market = detectComicMarket(query, series, publisher);

  if (market === 'greek') {
    let local: CoverMatch[] = [];
    try {
      const result = await lookupCoverByText(query);
      local = result.matches;
      const hasOfficial = local.some((m) => isOfficialCoverUrl(m.coverUrl));
      if (hasOfficial || !isMetronConfigured() || !isGreekLicenseePublisher(publisher || series)) {
        return { matches: local, market: 'greek' };
      }
    } catch {
      // try Metron below
    }
    if (isMetronConfigured()) {
      try {
        const { matches } = await searchMetronIssues(series, issue || undefined);
        if (matches.length) return { matches: [...matches, ...local], market: 'greek' };
      } catch {
        // fall through
      }
    }
    return { matches: local, market: 'greek' };
  }

  if (isMetronConfigured()) {
    const { matches } = await searchMetronIssues(series, issue || undefined);
    if (matches.length) return { matches, market: 'foreign' };
  }

  try {
    const result = await lookupCoverByText(query);
    return { matches: result.matches, market: 'foreign' };
  } catch {
    return { matches: [], market: 'foreign' };
  }
}

/**
 * Search catalog from whatever fields the user typed (series required).
 * Issue / publisher / photo are optional filters that improve ranking.
 * With photoUri, prefer the candidate whose official cover matches the photo.
 */
export async function verifyManualEntry(input: {
  series: string;
  issue?: string;
  publisher?: string;
  year?: string;
  photoUri?: string | null;
}): Promise<ManualVerifyResult> {
  const series = input.series.trim();
  const issue = (input.issue ?? '').trim();
  const hasIssue = Boolean(issue) && issue !== '-';

  if (series.length < 2) {
    return {
      status: 'not_found',
      candidates: [],
      best: null,
      usedVisual: false,
      market: 'foreign',
    };
  }

  let matches: CoverMatch[] = [];
  let market: 'greek' | 'foreign' = 'foreign';
  try {
    const found = await fetchCatalogMatches({
      series,
      issue: hasIssue ? issue : '',
      publisher: input.publisher,
    });
    matches = found.matches;
    market = found.market;
  } catch {
    return {
      status: 'not_found',
      candidates: [],
      best: null,
      usedVisual: false,
      market,
    };
  }

  if (!matches.length) {
    return {
      status: 'not_found',
      candidates: [],
      best: null,
      usedVisual: false,
      market,
    };
  }

  const photoUri = input.photoUri?.trim() || '';
  let visualById = new Map<string, number>();
  let usedVisual = false;

  if (photoUri) {
    try {
      const ranked = await Promise.race([
        rankCoversByVisualMatch(photoUri, matches),
        new Promise<Array<CoverMatch & { visualScore: number }>>((resolve) =>
          setTimeout(
            () => resolve(matches.map((m) => ({ ...m, visualScore: 0 }))),
            10000,
          ),
        ),
      ]);
      usedVisual = ranked.some((m) => m.visualScore > 0);
      visualById = new Map(ranked.map((m) => [m.id, m.visualScore]));
    } catch {
      usedVisual = false;
    }
  }

  const flat: ManualVerifyCandidate[] = [];
  for (const match of matches) {
    const edition = match.editions[0];
    if (!edition) continue;
    const textScore = textScoreFor(
      { series, issue: hasIssue ? issue : '', publisher: input.publisher, year: input.year },
      match,
      edition,
    );
    const visualScore = visualById.get(match.id) ?? 0;
    const verified = usedVisual
      ? visualScore >= VISUAL_VERIFY_MIN && textScore >= 0.35
      : hasIssue &&
        textScore >= TEXT_VERIFY_MIN &&
        String(match.issue).trim() === issue &&
        Boolean(catalogCoverUrl(match) || edition.year);

    flat.push({ match, edition, visualScore, textScore, verified });
  }

  flat.sort((a, b) => {
    if (usedVisual && Math.abs(b.visualScore - a.visualScore) > 0.03) {
      return b.visualScore - a.visualScore;
    }
    if (b.verified !== a.verified) return a.verified ? -1 : 1;
    if (hasIssue) {
      const aExact = String(a.match.issue).trim() === issue ? 1 : 0;
      const bExact = String(b.match.issue).trim() === issue ? 1 : 0;
      if (bExact !== aExact) return bExact - aExact;
    }
    return b.textScore - a.textScore;
  });

  const candidates = flat.slice(0, 8);
  const best = candidates[0] ?? null;
  const verifiedCount = candidates.filter((c) => c.verified).length;

  let status: ManualVerifyResult['status'] = 'not_found';
  if (best?.verified && (verifiedCount === 1 || (usedVisual && best.visualScore >= VISUAL_VERIFY_MIN))) {
    status = 'verified';
  } else if (candidates.length > 0) {
    status = 'ambiguous';
  }

  return { status, candidates, best, usedVisual, market };
}

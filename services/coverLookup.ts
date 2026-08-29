import { isSupabaseConfigured, isMetronConfigured } from '@/lib/env';
import { detectComicMarket, foldComicText } from '@/lib/comicLanguage';
import { isCatalogCoverUrl, isOfficialCoverUrl } from '@/lib/coverUrl';
import { lookupExactGreekCatalogCover } from '@/lib/greekCatalogMatch';
import { lookupCoverFromQuery } from '@/services/supabase/lookupCover';
import { extractComicInfoFromOcr } from '@/services/visionOcr';
import { searchIssues } from '@/services/supabase/collection';
import { searchGreekCatalog, searchGreekCatalogTight, type GreekCatalogHit } from '@/services/greekCatalog';
import { greekFormatLabel, resolveGreekIssueNumber } from '@/lib/greekFormat';
import { searchMetronIssues } from '@/services/metron';
import { recognizeComicCover, type ComicRecognitionResult } from '@/services/geminiVision';
import type { CoverLookupResult, CoverMatch } from '@/types/coverLookup';

function normalize(value: string): string {
  return value
    .toLowerCase()
    // Keep Latin + Greek letters for ranking Greek titles
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

function rankMatchesByOcr(info: { title: string; issue: string; publisher: string }, matches: CoverMatch[]) {
  const expectedIssue = info.issue.trim();
  const expectedPublisher = normalize(info.publisher);

  return [...matches]
    .map((m) => {
      const sim = titleSimilarity(info.title, m.series || m.title || '');
      const issueExact = expectedIssue && m.issue?.trim() === expectedIssue ? 1 : 0;
      const issueLoose =
        expectedIssue && m.issue?.toLowerCase().includes(expectedIssue.toLowerCase()) ? 1 : 0;
      const publisherHit =
        expectedPublisher && normalize(m.publisher || '').includes(expectedPublisher) ? 1 : 0;

      const score = sim * 100 + issueExact * 80 + issueLoose * 20 + publisherHit * 10;
      return { m, score };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.m);
}

function confidenceScore(c: ComicRecognitionResult['confidence']): number {
  return c === 'high' ? 0.92 : c === 'medium' ? 0.78 : 0.6;
}

function normalizeIssueNum(value: string | undefined): string {
  const raw = String(value ?? '')
    .trim()
    .replace(/^#/, '')
    .replace(/\.0+$/, '');
  const m = raw.match(/^(\d{1,4})/);
  return m ? String(Number(m[1])) : '';
}

function publisherMatches(expected: string, candidate: string): boolean {
  const a = normalize(expected);
  const b = normalize(candidate);
  if (!a || !b || b === '-') return true;
  if (a.includes(b) || b.includes(a)) return true;
  const tokens = a.split(' ').filter((t) => t.length > 2);
  return tokens.some((t) => b.includes(t));
}

function titleSimilarityForCover(expected: string, candidate: string): number {
  const a = foldComicText(expected);
  const b = foldComicText(candidate);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aTokens = a.split(' ').filter((t) => t.length > 1);
  const bTokens = b.split(' ').filter((t) => t.length > 1);
  if (!aTokens.length || !bTokens.length) return 0;
  const overlap = aTokens.filter((t) => bTokens.includes(t)).length;
  return Math.min(overlap / aTokens.length, overlap / bTokens.length);
}

function coverTitleOk(gemini: ComicRecognitionResult, match: CoverMatch): boolean {
  const expectedIssue = normalizeIssueNum(gemini.issue);
  const g = foldComicText(gemini.series);
  const series = foldComicText(match.series);
  const album = foldComicText(match.title || '');

  if (expectedIssue) {
    if (normalizeIssueNum(match.issue) !== expectedIssue) return false;
    if (g === series || (album && g === album)) return true;
    if (album && album !== series && album.length >= 5 && g.includes(album)) return true;
    return (
      titleSimilarityForCover(gemini.series, match.series) >= 0.55 ||
      titleSimilarityForCover(gemini.series, match.title || '') >= 0.55
    );
  }

  if (album && album !== series) {
    if (g === album) return true;
    if (album.length >= 5 && g.includes(album)) return true;
    const afterColon = foldComicText(gemini.series.split(/[:：]/).slice(1).join(':'));
    if (
      afterColon.length >= 4 &&
      (album === afterColon || album.includes(afterColon) || afterColon.includes(album))
    ) {
      return true;
    }
    return false;
  }

  return g === series && !normalizeIssueNum(match.issue);
}

function isTightCatalogHit(gemini: ComicRecognitionResult, match: CoverMatch): boolean {
  if (!coverTitleOk(gemini, match)) return false;
  return publisherMatches(gemini.publisher, match.publisher);
}

function bestOfficialCover(gemini: ComicRecognitionResult, catalog: CoverMatch[]): CoverMatch | undefined {
  const hits = catalog.filter((m) => coverTitleOk(gemini, m) && isCatalogCoverUrl(m.coverUrl));
  if (!hits.length) return undefined;
  return [...hits].sort((a, b) => {
    const sa = Math.max(
      titleSimilarityForCover(gemini.series, a.title || ''),
      titleSimilarityForCover(gemini.series, a.series),
    );
    const sb = Math.max(
      titleSimilarityForCover(gemini.series, b.title || ''),
      titleSimilarityForCover(gemini.series, b.series),
    );
    return sb - sa;
  })[0];
}

function mergeGeminiWithCatalogCover(
  geminiMatch: CoverMatch,
  gemini: ComicRecognitionResult,
  catalog: CoverMatch[],
): CoverMatch[] {
  const tight = catalog.filter((m) => isTightCatalogHit(gemini, m));
  const exactGreek = lookupExactGreekCatalogCover(
    gemini.series,
    gemini.issue,
    gemini.publisher,
  );
  const withCover = bestOfficialCover(gemini, catalog);
  const best = withCover ?? tight.find((m) => isCatalogCoverUrl(m.coverUrl)) ?? tight[0];
  const official =
    withCover?.coverUrl ||
    (best && isCatalogCoverUrl(best.coverUrl) ? best.coverUrl : undefined) ||
    exactGreek;

  const primary: CoverMatch = {
    ...geminiMatch,
    issueId: best?.issueId ?? geminiMatch.issueId,
    series: best?.series || geminiMatch.series,
    issue: best?.issue || geminiMatch.issue,
    category: geminiMatch.category || best?.category,
    releaseFormat: geminiMatch.releaseFormat || best?.releaseFormat,
    coverUrl: official,
    editions: geminiMatch.editions.map((ed) => ({
      ...ed,
      issueId: best?.issueId ?? ed.issueId,
      year: ed.year || gemini.year || best?.editions[0]?.year,
      publisher: gemini.publisher || ed.publisher,
      notes: gemini.notes || ed.notes,
    })),
  };

  const extras = tight.filter((m) => m.id !== best?.id && m.id !== geminiMatch.id);
  return [primary, ...extras];
}

/** US licensed reprints — Metron only when the bundled Greek catalog has no cover. */
function mayUseMetronForGreekCover(gemini: ComicRecognitionResult): boolean {
  if (!normalizeIssueNum(gemini.issue)) return false;
  if (!/\b(anubis|jemma|modern\s*times)\b/i.test(gemini.publisher)) return false;
  return !lookupExactGreekCatalogCover(gemini.series, gemini.issue, gemini.publisher);
}

async function withMetronCoverFallback(
  gemini: ComicRecognitionResult,
  geminiMatch: CoverMatch,
  catalog: CoverMatch[],
): Promise<CoverMatch[]> {
  const merged = catalog.length
    ? mergeGeminiWithCatalogCover(geminiMatch, gemini, catalog)
    : [{ ...geminiMatch, coverUrl: isOfficialCoverUrl(geminiMatch.coverUrl) ? geminiMatch.coverUrl : undefined }];

  if (merged.some((m) => isCatalogCoverUrl(m.coverUrl))) return merged;

  const exactGreek = lookupExactGreekCatalogCover(
    gemini.series,
    gemini.issue,
    gemini.publisher,
  );
  if (exactGreek) {
    return merged.map((m, index) =>
      index === 0 ? { ...m, coverUrl: exactGreek } : m,
    );
  }

  if (!isMetronConfigured() || !mayUseMetronForGreekCover(gemini)) return merged;

  try {
    const expectedIssue = normalizeIssueNum(gemini.issue);
    const { matches } = await searchMetronIssues(gemini.series.trim(), expectedIssue);
    if (!matches.length) return merged;

    const sameIssue = matches.filter((m) => normalizeIssueNum(m.issue) === expectedIssue);
    if (!sameIssue.length) return merged;

    return mergeGeminiWithCatalogCover(geminiMatch, gemini, sameIssue);
  } catch {
    return merged;
  }
}

/**
 * Gemini identifies title/issue/publisher. Official cover comes from the
 * Greek catalog, or Metron for licensed reprints (Anubis Batman, etc.).
 */
export async function enrichGeminiWithCatalog(
  gemini: ComicRecognitionResult,
  photoUri: string,
): Promise<CoverLookupResult> {
  const queryHint = [gemini.series, resolveGreekIssueNumber(gemini) || gemini.issue]
    .filter(Boolean)
    .join(' #');
  const geminiMatch = buildMatchFromGemini(gemini, photoUri);
  const market: 'greek' | 'foreign' =
    gemini.language === 'el' ||
    detectComicMarket(gemini.series, gemini.publisher, gemini.raw, gemini.language ?? '') ===
      'greek'
      ? 'greek'
      : 'foreign';

  if (market === 'greek') {
    return enrichWithLocalCatalog(gemini, geminiMatch, photoUri, queryHint);
  }

  if (!isMetronConfigured()) {
    const local = await enrichWithLocalCatalog(gemini, geminiMatch, photoUri, queryHint);
    if (local.matches.some((m) => m.sourceName !== 'Gemini AI' && isOfficialCoverUrl(m.coverUrl)))
      return local;
    return { photoUri, queryHint, matches: [geminiMatch], usedDemo: false };
  }

  try {
    const expectedIssue = normalizeIssueNum(gemini.issue);
    const { matches } = await searchMetronIssues(
      gemini.series.trim(),
      expectedIssue || undefined,
    );

    if (!matches.length) {
      return { photoUri, queryHint, matches: [geminiMatch], usedDemo: false };
    }

    const pool = expectedIssue
      ? matches.filter((m) => normalizeIssueNum(m.issue) === expectedIssue)
      : [];
    if (!pool.length) {
      return { photoUri, queryHint, matches: [geminiMatch], usedDemo: false };
    }

    return {
      photoUri,
      queryHint,
      matches: mergeGeminiWithCatalogCover(geminiMatch, gemini, pool),
      usedDemo: false,
    };
  } catch {
    return { photoUri, queryHint, matches: [geminiMatch], usedDemo: false };
  }
}

function catalogHasHit(result: CoverLookupResult): boolean {
  return result.matches.some((m) => m.sourceName !== 'Gemini AI');
}

/** Empty title, or low-confidence Gemini with no catalog row → manual correction. */
export function isUncertainCoverMatch(
  gemini: ComicRecognitionResult,
  result: CoverLookupResult,
): boolean {
  if (!gemini.series.trim()) return true;
  return gemini.confidence === 'low' && !catalogHasHit(result);
}

function mergeSameIssueEditions(matches: CoverMatch[]): CoverMatch[] {
  if (matches.length < 2) return matches;
  const primary = matches[0];
  const extra: CoverMatch['editions'] = [];
  const rest: CoverMatch[] = [];

  for (const m of matches.slice(1)) {
    const sameIssue = normalizeIssueNum(m.issue) === normalizeIssueNum(primary.issue);
    const sameSeries = titleSimilarity(primary.series, m.series) >= 0.8;
    if (!sameIssue || !sameSeries || !m.editions[0]) {
      rest.push(m);
      continue;
    }
    extra.push(
      ...m.editions.map((ed) => {
        if (ed.kind !== '1st_print') return ed;
        return {
          ...ed,
          kind: 'variant' as const,
          label: ed.label.replace(/1η εκτύπωση/i, 'Variant cover'),
        };
      }),
    );
  }

  if (!extra.length) return matches;
  return [{ ...primary, editions: [...primary.editions, ...extra] }, ...rest];
}

function rankGreekScanMatches(matches: CoverMatch[], expectedIssue: string): CoverMatch[] {
  if (!matches.length) return matches;
  return [...matches].sort((a, b) => {
    const aExact = expectedIssue && normalizeIssueNum(a.issue) === expectedIssue ? 1 : 0;
    const bExact = expectedIssue && normalizeIssueNum(b.issue) === expectedIssue ? 1 : 0;
    return bExact - aExact;
  });
}

async function enrichWithLocalCatalog(
  gemini: ComicRecognitionResult,
  geminiMatch: CoverMatch,
  photoUri: string,
  queryHint: string,
): Promise<CoverLookupResult> {
  const issueNum = resolveGreekIssueNumber({
    issue: gemini.issue,
    volume: gemini.volume,
    format: gemini.format,
    notes: gemini.notes,
  });
  const info = {
    title: gemini.series.trim(),
    issue: issueNum,
    publisher: gemini.publisher.trim(),
    format: gemini.format,
  };
  let catalogMatches: CoverMatch[] = [];
  try {
    const greekHits = await searchGreekCatalogTight(info);
    catalogMatches = greekHits.map(matchFromGreekHit);
  } catch {
    // keep Gemini fields if the local catalog is unavailable
  }

  return {
    photoUri,
    queryHint,
    matches: await withMetronCoverFallback(gemini, geminiMatch, catalogMatches),
    usedDemo: false,
  };
}

export function buildMatchFromGemini(
  result: ComicRecognitionResult,
  coverUri?: string,
): CoverMatch {
  const conf = confidenceScore(result.confidence);
  const issueNum = resolveGreekIssueNumber({
    issue: result.issue,
    volume: result.volume,
    format: result.format,
    notes: result.notes,
  });
  const formatLabel = greekFormatLabel(result.format);
  const seriesLabel =
    issueNum && result.format === 'τόμος'
      ? `${result.series} (Τόμος ${issueNum})`
      : issueNum
        ? `${result.series} #${issueNum}`
        : result.volume && result.series
          ? `${result.series} (Vol. ${result.volume})`
          : result.series || 'Αναγνωρισμένο κόμικ';

  return {
    id: `gemini-${Date.now()}`,
    series: result.series || 'Αναγνωρισμένο κόμικ',
    issue: issueNum || (result.language === 'el' ? '' : '-'),
    title: seriesLabel,
    publisher: result.publisher || '—',
    category: formatLabel
      ? `${result.category || 'Ελληνικά'} · ${formatLabel}`
      : result.category || undefined,
    releaseFormat: result.format,
    coverUrl: coverUri || undefined,
    confidence: conf,
    sourceName: 'Gemini AI',
    editions: [
      {
        id: `gemini-ed-${Date.now()}`,
        kind: 'unknown',
        label: result.publisher || formatLabel || '',
        year: result.year || undefined,
        publisher: result.publisher || undefined,
        confidence: conf,
        sourceName: 'Gemini AI',
        notes: [
          result.volume ? `Vol. ${result.volume}` : null,
          result.notes || null,
        ]
          .filter(Boolean)
          .join(' · ') || undefined,
      },
    ],
  };
}

function matchFromGreekHit(hit: GreekCatalogHit): CoverMatch {
  const confidence = hit.coverUrl ? 0.94 : 0.82;
  const formatLabel = greekFormatLabel(hit.format);
  const editionBits = [hit.publisher, hit.year].filter(Boolean);
  return {
    id: `greek-catalog-${hit.catalogKey}`,
    issueId: hit.issueId,
    series: hit.series,
    issue: hit.issue,
    title: hit.title || hit.series,
    publisher: hit.publisher || '—',
    category: formatLabel ? `Ελληνικά · ${formatLabel}` : 'Ελληνικά κόμικς',
    releaseFormat: hit.format,
    coverUrl: hit.coverUrl,
    confidence,
    sourceName: 'Κατάλογος Comicsάκι',
    sourceUrl: hit.sourceUrl,
    editions: [
      {
        id: `greek-catalog-ed-${hit.catalogKey}`,
        issueId: hit.issueId,
        kind: '1st_print',
        label: editionBits.join(' · ') || 'Ελληνική έκδοση',
        year: hit.year,
        publisher: hit.publisher || undefined,
        confidence,
        sourceName: 'Κατάλογος Comicsάκι',
        sourceUrl: hit.sourceUrl,
      },
    ],
  };
}

function dedupeMatches(matches: CoverMatch[]): CoverMatch[] {
  const seen = new Set<string>();
  const out: CoverMatch[] = [];
  for (const m of matches) {
    const key = `${normalize(m.series)}#${normalizeIssueNum(m.issue)}#${normalize(m.publisher)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

async function searchLocalCatalog(
  query: string,
  info: { title: string; issue: string; publisher: string },
  photoUri: string,
): Promise<CoverLookupResult | null> {
  if (!query.trim() && !info.title.trim()) return null;
  const matches: CoverMatch[] = [];

  try {
    const greekHits = await searchGreekCatalog(query.trim() || info.title, info);
    matches.push(...greekHits.map(matchFromGreekHit));
  } catch {
    // keep going — unified search may still hit
  }

  if (isSupabaseConfigured()) {
    try {
      const rows = await searchIssues(query.trim() || info.title);
      for (const row of rows.slice(0, 8)) {
        matches.push({
          id: `db-${row.issue_id}`,
          issueId: row.issue_id,
          series: row.series_title ?? row.issue_title ?? info.title,
          issue: row.issue_number ?? info.issue ?? '-',
          title: row.issue_title ?? row.series_title ?? '',
          publisher: row.publisher_name ?? info.publisher ?? '—',
          category: row.category ?? undefined,
          coverUrl: isOfficialCoverUrl(row.cover_url) ? row.cover_url : undefined,
          confidence: 0.85,
          sourceName: 'Comicsάκι Catalog',
          editions: [
            {
              id: `db-ed-${row.issue_id}`,
              issueId: row.issue_id,
              kind: row.is_reprint ? 'reprint' : row.is_special_edition ? 'special' : '1st_print',
              label: row.is_reprint
                ? 'Reprint'
                : row.is_special_edition
                  ? 'Special edition'
                  : '1η εκτύπωση',
              publisher: row.publisher_name ?? undefined,
              confidence: 0.85,
              sourceName: 'Comicsάκι Catalog',
            },
          ],
        });
      }
    } catch {
      // ignore missing view
    }
  }

  if (matches.length === 0) return null;
  return {
    photoUri,
    queryHint: query,
    matches: rankMatchesByOcr(info, dedupeMatches(matches)),
    usedDemo: false,
  };
}

export async function lookupCoverByText(
  query: string,
  photoUri = '',
): Promise<CoverLookupResult> {
  const queryInfo = extractComicInfoFromOcr(query);
  const titleForRank = queryInfo.title || query;
  const market = detectComicMarket(query, queryInfo.title, queryInfo.publisher);

  // Greek text search → local catalog, then Metron for licensed reprints without shop art.
  if (market === 'greek') {
    const local = await searchLocalCatalog(
      query,
      { title: titleForRank, issue: queryInfo.issue, publisher: queryInfo.publisher },
      photoUri,
    );
    const expectedIssue = normalizeIssueNum(queryInfo.issue);
    const localMatches = local?.matches.length
      ? rankGreekScanMatches(local.matches, expectedIssue)
      : [];
    const hasOfficial = localMatches.some((m) => isOfficialCoverUrl(m.coverUrl));

    if (!hasOfficial && isMetronConfigured() && titleForRank.trim()) {
      try {
        const { matches } = await searchMetronIssues(
          titleForRank.trim(),
          expectedIssue || undefined,
        );
        if (matches.length) {
          return {
            photoUri,
            queryHint: query,
            matches: [...matches, ...localMatches],
            usedDemo: false,
          };
        }
      } catch {
        // keep local
      }
    }

    if (localMatches.length) {
      return {
        photoUri,
        queryHint: query,
        matches: localMatches,
        usedDemo: false,
      };
    }

    throw new Error(
      `Δεν βρέθηκε στον ελληνικό κατάλογο: "${query}". Δοκίμασε χειροκίνητη καταχώρηση ή scan με Gemini.`,
    );
  }

  if (isMetronConfigured() && query.trim()) {
    try {
      const { matches } = await searchMetronIssues(query.trim());
      if (matches.length > 0) {
        const ranked = rankMatchesByOcr(
          { title: titleForRank, issue: queryInfo.issue, publisher: queryInfo.publisher },
          matches,
        );
        return {
          photoUri,
          queryHint: query,
          matches: mergeSameIssueEditions(ranked),
          usedDemo: false,
        };
      }
    } catch {
      // fallthrough
    }
  }

  if (isSupabaseConfigured()) {
    try {
      const result = await lookupCoverFromQuery(query, photoUri);
      if (result.matches.length > 0) return result;
    } catch {
      // fallthrough
    }

    const local = await searchLocalCatalog(
      query,
      { title: titleForRank, issue: queryInfo.issue, publisher: queryInfo.publisher },
      photoUri,
    );
    if (local) return local;
  }

  throw new Error(`Δεν βρέθηκαν αποτελέσματα για "${query}".`);
}

import { GREEK_CATALOG_ISSUES, GREEK_CATALOG_SERIES } from '@/data/greekCatalog';
import harvestJson from '@/data/greekCatalogHarvest.json';
import { foldComicText } from '@/lib/comicLanguage';
import {
  formatsCompatible,
  greekFormatLabel,
  inferGreekSeriesFormat,
  normalizeGreekFormat,
  type GreekReleaseFormat,
} from '@/lib/greekFormat';
import { greekcomicsCatalogRows } from '@/lib/greekcomicsCatalog';

export type GreekCatalogHit = {
  catalogKey: string;
  seriesKey: string;
  issueId: string;
  series: string;
  issue: string;
  title: string;
  publisher: string;
  year?: string;
  coverUrl?: string;
  sourceUrl?: string;
  format?: GreekReleaseFormat;
  score: number;
};

export type GreekCatalogSearchInfo = {
  title?: string;
  issue?: string;
  publisher?: string;
  format?: GreekReleaseFormat;
};

export type GreekCatalogRow = {
  issueId: string;
  catalogKey: string;
  seriesKey: string;
  seriesName: string;
  aliases: string[];
  publisher: string;
  format?: GreekReleaseFormat;
  issueNumber: string;
  issueTitle?: string;
  year?: number;
  coverUrl?: string;
  sourceUrl?: string;
};

function titleOverlap(a: string, b: string): number {
  const na = foldComicText(a);
  const nb = foldComicText(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (longer.includes(shorter)) {
    return 0.85 + 0.15 * (shorter.length / longer.length);
  }
  const wa = new Set(na.split(' ').filter((w) => w.length > 1));
  const wb = new Set(nb.split(' ').filter((w) => w.length > 1));
  if (wa.size === 0 || wb.size === 0) return 0;
  let hit = 0;
  for (const w of wa) if (wb.has(w)) hit += 1;
  return hit / Math.max(wa.size, wb.size);
}

function normalizeIssue(value: string | undefined): string {
  const raw = String(value ?? '')
    .trim()
    .replace(/^#/, '');
  if (!raw) return '';
  const m = raw.match(/^(\d{1,4})/);
  if (m) return String(Number(m[1]));
  return foldComicText(raw);
}

function parseIssueFromQuery(query: string): string {
  if (/δεκαετί/i.test(query)) return '';
  const hash = query.match(/#\s*(\d{1,4})\b/);
  if (hash) return String(Number(hash[1]));
  const tefchos = query.match(/\bτεύχος\s*[#:]?\s*(\d{1,4})\b/i);
  if (tefchos) return String(Number(tefchos[1]));
  const no = query.match(/\bno\.?\s*(\d{1,4})\b/i);
  if (no) return String(Number(no[1]));
  const trailing = query.match(/(?:^|\s)(\d{1,4})\s*$/);
  if (trailing) {
    const n = Number(trailing[1]);
    if (n >= 1930 && n <= 2035) return '';
    return String(n);
  }
  return '';
}

let cachedLocalRows: GreekCatalogRow[] | null = null;

function scrapeConflictsOfficial(
  row: GreekCatalogRow,
  namesByIssue: Map<string, string[]>,
): boolean {
  const issue = normalizeIssue(row.issueNumber);
  const official = namesByIssue.get(issue);
  if (!official?.length) return false;
  const scrapeNames = [row.seriesName, ...row.aliases].map(foldComicText).filter(Boolean);
  for (const officialName of official) {
    for (const scrapeName of scrapeNames) {
      if (scrapeName === officialName) return true;
      if (titleOverlap(scrapeName, officialName) >= 0.88) return true;
    }
  }
  return false;
}

export function localGreekCatalogRows(): GreekCatalogRow[] {
  if (cachedLocalRows) return cachedLocalRows;

  const seriesByKey = new Map(GREEK_CATALOG_SERIES.map((s) => [s.catalogKey, s]));
  const map = new Map<string, GreekCatalogRow>();
  const namesByIssue = new Map<string, string[]>();

  const rememberOfficial = (row: GreekCatalogRow) => {
    const issue = normalizeIssue(row.issueNumber);
    if (!issue) return;
    const names = namesByIssue.get(issue) ?? [];
    for (const name of [row.seriesName, ...row.aliases]) {
      const folded = foldComicText(name);
      if (folded && !names.includes(folded)) names.push(folded);
    }
    namesByIssue.set(issue, names);
  };

  const add = (issue: {
    seriesKey: string;
    catalogKey: string;
    number?: string;
    issueNumber?: string;
    title?: string;
    year?: number | null;
    coverUrl?: string;
    sourceUrl?: string;
    seriesName?: string;
    publisher?: string;
    aliases?: string[];
    format?: GreekReleaseFormat;
  }) => {
    const series = seriesByKey.get(issue.seriesKey);
    const row: GreekCatalogRow = {
      issueId: `greek:${issue.catalogKey}`,
      catalogKey: issue.catalogKey,
      seriesKey: issue.seriesKey,
      seriesName: series?.name ?? issue.seriesName ?? issue.seriesKey,
      aliases: series?.aliases ?? issue.aliases ?? [],
      publisher: series?.publisher ?? issue.publisher ?? '',
      format:
        normalizeGreekFormat(series?.format ?? issue.format) ??
        (series ? inferGreekSeriesFormat(series.name, 1) : undefined),
      issueNumber: issue.issueNumber ?? issue.number ?? '',
      issueTitle: issue.title,
      year: issue.year ?? undefined,
      coverUrl: issue.coverUrl,
      sourceUrl: issue.sourceUrl,
    };
    const existing = map.get(issue.catalogKey);
    if (existing?.coverUrl && !row.coverUrl) row.coverUrl = existing.coverUrl;
    map.set(issue.catalogKey, row);
    rememberOfficial(row);
  };

  for (const issue of GREEK_CATALOG_ISSUES) add(issue);
  for (const issue of harvestJson as Array<{
    seriesKey: string;
    catalogKey: string;
    issueNumber: string;
    title?: string;
    year?: number | null;
    coverUrl?: string;
    sourceUrl?: string;
  }>) {
    add(issue);
  }

  for (const row of greekcomicsCatalogRows()) {
    if (map.has(row.catalogKey)) continue;
    if (scrapeConflictsOfficial(row, namesByIssue)) continue;
    map.set(row.catalogKey, row);
  }

  cachedLocalRows = [...map.values()];
  return cachedLocalRows;
}

function scoreRow(
  row: GreekCatalogRow,
  seriesHint: string,
  issueHint: string,
  publisherHint: string,
  formatHint?: string,
): number {
  const names = [row.seriesName, row.issueTitle ?? '', ...row.aliases];
  let seriesScore = 0;
  for (const name of names) {
    seriesScore = Math.max(seriesScore, titleOverlap(seriesHint, name));
  }
  if (seriesScore < 0.45) return 0;

  const wantIssue = normalizeIssue(issueHint);
  const haveIssue = normalizeIssue(row.issueNumber);
  if (wantIssue) {
    if (wantIssue === haveIssue) seriesScore += 0.4;
    else if (foldComicText(row.issueNumber) === foldComicText(issueHint)) seriesScore += 0.4;
    else seriesScore -= 0.25;
  }

  if (publisherHint) {
    const pub = foldComicText(publisherHint);
    const rowPub = foldComicText(row.publisher);
    if (pub && rowPub && (rowPub.includes(pub) || pub.includes(rowPub.slice(0, 6)))) {
      seriesScore += 0.08;
    }
  }

  const wantFormat = normalizeGreekFormat(formatHint);
  const haveFormat = row.format ? normalizeGreekFormat(row.format) : undefined;
  if (wantFormat && haveFormat) {
    if (wantFormat === haveFormat) seriesScore += 0.12;
    else if (!formatsCompatible(wantFormat, haveFormat)) seriesScore -= 0.1;
  }

  if (row.coverUrl) seriesScore += 0.04;
  return seriesScore;
}

function toHit(row: GreekCatalogRow, score: number): GreekCatalogHit {
  return {
    catalogKey: row.catalogKey,
    seriesKey: row.seriesKey,
    issueId: row.issueId,
    series: row.seriesName,
    issue: row.issueNumber,
    title: row.issueTitle || row.seriesName,
    publisher: row.publisher,
    year: row.year ? String(row.year) : undefined,
    coverUrl: row.coverUrl,
    sourceUrl: row.sourceUrl,
    format: row.format,
    score,
  };
}

export function rankGreekCatalogRows(
  rows: GreekCatalogRow[],
  query: string,
  info?: GreekCatalogSearchInfo,
): GreekCatalogHit[] {
  const seriesHint = (info?.title || query).replace(/#\s*\d{1,4}\b/g, '').trim() || query;
  const issueHint = info?.issue?.trim() || parseIssueFromQuery(query);
  const publisherHint = info?.publisher?.trim() || '';
  const formatHint = info?.format?.trim() || '';

  const scored = rows
    .map((row) => ({
      row,
      score: scoreRow(row, seriesHint, issueHint, publisherHint, formatHint),
    }))
    .filter((x) => x.score >= 0.5)
    .sort((a, b) => b.score - a.score);

  const wantIssue = normalizeIssue(issueHint);
  const exact = wantIssue
    ? scored.filter(
        (x) =>
          normalizeIssue(x.row.issueNumber) === wantIssue ||
          foldComicText(x.row.issueNumber) === foldComicText(issueHint),
      )
    : [];
  const pool = exact.length > 0 ? exact : scored;
  return pool.slice(0, 8).map((x) => toHit(x.row, x.score));
}

function albumSubtitle(geminiTitle: string, seriesName: string): string {
  const g = foldComicText(geminiTitle);
  const s = foldComicText(seriesName);
  if (s && g.startsWith(s) && g.length > s.length) return g.slice(s.length).trim();
  const parts = geminiTitle.split(/[:：]/);
  if (parts.length > 1) return foldComicText(parts.slice(1).join(':'));
  return '';
}

/** Cover-scan match: same issue, or the same album title — not franchise name to first issue. */
export function rowMatchesGeminiScan(row: GreekCatalogRow, info: GreekCatalogSearchInfo): boolean {
  const title = info.title?.trim() || '';
  const g = foldComicText(title);
  if (!g) return false;

  const wantIssue = normalizeIssue(info.issue);
  const haveIssue = normalizeIssue(row.issueNumber);
  const seriesFold = foldComicText(row.seriesName);
  const albumFold = foldComicText(row.issueTitle ?? '');
  const names = [row.seriesName, row.issueTitle ?? '', ...row.aliases]
    .map(foldComicText)
    .filter(Boolean);

  if (wantIssue) {
    if (haveIssue !== wantIssue) return false;
    if (names.includes(g)) return true;
    for (const name of names) {
      if (titleOverlap(title, name) >= 0.78) return true;
    }
    return false;
  }

  const distinctAlbum = albumFold && albumFold !== seriesFold;
  if (distinctAlbum) {
    if (g === albumFold) return true;
    if (albumFold.length >= 5 && g.includes(albumFold)) return true;
    const subtitle = albumSubtitle(title, row.seriesName);
    if (
      subtitle.length >= 4 &&
      (albumFold === subtitle || albumFold.includes(subtitle) || subtitle.includes(albumFold))
    ) {
      return true;
    }
    return false;
  }

  // Graphic novel / one-shot catalogued as series name with no issue number.
  if (!haveIssue && names.includes(g)) return true;
  return false;
}

export function findTightGreekScanHits(
  rows: GreekCatalogRow[],
  info: GreekCatalogSearchInfo,
): GreekCatalogHit[] {
  const pub = foldComicText(info.publisher ?? '');
  const wantFormat = normalizeGreekFormat(info.format);
  const matched = rows.filter((row) => rowMatchesGeminiScan(row, info));
  matched.sort((a, b) => {
    if (wantFormat) {
      const fa = normalizeGreekFormat(a.format);
      const fb = normalizeGreekFormat(b.format);
      const rank = (f?: GreekReleaseFormat) => {
        if (!f) return 0;
        if (f === wantFormat) return 2;
        return formatsCompatible(wantFormat, f) ? 1 : -1;
      };
      const d = rank(fb) - rank(fa);
      if (d !== 0) return d;
    }
    const coverA = a.coverUrl ? 1 : 0;
    const coverB = b.coverUrl ? 1 : 0;
    if (coverB !== coverA) return coverB - coverA;
    if (pub) {
      const pa =
        foldComicText(a.publisher).includes(pub) || pub.includes(foldComicText(a.publisher)) ? 1 : 0;
      const pb =
        foldComicText(b.publisher).includes(pub) || pub.includes(foldComicText(b.publisher)) ? 1 : 0;
      if (pb !== pa) return pb - pa;
    }
    return 0;
  });
  return matched.slice(0, 8).map((row) => toHit(row, 1));
}

/** Sync lookup against the bundled seed (works without Supabase). */
export function searchGreekCatalogLocal(
  query: string,
  info?: GreekCatalogSearchInfo,
): GreekCatalogHit[] {
  const q = query.trim();
  if (!q && !info?.title) return [];
  return rankGreekCatalogRows(localGreekCatalogRows(), q || info?.title || '', info);
}

function seriesIndexName(value: string): string {
  return foldComicText(value.replace(/\s*\(\d{4}\)\s*$/u, ''));
}

/** Series keys for exact cover lookup (subtitle suffix, σ/σσ spelling). */
function seriesLookupKeys(series: string): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const push = (raw: string) => {
    const key = seriesIndexName(raw);
    if (!key || seen.has(key)) return;
    seen.add(key);
    keys.push(key);
    const singleSigma = key.replace(/σσ/g, 'σ');
    if (singleSigma !== key && !seen.has(singleSigma)) {
      seen.add(singleSigma);
      keys.push(singleSigma);
    }
  };

  let base = series.trim();
  base = base.replace(/\s*#\s*\d{1,4}\s*$/u, '').trim();
  base = base.replace(/\s+(?:no\.?|τεύχος)\s*#?\s*\d{1,4}\s*$/iu, '').trim();
  const trailingIssue = base.match(/\s+(\d{1,4})\s*$/);
  if (trailingIssue) {
    const n = Number(trailingIssue[1]);
    if (n < 1930 || n > 2035) {
      base = base.replace(/\s+\d{1,4}\s*$/, '').trim();
    }
  }

  push(base);
  if (base !== series.trim()) push(series);
  const noSubtitle = base.replace(/\s*[-–—]\s*.+$/u, '').trim();
  if (noSubtitle && noSubtitle !== base) push(noSubtitle);
  return keys;
}

let coverIndex: Map<string, GreekCatalogRow[]> | null = null;

function greekCoverIndex(): Map<string, GreekCatalogRow[]> {
  if (coverIndex) return coverIndex;
  coverIndex = new Map();
  for (const row of localGreekCatalogRows()) {
    const issue = normalizeIssue(row.issueNumber);
    if (!issue) continue;
    const names = [row.seriesName, ...row.aliases];
    for (const name of names) {
      const series = seriesIndexName(name);
      if (!series) continue;
      const key = `${series}#${issue}`;
      const list = coverIndex.get(key);
      if (list) list.push(row);
      else coverIndex.set(key, [row]);
    }
  }
  return coverIndex;
}

/**
 * Exact series + issue cover from the bundled Greek catalog (Anubis Batman #20).
 * Does not fuzzy-match "Action Comics" onto "Action Comics: Last Son".
 */
export function lookupExactGreekCatalogCover(
  series: string,
  issueNumber?: string,
  publisher?: string,
): string | undefined {
  const issue = normalizeIssue(issueNumber);
  if (!issue) return undefined;

  const pub = foldComicText(publisher ?? '');
  for (const seriesKey of seriesLookupKeys(series)) {
    const candidates = greekCoverIndex().get(`${seriesKey}#${issue}`) ?? [];
    if (!candidates.length) continue;

    const withPub = pub
      ? candidates.filter((row) => {
          const rowPub = foldComicText(row.publisher);
          return rowPub.includes(pub) || pub.includes(rowPub);
        })
      : [];
    const hit = withPub[0] ?? candidates[0];
    if (hit?.coverUrl) return hit.coverUrl;
  }
  return undefined;
}

function parseDecadeRange(query: string): { start: number; end: number } | null {
  const decadeWord = query.match(/δεκαετί[αας]\s*(?:του\s*)?'?(\d{2,4})/i);
  if (decadeWord) {
    let n = Number(decadeWord[1]);
    if (!Number.isFinite(n)) return null;
    if (n < 100) n = n >= 30 ? 1900 + n : 2000 + n;
    const start = Math.floor(n / 10) * 10;
    return { start, end: start + 9 };
  }
  const s = query.match(/\b((?:19|20)\d)0s\b/i);
  if (s) {
    const start = Number(`${s[1]}0`);
    return { start, end: start + 9 };
  }
  return null;
}

function parseArchiveYear(query: string): number | null {
  if (parseDecadeRange(query)) return null;
  const y = query.match(/\b((?:19|20)\d{2})\b/);
  return y ? Number(y[1]) : null;
}

let seriesByName: Map<string, GreekCatalogRow[]> | null = null;

function greekSeriesByName(): Map<string, GreekCatalogRow[]> {
  if (seriesByName) return seriesByName;
  seriesByName = new Map();
  for (const row of localGreekCatalogRows()) {
    const names = [row.seriesName, ...row.aliases];
    for (const name of names) {
      const key = seriesIndexName(name);
      if (!key) continue;
      const list = seriesByName.get(key);
      if (list) list.push(row);
      else seriesByName.set(key, [row]);
    }
  }
  return seriesByName;
}

/**
 * Historical browse: matching series (Batman, Μπλεκ, Αστερίξ) with many old issues,
 * oldest first — not the 8-hit cover-scan ranker.
 */
export function searchGreekArchive(query: string, limit = 80): GreekCatalogHit[] {
  const raw = query.trim();
  if (raw.length < 2) return [];

  const decade = parseDecadeRange(raw);
  const year = parseArchiveYear(raw);
  const issueHint = parseIssueFromQuery(raw);
  let seriesHint = raw
    .replace(/#\s*\d{1,4}\b/g, ' ')
    .replace(/δεκαετί[αας]\s*(?:του\s*)?'?\d{2,4}/gi, ' ')
    .replace(/\b(?:19|20)\d0s\b/gi, ' ')
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .replace(/\bτεύχος\s*[#:]?\s*\d{1,4}\b/gi, ' ')
    .trim();
  if (issueHint) {
    seriesHint = seriesHint.replace(new RegExp(`(?:^|\\s)${issueHint}\\s*$`), '').trim();
  }
  const q = seriesIndexName(seriesHint || raw);
  if (!q || q.length < 2) return [];
  const qCompact = q.replace(/\s+/g, '');

  const index = greekSeriesByName();
  const matched: { key: string; score: number }[] = [];

  const pushMatch = (key: string, score: number) => {
    if (matched.some((row) => row.key === key)) return;
    matched.push({ key, score });
  };

  const direct = index.get(q);
  if (direct?.length) {
    pushMatch(q, 1);
  }

  for (const key of index.keys()) {
    if (key === q) continue;
    const keyCompact = key.replace(/\s+/g, '');
    if (qCompact.length >= 4 && keyCompact === qCompact) {
      pushMatch(key, 1);
      continue;
    }
    if (qCompact.length >= 5 && (keyCompact.includes(qCompact) || qCompact.includes(keyCompact))) {
      pushMatch(key, 0.92);
      continue;
    }
    if (key.includes(q) || (q.length >= 4 && q.includes(key) && key.length >= 4)) {
      pushMatch(key, key.includes(q) ? 0.9 : 0.85);
      continue;
    }
    if (q.length < 4) continue;
    if (key[0] !== q[0] && !key.includes(q.slice(0, 3))) continue;
    const score = titleOverlap(q, key);
    if (score >= 0.78) pushMatch(key, score);
  }
  matched.sort((a, b) => b.score - a.score);

  const wantIssue = normalizeIssue(issueHint);
  const out: GreekCatalogRow[] = [];
  const seen = new Set<string>();
  for (const { key } of matched.slice(0, 8)) {
    for (const row of index.get(key) ?? []) {
      if (seen.has(row.catalogKey)) continue;
      if (wantIssue && normalizeIssue(row.issueNumber) !== wantIssue) continue;
      if (decade && row.year && (row.year < decade.start || row.year > decade.end)) continue;
      if (year && row.year && row.year !== year) continue;
      seen.add(row.catalogKey);
      out.push(row);
    }
  }

  out.sort((a, b) => {
    const ya = a.year ?? 9999;
    const yb = b.year ?? 9999;
    if (ya !== yb) return ya - yb;
    return Number(normalizeIssue(a.issueNumber) || 0) - Number(normalizeIssue(b.issueNumber) || 0);
  });

  return out.slice(0, limit).map((row) => toHit(row, 1));
}

import { searchGreekArchive } from '@/lib/greekCatalogMatch';
import { rememberArchiveIssues } from '@/lib/archiveIssueStore';
import { searchMetronIssues } from '@/services/metron';
import type { CoverMatch } from '@/types/coverLookup';
import type { CatalogIssue } from '@/services/catalog';

export type ArchiveIssue = CatalogIssue & {
  publisher?: { id: number; name: string } | string | null;
  price?: string | null;
  sourceUrl?: string;
};

function stableArchiveId(catalogKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < catalogKey.length; i++) {
    h ^= catalogKey.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return 8_000_000 + ((h >>> 0) % 999_999);
}

function dateFromYear(year?: string): string | null {
  if (!year || !/^\d{4}$/.test(year)) return null;
  return `${year}-01-01`;
}

function compactLatin(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const HERO_ALIASES: Record<string, string[]> = {
  spiderman: ['Spider-Man', 'The Amazing Spider-Man'],
  amazingspiderman: ['The Amazing Spider-Man', 'Spider-Man'],
  spectacularspiderman: ['Spectacular Spider-Man'],
  ultimatespiderman: ['Ultimate Spider-Man'],
  xmen: ['X-Men'],
  batman: ['Batman'],
  superman: ['Superman'],
  wolverine: ['Wolverine'],
  avengers: ['Avengers'],
  daredevil: ['Daredevil'],
  hulk: ['Hulk'],
  ironman: ['Iron Man'],
  captamerica: ['Captain America'],
  captainamerica: ['Captain America'],
};

/** Prefer the spelling Metron actually stores (Spider-Man, not Spiderman). */
function primaryArchiveQuery(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  const aliases = HERO_ALIASES[compactLatin(t)];
  return aliases?.[0] ?? t;
}

function parseArchiveSearch(raw: string): { series: string; issue?: string } {
  const t = raw.trim();
  if (/δεκαετί/i.test(t)) {
    return { series: primaryArchiveQuery(t.replace(/δεκαετί[αας]\s*(?:του\s*)?'?\d{2,4}/gi, ' ').trim() || t) };
  }

  const hash = t.match(/#\s*(\d{1,4})\b/);
  const tefchos = t.match(/\bτεύχος\s*[#:]?\s*(\d{1,4})\b/i);
  const trailing = t.match(/(?:^|\s)(\d{1,4})\s*$/);
  let issue = '';
  if (hash) issue = String(Number(hash[1]));
  else if (tefchos) issue = String(Number(tefchos[1]));
  else if (trailing) {
    const n = Number(trailing[1]);
    if (n < 1930 || n > 2035) issue = String(n);
  }

  let series = t
    .replace(/#\s*\d{1,4}\b/g, ' ')
    .replace(/\bτεύχος\s*[#:]?\s*\d{1,4}\b/gi, ' ')
    .replace(/\bno\.?\s*\d{1,4}\b/gi, ' ')
    .trim();
  if (issue) {
    series = series.replace(new RegExp(`(?:^|\\s)${issue}\\s*$`), '').trim();
  }
  series = primaryArchiveQuery(series || t);
  return issue ? { series, issue } : { series };
}

function coverMatchToIssue(match: CoverMatch): ArchiveIssue | null {
  const id = Number(match.issueId);
  if (!Number.isFinite(id) || id <= 0) return null;
  const year = match.editions?.[0]?.year;
  const dated = dateFromYear(year);
  const publisherName = match.publisher && match.publisher !== '—' ? match.publisher : '';
  return {
    id,
    series: {
      id: 0,
      name: match.series,
      volume: 1,
      publisher: publisherName ? { id: 0, name: publisherName } : undefined,
    },
    number: match.issue,
    cover_date: dated,
    store_date: dated,
    image: match.coverUrl ?? null,
    publisher: publisherName ? { id: 0, name: publisherName } : null,
    price: null,
  };
}

function sortOldestFirst(issues: ArchiveIssue[]): ArchiveIssue[] {
  return [...issues].sort((a, b) => {
    const da = a.store_date || a.cover_date || '9999';
    const db = b.store_date || b.cover_date || '9999';
    if (da !== db) return da.localeCompare(db);
    return String(a.number).localeCompare(String(b.number), undefined, { numeric: true });
  });
}

const resultCache = new Map<string, { at: number; issues: ArchiveIssue[] }>();
const CACHE_MS = 5 * 60 * 1000;

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

function greekHitsToIssues(query: string): ArchiveIssue[] {
  const seen = new Set<string>();
  const hits = [];
  const variants = [primaryArchiveQuery(query), query.trim()].filter(
    (v, i, arr) => v && arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === i,
  );
  for (const variant of variants) {
    for (const hit of searchGreekArchive(variant)) {
      if (seen.has(hit.catalogKey)) continue;
      seen.add(hit.catalogKey);
      hits.push(hit);
    }
  }
  return hits.map((hit) => {
    const dated = dateFromYear(hit.year);
    return {
      id: stableArchiveId(hit.catalogKey),
      series: {
        id: 0,
        name: hit.series,
        volume: 1,
        publisher: { id: 0, name: hit.publisher },
      },
      number: hit.issue,
      cover_date: dated,
      store_date: dated,
      image: hit.coverUrl ?? null,
      publisher: { id: 0, name: hit.publisher },
      price: null,
      sourceUrl: hit.sourceUrl,
    };
  });
}

export async function searchArchive(opts: {
  query: string;
  greek: boolean;
}): Promise<ArchiveIssue[]> {
  const query = opts.query.trim();
  if (query.length < 2) return [];

  const parsed = parseArchiveSearch(query);
  const cacheKey = `${opts.greek ? 'el' : 'en'}:${parsed.series.toLowerCase()}#${parsed.issue ?? ''}`;
  const cached = resultCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.issues;

  if (opts.greek) {
    await yieldToUi();
    const issues = sortOldestFirst(greekHitsToIssues(query));
    rememberArchiveIssues(issues);
    resultCache.set(cacheKey, { at: Date.now(), issues });
    return issues;
  }

  const { matches } = await searchMetronIssues(parsed.series, parsed.issue, {
    pageSize: parsed.issue ? 25 : 40,
    fallbackWithoutNumber: false,
  });
  let picked = matches;
  if (parsed.issue && picked.length === 0) {
    const broader = await searchMetronIssues(parsed.series, undefined, {
      pageSize: 40,
      fallbackWithoutNumber: false,
    });
    picked = broader.matches.filter((m) => {
      const n = String(m.issue ?? '')
        .replace(/^#/, '')
        .match(/^(\d{1,4})/);
      return n ? String(Number(n[1])) === parsed.issue : false;
    });
  }
  const issues = sortOldestFirst(
    picked.map(coverMatchToIssue).filter((row): row is ArchiveIssue => Boolean(row)),
  );
  rememberArchiveIssues(issues);
  resultCache.set(cacheKey, { at: Date.now(), issues });
  return issues;
}

import { foldComicText } from '@/lib/comicLanguage';
import { localGreekCatalogRows } from '@/lib/greekCatalogMatch';

export type ArchiveSearchSuggestion = {
  label: string;
  query: string;
  score: number;
};

const FOREIGN_ARCHIVE_SERIES = [
  'Action Comics',
  'Adventures of Superman',
  'Amazing Spider-Man',
  'The Amazing Spider-Man',
  'Avengers',
  'Batman',
  'Captain America',
  'Daredevil',
  'Detective Comics',
  'Fantastic Four',
  'Flash',
  'Green Lantern',
  'Iron Man',
  'Justice League',
  'Justice League of America',
  'Spectacular Spider-Man',
  'Spider-Man',
  'Superman',
  'Teen Titans',
  'Thor',
  'Uncanny X-Men',
  'Ultimate Spider-Man',
  'Wonder Woman',
  'Wolverine',
  'X-Men',
  'Hulk',
];

function stripQueryNoise(raw: string): string {
  return raw
    .replace(/#\s*\d{1,4}\b/g, ' ')
    .replace(/δεκαετί[αας]\s*(?:του\s*)?'?\d{2,4}/gi, ' ')
    .replace(/\b(?:19|20)\d0s\b/gi, ' ')
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')
    .replace(/\bτεύχος\s*[#:]?\s*\d{1,4}\b/gi, ' ')
    .replace(/\bno\.?\s*\d{1,4}\b/gi, ' ')
    .replace(/(?:^|\s)\d{1,4}\s*$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

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
  if (!wa.size || !wb.size) return 0;
  let hit = 0;
  for (const w of wa) if (wb.has(w)) hit += 1;
  return hit / Math.max(wa.size, wb.size);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      next[j] = Math.min(prev[j] + 1, next[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = next;
  }
  return prev[b.length];
}

function compactScore(a: string, b: string): number {
  const ca = foldComicText(a).replace(/\s+/g, '');
  const cb = foldComicText(b).replace(/\s+/g, '');
  if (!ca || !cb) return 0;
  if (ca === cb) return 1;
  const maxLen = Math.max(ca.length, cb.length);
  if (maxLen < 4) return 0;
  const ratio = 1 - levenshtein(ca, cb) / maxLen;
  return ratio >= 0.72 ? ratio : 0;
}

function sortedWordsScore(a: string, b: string): number {
  const wa = foldComicText(a)
    .split(' ')
    .filter((w) => w.length > 1)
    .sort()
    .join(' ');
  const wb = foldComicText(b)
    .split(' ')
    .filter((w) => w.length > 1)
    .sort()
    .join(' ');
  if (!wa || !wb) return 0;
  if (wa === wb) return 0.96;
  return titleOverlap(a, b);
}

function scoreCandidate(query: string, candidate: string): number {
  return Math.max(
    titleOverlap(query, candidate),
    compactScore(query, candidate),
    sortedWordsScore(query, candidate),
  );
}

let greekCandidates: Array<{ label: string; query: string }> | null = null;

function greekSeriesCandidates(): Array<{ label: string; query: string }> {
  if (greekCandidates) return greekCandidates;
  const seen = new Set<string>();
  greekCandidates = [];
  for (const row of localGreekCatalogRows()) {
    for (const name of [row.seriesName, ...row.aliases]) {
      const label = name.trim();
      if (!label) continue;
      const key = foldComicText(label);
      if (seen.has(key)) continue;
      seen.add(key);
      greekCandidates.push({ label, query: label });
    }
  }
  return greekCandidates;
}

function foreignSeriesCandidates(): Array<{ label: string; query: string }> {
  const seen = new Set<string>();
  const out: Array<{ label: string; query: string }> = [];
  for (const label of FOREIGN_ARCHIVE_SERIES) {
    const key = foldComicText(label);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ label, query: label });
  }
  return out;
}

export function suggestArchiveSearch(
  rawQuery: string,
  opts: { greek: boolean; limit?: number },
): ArchiveSearchSuggestion[] {
  const query = stripQueryNoise(rawQuery);
  if (query.length < 3) return [];

  const queryFold = foldComicText(query);
  const candidates = opts.greek ? greekSeriesCandidates() : foreignSeriesCandidates();
  const limit = opts.limit ?? 5;

  const scored = candidates
    .map((candidate) => ({
      ...candidate,
      score: scoreCandidate(query, candidate.label),
    }))
    .filter((item) => item.score >= 0.62 && foldComicText(item.label) !== queryFold)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label, 'el'));

  const seen = new Set<string>();
  const out: ArchiveSearchSuggestion[] = [];
  for (const item of scored) {
    const key = foldComicText(item.label);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

export function shouldShowArchiveSuggestions(
  query: string,
  suggestions: ArchiveSearchSuggestion[],
  hasResults: boolean,
): boolean {
  if (suggestions.length === 0) return false;
  const cleaned = stripQueryNoise(query);
  if (cleaned.length < 3) return false;

  const q = foldComicText(cleaned);
  if (suggestions[0] && foldComicText(suggestions[0].query) === q) return false;
  if (!hasResults) return true;
  return suggestions[0].score >= 0.78;
}

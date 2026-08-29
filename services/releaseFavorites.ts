import AsyncStorage from '@react-native-async-storage/async-storage';

import { detectComicMarket, foldComicText } from '@/lib/comicLanguage';

const STORAGE_KEY = 'comicsaki.releaseFavorites.v1';

export type ReleaseFavorite = {
  id: number;
  seriesName: string;
  number: string;
  coverUrl: string | null;
  publisher: string;
  storeDate: string | null;
  savedAt: string;
};

export type ReleaseFavoriteGroup = {
  key: string;
  name: string;
  issues: ReleaseFavorite[];
};

function releaseSeriesKey(name: string): string {
  return foldComicText(name.replace(/\s*\(\d{4}\)\s*$/u, ''));
}

function issueSortValue(number: string): number {
  const n = Number(String(number).replace(/^#/, '').match(/^\d+/)?.[0] ?? '');
  return Number.isFinite(n) ? n : 0;
}

function cleanPublisher(publisher: string): string {
  const value = publisher.trim();
  if (!value || value === '—' || value === '-') return '';
  return value;
}

function publisherIdentity(publisher: string): string {
  const value = cleanPublisher(publisher);
  if (!value) return 'unknown';
  return value
    .toLocaleLowerCase('el')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickLabel(counts: Map<string, number>, fallback: string): string {
  let best = '';
  let bestCount = -1;
  for (const [label, count] of counts) {
    if (
      count > bestCount ||
      (count === bestCount && label.length > best.length) ||
      (count === bestCount && label.length === best.length && label.localeCompare(best, 'el') < 0)
    ) {
      best = label;
      bestCount = count;
    }
  }
  return best || fallback;
}

function seriesLabel(items: ReleaseFavorite[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = item.seriesName.trim() || 'Άγνωστη σειρά';
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return pickLabel(counts, 'Άγνωστη σειρά');
}

function publisherLabel(items: ReleaseFavorite[]): string {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = cleanPublisher(item.publisher);
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return pickLabel(counts, '');
}

/** Greek editions (and mixed-publisher series) show «Batman-Anubis». */
function usesPublisherSuffix(allInSeries: ReleaseFavorite[], bucket: ReleaseFavorite[]): boolean {
  const pubKeys = new Set(allInSeries.map((item) => publisherIdentity(item.publisher)));
  if (pubKeys.size > 1) return true;
  const sample = bucket[0];
  if (!sample) return false;
  return detectComicMarket(sample.seriesName, sample.publisher) === 'greek';
}

function groupDisplayName(allInSeries: ReleaseFavorite[], bucket: ReleaseFavorite[]): string {
  const series = seriesLabel(bucket);
  const publisher = publisherLabel(bucket);
  if (usesPublisherSuffix(allInSeries, bucket) && publisher) {
    return `${series}-${publisher}`;
  }
  return series;
}

function groupStorageKey(
  seriesKey: string,
  allInSeries: ReleaseFavorite[],
  bucket: ReleaseFavorite[],
): string {
  if (!usesPublisherSuffix(allInSeries, bucket)) return seriesKey;
  return `${seriesKey}#${publisherIdentity(bucket[0]?.publisher ?? '')}`;
}

function sortReleaseIssues(items: ReleaseFavorite[]): ReleaseFavorite[] {
  return [...items].sort(
    (a, b) => issueSortValue(b.number) - issueSortValue(a.number) || b.savedAt.localeCompare(a.savedAt),
  );
}

export function groupReleaseFavorites(items: ReleaseFavorite[]): ReleaseFavoriteGroup[] {
  const bySeries = new Map<string, ReleaseFavorite[]>();
  const seriesOrder: string[] = [];
  for (const item of items) {
    const seriesKey = releaseSeriesKey(item.seriesName) || `id:${item.id}`;
    const bucket = bySeries.get(seriesKey);
    if (!bucket) {
      bySeries.set(seriesKey, [item]);
      seriesOrder.push(seriesKey);
      continue;
    }
    bucket.push(item);
  }

  const groups: Array<ReleaseFavoriteGroup & { latestSaved: string }> = [];
  for (const seriesKey of seriesOrder) {
    const titleItems = bySeries.get(seriesKey) ?? [];
    const pubKeys = new Set(titleItems.map((item) => publisherIdentity(item.publisher)));
    const splitByPublisher =
      pubKeys.size > 1 ||
      titleItems.some((item) => detectComicMarket(item.seriesName, item.publisher) === 'greek');

    if (!splitByPublisher) {
      const latestSaved = titleItems.reduce((max, item) => (item.savedAt > max ? item.savedAt : max), '');
      groups.push({
        key: seriesKey,
        name: groupDisplayName(titleItems, titleItems),
        issues: sortReleaseIssues(titleItems),
        latestSaved,
      });
      continue;
    }

    const byPublisher = new Map<string, ReleaseFavorite[]>();
    const publisherOrder: string[] = [];
    for (const item of titleItems) {
      const pubKey = publisherIdentity(item.publisher);
      const bucket = byPublisher.get(pubKey);
      if (!bucket) {
        byPublisher.set(pubKey, [item]);
        publisherOrder.push(pubKey);
        continue;
      }
      bucket.push(item);
    }

    for (const pubKey of publisherOrder) {
      const pubItems = byPublisher.get(pubKey) ?? [];
      const latestSaved = pubItems.reduce((max, item) => (item.savedAt > max ? item.savedAt : max), '');
      groups.push({
        key: groupStorageKey(seriesKey, titleItems, pubItems),
        name: groupDisplayName(titleItems, pubItems),
        issues: sortReleaseIssues(pubItems),
        latestSaved,
      });
    }
  }

  return groups
    .sort((a, b) => b.latestSaved.localeCompare(a.latestSaved))
    .map(({ latestSaved: _latestSaved, ...group }) => group);
}

function asIssueId(value: unknown): number {
  const id = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(id) ? id : NaN;
}

async function readAll(): Promise<ReleaseFavorite[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ReleaseFavorite[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({ ...item, id: asIssueId(item.id) }))
      .filter((item) => Number.isFinite(item.id));
  } catch {
    return [];
  }
}

async function writeAll(items: ReleaseFavorite[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function fetchReleaseFavorites(): Promise<ReleaseFavorite[]> {
  const items = await readAll();
  return items.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function fetchReleaseFavoriteIds(): Promise<Set<number>> {
  const items = await readAll();
  return new Set(items.map((item) => item.id));
}

export async function toggleReleaseFavorite(input: {
  id: number;
  seriesName: string;
  number: string;
  coverUrl: string | null;
  publisher: string;
  storeDate: string | null;
}): Promise<{ favorites: ReleaseFavorite[]; isFavorite: boolean }> {
  const items = await readAll();
  const id = asIssueId(input.id);
  if (!Number.isFinite(id)) {
    return { favorites: items, isFavorite: false };
  }
  const index = items.findIndex((item) => item.id === id);

  if (index >= 0) {
    items.splice(index, 1);
    await writeAll(items);
    return { favorites: items, isFavorite: false };
  }

  const next: ReleaseFavorite = {
    id,
    seriesName: input.seriesName,
    number: input.number,
    coverUrl: input.coverUrl,
    publisher: input.publisher,
    storeDate: input.storeDate,
    savedAt: new Date().toISOString(),
  };
  const favorites = [next, ...items];
  await writeAll(favorites);
  return { favorites, isFavorite: true };
}

export async function removeReleaseFavorite(id: number): Promise<ReleaseFavorite[]> {
  const issueId = asIssueId(id);
  const items = (await readAll()).filter((item) => item.id !== issueId);
  await writeAll(items);
  return items;
}

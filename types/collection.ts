import { foldComicText } from '@/lib/comicLanguage';

export type CollectionItem = {
  id: string;
  issueId?: string;
  series: string;
  issue: string;
  publisher: string;
  coverUrl?: string;
  category: string;
  condition: string;
  qty: number;
  year?: string;
  notes?: string;
  grade?: string;
  isRead: boolean;
  isWishlist: boolean;
  isFavorite: boolean;
};

export type CollectionBrowseTab = 'publisher' | 'title' | 'category';

export const collectionBrowseTabs: { id: CollectionBrowseTab; label: string }[] = [
  { id: 'publisher', label: 'ΕΚΔΟΤΕΣ' },
  { id: 'title', label: 'ΤΙΤΛΟΣ' },
  { id: 'category', label: 'ΚΑΤΗΓΟΡΙΑ' },
];

function normalizeText(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('el')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ς/g, 'σ');
}

/** Map Latin / alternate spellings onto one Greek (or shared) key. */
const PUBLISHER_ALIASES: Record<string, string> = {
  mamouth: 'μαμουθ',
  mammouth: 'μαμουθ',
  anubis: 'anubis',
  ανουβισ: 'anubis',
  jemma: 'jemma',
  τζεμμα: 'jemma',
  marvel: 'marvel',
  μαρβελ: 'marvel',
  dc: 'dc',
  'dc comics': 'dc',
};

/** Strip noise words so «Μαμούθ Κόμιξ» and «Mamouth Comix» share one identity. */
function publisherIdentity(publisher: string): string {
  let n = normalizeText(publisher);
  // Avoid \b — it does not treat Greek letters as word chars in JS.
  const noise = [
    'comics',
    'comic',
    'comix',
    'κομιξ',
    'εκδοσεισ',
    'εκδοσεις',
    'press',
    'publishing',
    'books',
    'editions',
    'edition',
  ];
  for (const word of noise) {
    n = n.split(word).join(' ');
  }
  n = n
    .replace(/[^a-z0-9α-ωσ\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!n) n = normalizeText(publisher) || 'αγνωστοσ';
  return PUBLISHER_ALIASES[n] ?? n;
}

function titleIdentity(title: string): string {
  const stripped = title.trim().replace(/\s*\(\d{4}\)\s*$/u, '');
  return foldComicText(stripped) || 'αγνωστο';
}

function issueSortValue(number: string): number {
  const n = Number(String(number).replace(/^#/, '').match(/^\d+/)?.[0] ?? '');
  return Number.isFinite(n) ? n : 0;
}

export type CollectionTitleGroup = {
  key: string;
  name: string;
  issues: CollectionItem[];
};

export function collectionTitleKey(title: string): string {
  return titleIdentity(title);
}

function seriesDisplayLabel(items: CollectionItem[]): string {
  const labels = new Map<string, number>();
  for (const item of items) {
    const label = item.series.trim() || 'Άγνωστη σειρά';
    labels.set(label, (labels.get(label) ?? 0) + 1);
  }
  return pickDisplayLabel(labels);
}

function publisherDisplayLabel(items: CollectionItem[]): string {
  const labels = new Map<string, number>();
  for (const item of items) {
    const label = item.publisher.trim() || 'Άγνωστος';
    labels.set(label, (labels.get(label) ?? 0) + 1);
  }
  return pickDisplayLabel(labels);
}

function sortCollectionIssues(items: CollectionItem[]): CollectionItem[] {
  return [...items].sort(
    (a, b) =>
      issueSortValue(b.issue) - issueSortValue(a.issue) ||
      a.series.localeCompare(b.series, 'el'),
  );
}

export function groupCollectionItemsByTitle(items: CollectionItem[]): CollectionTitleGroup[] {
  const byTitle = new Map<string, CollectionItem[]>();
  const titleOrder: string[] = [];
  for (const item of items) {
    const titleKey = titleIdentity(item.series);
    const bucket = byTitle.get(titleKey);
    if (!bucket) {
      byTitle.set(titleKey, [item]);
      titleOrder.push(titleKey);
      continue;
    }
    bucket.push(item);
  }

  const groups: CollectionTitleGroup[] = [];
  for (const titleKey of titleOrder) {
    const titleItems = byTitle.get(titleKey) ?? [];
    const publisherKeys = new Set(titleItems.map((item) => publisherIdentity(item.publisher)));
    const splitByPublisher = publisherKeys.size > 1;

    if (!splitByPublisher) {
      groups.push({
        key: titleKey,
        name: seriesDisplayLabel(titleItems),
        issues: sortCollectionIssues(titleItems),
      });
      continue;
    }

    const byPublisher = new Map<string, CollectionItem[]>();
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
      const seriesName = seriesDisplayLabel(pubItems);
      const publisherName = publisherDisplayLabel(pubItems);
      groups.push({
        key: `${titleKey}#${pubKey}`,
        name: `${seriesName}-${publisherName}`,
        issues: sortCollectionIssues(pubItems),
      });
    }
  }

  return groups;
}

function categoryIdentity(category: string): string {
  return normalizeText(category).replace(/\s+/g, ' ').trim() || 'αγνωστο';
}

function getBrowseKey(item: CollectionItem, tab: CollectionBrowseTab): string {
  if (tab === 'publisher') return publisherIdentity(item.publisher);
  if (tab === 'title') return titleIdentity(item.series);
  return categoryIdentity(item.category);
}

function getBrowseLabel(item: CollectionItem, tab: CollectionBrowseTab): string {
  if (tab === 'publisher') return item.publisher.trim() || 'Άγνωστος';
  if (tab === 'title') return item.series.trim() || 'Άγνωστος';
  return item.category.trim() || 'Άγνωστη';
}

/** Prefer the most common spelling; break ties toward longer / title-case labels. */
function pickDisplayLabel(labelCounts: Map<string, number>): string {
  let best = '';
  let bestCount = -1;
  for (const [label, count] of labelCounts) {
    if (
      count > bestCount ||
      (count === bestCount && label.length > best.length) ||
      (count === bestCount && label.length === best.length && label.localeCompare(best, 'el') < 0)
    ) {
      best = label;
      bestCount = count;
    }
  }
  return best || 'Άγνωστος';
}

export function groupCollection(
  items: CollectionItem[],
  tab: CollectionBrowseTab,
): { name: string; count: number }[] {
  const groups = new Map<string, { count: number; labels: Map<string, number> }>();

  for (const item of items) {
    const key = getBrowseKey(item, tab);
    const label = getBrowseLabel(item, tab);
    const existing = groups.get(key) ?? { count: 0, labels: new Map() };
    existing.count += 1;
    existing.labels.set(label, (existing.labels.get(label) ?? 0) + 1);
    groups.set(key, existing);
  }

  return [...groups.entries()]
    .map(([, group]) => ({
      name: pickDisplayLabel(group.labels),
      count: group.count,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'el'));
}

export function filterCollection(
  items: CollectionItem[],
  tab: CollectionBrowseTab,
  selectedGroup: string | null,
): CollectionItem[] {
  if (!selectedGroup) return items;

  const selectedKey =
    tab === 'publisher'
      ? publisherIdentity(selectedGroup)
      : tab === 'title'
        ? titleIdentity(selectedGroup)
        : categoryIdentity(selectedGroup);

  return items.filter((item) => getBrowseKey(item, tab) === selectedKey);
}

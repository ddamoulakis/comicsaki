import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CosmicBackground } from '@/components/comicsaki/CosmicBackground';
import { ZoomableCover } from '@/components/comicsaki/ZoomableCover';
import { theme } from '@/constants/Theme';
import { getTabBarHeight } from '@/constants/phoneShell';
import { isHttpUrl } from '@/lib/coverUrl';
import { useAppViewport } from '@/hooks/useAppViewport';
import { useCollectionData } from '@/hooks/useCollectionData';
import { detectComicMarket } from '@/lib/comicLanguage';
import {
  shouldShowArchiveSuggestions,
  suggestArchiveSearch,
} from '@/lib/archiveSearchSuggest';
import { metronProxyFetch } from '@/lib/metronClient';
import { setManualAddPrefill } from '@/lib/collectionSession';
import { addCollectionItem, deleteCollectionItem, findCollectionItemId } from '@/services/supabase/collection';
import { fetchCatalogWeek } from '@/services/catalog';
import { searchArchive } from '@/services/archiveSearch';
import { fetchGreekReleases, loadGreekMarketReleases, GREEK_PUBLISHERS } from '@/services/greekReleases';
import {
  fetchReleaseFavoriteIds,
  toggleReleaseFavorite,
} from '@/services/releaseFavorites';

const GAP = 8;
const H_PAD = 12;

function getGridMetrics(width: number) {
  const cols = width < 360 ? 2 : 3;
  const cardW = Math.floor((width - H_PAD * 2 - GAP * (cols - 1)) / cols);
  const coverH = Math.floor(cardW * 1.5);
  const filterPanelW = width < 380 ? width : Math.min(320, width * 0.82);
  return { cols, cardW, coverH, filterPanelW };
}

type MetronIssue = {
  id: number;
  series: {
    id: number;
    name: string;
    volume: number;
    publisher?: { id: number; name: string } | string;
    publisher_name?: string;
  };
  number: string;
  issue?: string;
  cover_date: string | null;
  store_date: string | null;
  image: string | null;
  publisher?: { id: number; name: string } | string | null;
  publisher_name?: string;
  price: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

type Filters = {
  calendarMode: string;
  sortBy: string;
  formats: Set<string>;
  genres: Set<string>;
  publishers: Set<string>;
  listStatus: string;
};

const DEFAULT_FILTERS: Filters = {
  calendarMode: 'week',
  sortBy: 'alpha_asc',
  formats: new Set(),
  genres: new Set(),
  publishers: new Set(),
  listStatus: 'all',
};

const CALENDAR_OPTIONS = [
  { key: 'week', label: 'Ανά Εβδομάδα' },
  { key: 'foc', label: 'Final Order Cutoff' },
  { key: 'lunar', label: 'Lunar Catalog Month' },
  { key: 'prh', label: 'PRH Catalog Month' },
  { key: 'previews', label: 'Previews Catalog Month' },
];

const SORT_OPTIONS = [
  { key: 'alpha_asc', label: 'Αλφαβητικά (Α – Ω)' },
  { key: 'alpha_desc', label: 'Αλφαβητικά (Ω – Α)' },
  { key: 'date_newest', label: 'Ημερομηνία (Νεότερο)' },
  { key: 'date_oldest', label: 'Ημερομηνία (Παλαιότερο)' },
  { key: 'publisher_asc', label: 'Εκδότης (Α – Ω)' },
  { key: 'publisher_desc', label: 'Εκδότης (Ω – Α)' },
];

const FORMAT_OPTIONS = [
  { key: 'regular', label: 'Κανονικά Τεύχη' },
  { key: 'annual', label: 'Ετήσια (Annuals)' },
  { key: 'digital', label: 'Digital Chapters' },
  { key: 'variant', label: 'Variants & Reprints' },
  { key: 'tpb', label: 'Trade Paperbacks' },
  { key: 'hardcover', label: 'Hardcovers' },
  { key: 'first_issue', label: 'Μόνο #1 Τεύχη' },
  { key: 'facsimile', label: 'Facsimile' },
  { key: 'omnibus', label: 'Omnibus' },
];

const GENRE_OPTIONS = [
  { key: 'superhero', label: 'Σούπερ Ήρωες' },
  { key: 'action', label: 'Δράση / Περιπέτεια' },
  { key: 'scifi', label: 'Επιστημονική Φαντασία' },
  { key: 'fantasy', label: 'Φαντασία' },
  { key: 'horror', label: 'Τρόμος' },
  { key: 'crime', label: 'Αστυνομικό / Crime' },
  { key: 'mystery', label: 'Μυστήριο' },
  { key: 'western', label: 'Western' },
  { key: 'war', label: 'Πόλεμος' },
  { key: 'humor', label: 'Χιούμορ / Κωμωδία' },
  { key: 'romance', label: 'Ρομάντζο' },
  { key: 'manga', label: 'Manga' },
  { key: 'kids', label: 'Παιδικά' },
  { key: 'biography', label: 'Βιογραφία / Non-Fiction' },
];

const GENRE_KEYWORDS: Record<string, string[]> = {
  superhero: [
    'batman', 'superman', 'spider-man', 'spiderman', 'x-men', 'x men', 'avengers',
    'justice league', 'wonder woman', 'captain america', 'iron man', 'wolverine',
    'deadpool', 'flash', 'green lantern', 'thor', 'hulk', 'fantastic four',
    'daredevil', 'venom', 'punisher', 'aquaman', 'shazam', 'guardians of the galaxy',
  ],
  action: ['action', 'adventure', 'conan', 'g.i. joe', 'gi joe', 'indiana jones', 'rambo'],
  scifi: ['star wars', 'star trek', 'alien', 'predator', 'dune', 'sci-fi', 'science fiction', 'terminator'],
  fantasy: ['fantasy', 'dungeons', 'lord of the rings', 'witcher', 'elf', 'conan', 'game of thrones'],
  horror: ['horror', 'walking dead', 'vampire', 'zombie', 'swamp thing', 'hellraiser', 'something is killing'],
  crime: ['crime', 'noir', 'sin city', 'punisher', 'brubaker', 'criminal'],
  mystery: ['mystery', 'detective', 'sherlock', 'who is', 'whodunnit'],
  western: ['western', 'lone ranger', 'django', 'Jonah hex', 'jonah hex'],
  war: ['war', 'sgt. rock', 'unknown soldier', 'enemy ace'],
  humor: ['humor', 'humour', 'garfield', 'peanuts', 'archie', 'scooby', 'mad magazine', 'unbeatable squirrel'],
  romance: ['romance', 'love', 'heartstopper'],
  manga: ['manga', 'naruto', 'one piece', 'attack on titan', 'shonen', 'shoujo', 'berserk'],
  kids: ['kids', 'disney', 'pokemon', 'my little pony', 'sonic', 'paw patrol', 'bluey'],
  biography: ['biography', 'true story', 'non-fiction', 'nonfiction', 'autobiograph'],
};

const LIST_STATUS_OPTIONS = [
  { key: 'all', label: 'Όλα' },
  { key: 'owned', label: 'Στη Συλλογή μου' },
  { key: 'not_owned', label: 'Δεν το έχω' },
  { key: 'wanted', label: 'Το Ψάχνω' },
  { key: 'read', label: 'Διαβασμένο' },
  { key: 'not_read', label: 'Αδιάβαστο' },
  { key: 'favorite', label: 'Αγαπημένα' },
];

const FOREIGN_PUBLISHERS = [
  'Marvel',
  'DC Comics',
  'Image',
  'Dark Horse',
  'IDW',
  'BOOM! Studios',
  'Dynamite',
  'Valiant',
  'Oni Press',
  'Viz Media',
  'Kodansha',
  'Rebellion',
  'Titan Comics',
  'Ablaze',
  'AfterShock',
];

function fmtLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWeekRange(offsetWeeks = 0): { after: string; before: string; label: string } {
  const now = new Date();
  now.setDate(now.getDate() + offsetWeeks * 7);
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmtLabel = (d: Date) =>
    d.toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return {
    after: fmtLocal(monday),
    before: fmtLocal(sunday),
    label: `${fmtLabel(monday)} – ${fmtLabel(sunday)}`,
  };
}

type CalendarRange = {
  after: string;
  before: string;
  label: string;
  dateField: 'store' | 'foc';
  pageSize: string;
};

function getCalendarRange(mode: string, offset: number): CalendarRange {
  if (mode === 'week' || mode === 'foc') {
    const week = getWeekRange(offset);
    return {
      ...week,
      dateField: mode === 'foc' ? 'foc' : 'store',
      pageSize: '40',
    };
  }

  const monthShift = (mode === 'previews' ? 1 : 0) + offset;
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + monthShift, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
  const monthLabel = start.toLocaleDateString('el-GR', { month: 'long', year: 'numeric' });
  const catalogLabel =
    mode === 'previews' ? `Previews · ${monthLabel}` : mode === 'prh' ? `PRH · ${monthLabel}` : `Lunar · ${monthLabel}`;
  return {
    after: fmtLocal(start),
    before: fmtLocal(end),
    label: catalogLabel,
    dateField: 'store',
    pageSize: '40',
  };
}

/** Metron issue list omits publisher; series detail includes it. Cache across week loads. */
const seriesPublisherCache = new Map<number, { id: number; name: string } | null>();
const releasesCache = new Map<string, MetronIssue[]>();

function releasesCacheKey(
  mode: string,
  offset: number,
  publishers: string[] = [],
  allDates = false,
  seriesQuery = '',
) {
  const pub = [...publishers].map((p) => p.toLowerCase()).sort().join('|');
  const q = seriesQuery.trim().toLowerCase();
  const base = allDates ? `all:${q}` : `${mode}:${offset}`;
  return pub ? `${base}:${pub}` : base;
}

async function fetchSeriesPublisher(seriesId: number): Promise<{ id: number; name: string } | null> {
  if (seriesPublisherCache.has(seriesId)) {
    return seriesPublisherCache.get(seriesId) ?? null;
  }
  try {
    const res = await metronProxyFetch(`/series/${seriesId}/`, {}, { priority: 'low' });
    if (!res.ok) {
      seriesPublisherCache.set(seriesId, null);
      return null;
    }
    const data = await res.json();
    const pub =
      data?.publisher && typeof data.publisher === 'object' && data.publisher.name
        ? { id: Number(data.publisher.id) || 0, name: String(data.publisher.name) }
        : null;
    seriesPublisherCache.set(seriesId, pub);
    return pub;
  } catch {
    seriesPublisherCache.set(seriesId, null);
    return null;
  }
}

/** Background enrichment — never blocks the list; few series, after a pause. */
async function enrichIssuesWithPublishers(issues: MetronIssue[]): Promise<MetronIssue[]> {
  const seriesIds = [
    ...new Set(
      issues
        .filter((issue) => getPublisherName(issue) === '—')
        .map((issue) => issue.series?.id)
        .filter((id): id is number => typeof id === 'number' && id > 0),
    ),
  ];
  // Keep enrichment light so list loads stay snappy under Metron rate limits.
  const missing = seriesIds.filter((id) => !seriesPublisherCache.has(id)).slice(0, 5);

  for (const id of missing) {
    await fetchSeriesPublisher(id);
  }

  return issues.map((issue) => {
    if (getPublisherName(issue) !== '—') return issue;
    const pub = issue.series?.id != null ? seriesPublisherCache.get(issue.series.id) : null;
    if (!pub) return issue;
    return {
      ...issue,
      publisher: pub,
      series: { ...issue.series, publisher: pub },
    };
  });
}

async function fetchNewReleases(
  calendarMode: string,
  offset: number,
  publisherNames: string[] = [],
  opts?: {
    allDates?: boolean;
    seriesQuery?: string;
  },
): Promise<MetronIssue[]> {
  const names = publisherNames.slice(0, 1);
  const allDates = Boolean(opts?.allDates);
  const seriesQuery = (opts?.seriesQuery ?? '').trim();
  const key = releasesCacheKey(calendarMode, offset, names, allDates, seriesQuery);
  const cached = releasesCache.get(key);
  if (cached) return cached;

  const range = getCalendarRange(calendarMode, offset);
  const results = (await fetchCatalogWeek({
    after: allDates ? undefined : range.after,
    before: allDates ? undefined : range.before,
    dateField: range.dateField,
    publisherName: names[0],
    seriesQuery: seriesQuery || undefined,
  })) as MetronIssue[];

  if (results.length > 0) releasesCache.set(key, results);
  return results;
}

function formatDate(iso: string): string {
  if (!iso || iso === '—') return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('el-GR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getPublisherName(issue: MetronIssue): string {
  // Top-level publisher
  if (typeof issue.publisher === 'string' && issue.publisher) return issue.publisher;
  if (issue.publisher && typeof issue.publisher === 'object' && issue.publisher.name) return issue.publisher.name;
  if (issue.publisher_name) return issue.publisher_name;
  // Nested in series
  if (issue.series?.publisher_name) return issue.series.publisher_name;
  if (typeof issue.series?.publisher === 'string' && issue.series.publisher) return issue.series.publisher;
  if (issue.series?.publisher && typeof issue.series.publisher === 'object' && issue.series.publisher.name) return issue.series.publisher.name;
  return '—';
}

function issueSearchBlob(issue: MetronIssue): string {
  return `${issue.series?.name ?? ''} ${issue.issue ?? ''} ${issue.number ?? ''}`.toLowerCase();
}

function getIssueFormatTags(issue: MetronIssue): Set<string> {
  const blob = issueSearchBlob(issue);
  const tags = new Set<string>();
  if (/\bannuals?\b|ετήσι/.test(blob)) tags.add('annual');
  if (/\bdigital\b|\bchapter\b/.test(blob)) tags.add('digital');
  if (/\bvariant\b|\breprint/.test(blob)) tags.add('variant');
  if (/\btpb\b|trade paperback|graphic novel|collected/.test(blob)) tags.add('tpb');
  if (/\bhardcover\b|\bhard cover\b|\bhc\b/.test(blob)) tags.add('hardcover');
  if (/\bfacsimile\b/.test(blob)) tags.add('facsimile');
  if (/\bombibus\b/.test(blob)) tags.add('omnibus');
  const num = String(issue.number ?? '').replace(/^#/, '').replace(/\.0+$/, '').trim();
  if (num === '1') tags.add('first_issue');
  const special = ['annual', 'digital', 'variant', 'tpb', 'hardcover', 'facsimile', 'omnibus'];
  if (![...tags].some((t) => special.includes(t))) tags.add('regular');
  return tags;
}

function matchesFormats(issue: MetronIssue, selected: Set<string>): boolean {
  if (selected.size === 0) return true;
  const tags = getIssueFormatTags(issue);
  for (const key of selected) {
    if (tags.has(key)) return true;
  }
  return false;
}

function matchesGenres(issue: MetronIssue, selected: Set<string>): boolean {
  if (selected.size === 0) return true;
  const blob = issueSearchBlob(issue);
  for (const key of selected) {
    const words = GENRE_KEYWORDS[key] ?? [key];
    if (words.some((w) => blob.includes(w.toLowerCase()))) return true;
  }
  return false;
}

function issueMatchKey(series: string, number: string): string {
  const s = series.trim().toLowerCase().replace(/^the\s+/, '').replace(/\s+/g, ' ');
  const n = String(number).replace(/^#/, '').replace(/\.0+$/, '').trim();
  return `${s}#${n}`;
}

function publisherNameMatches(issueName: string, selected: Set<string>): boolean {
  const n = issueName.trim().toLowerCase();
  if (!n || n === '—') return false;
  for (const raw of selected) {
    const k = raw.trim().toLowerCase();
    if (!k) continue;
    if (n.includes(k) || k.includes(n)) return true;
  }
  return false;
}

function getPublisherSiteUrl(publisherName: string): string | null {
  const n = publisherName.trim().toLowerCase();
  if (!n || n === '—') return null;

  const greek = GREEK_PUBLISHERS.find((p) => n.includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(n));
  if (greek) return greek.url;

  const foreign: [string, string][] = [
    ['marvel', 'https://www.marvel.com/comics'],
    ['dc comic', 'https://www.dc.com/comics'],
    ['dc entertainment', 'https://www.dc.com/comics'],
    ['image comic', 'https://imagecomics.com/'],
    ['dark horse', 'https://www.darkhorse.com/'],
    ['idw', 'https://idwpublishing.com/'],
    ['boom', 'https://www.boom-studios.com/'],
    ['rebellion', 'https://rebellion.com/'],
    ['2000 ad', 'https://2000ad.com/'],
    ['viz', 'https://www.viz.com/'],
    ['kodansha', 'https://kodansha.us/'],
  ];
  for (const [key, url] of foreign) {
    if (n.includes(key)) return url;
  }
  return null;
}

/** Prefer the specific title product page; fall back to publisher search / home. */
function getIssueSiteUrl(issue: MetronIssue): string | null {
  const direct = typeof issue.sourceUrl === 'string' ? issue.sourceUrl.trim() : '';
  if (direct) return direct;

  const publisherName = getPublisherName(issue);
  const title = `${issue.series?.name ?? ''} ${issue.number ?? ''}`.trim();
  const n = publisherName.trim().toLowerCase();

  if (n.includes('μαμούθ') || n.includes('mamouth')) {
    return title
      ? `https://mamouthcomix.gr/?s=${encodeURIComponent(title)}`
      : 'https://mamouthcomix.gr/';
  }
  if (n.includes('jemma')) {
    return title
      ? `https://jemmacomics.com/?s=${encodeURIComponent(title)}`
      : 'https://jemmacomics.com/';
  }
  if (n.includes('anubis')) {
    return title
      ? `https://anubis.gr/?s=${encodeURIComponent(title)}`
      : 'https://anubis.gr/';
  }
  if (n.includes('μικρός ήρως') || n.includes('mikrosiros') || n.includes('mikros iros')) {
    return title
      ? `https://www.mikrosiros.gr/index.php?route=product/search&search=${encodeURIComponent(title)}`
      : 'https://www.mikrosiros.gr/';
  }
  if (n.includes('brainfood') || n.includes('οξύ') || n.includes('oxy')) {
    return title
      ? `https://brainfood.gr/?s=${encodeURIComponent(title)}`
      : 'https://brainfood.gr/ekdoseis/comic/';
  }
  if (n.includes('κάκτος') || n.includes('kaktos')) {
    return title
      ? `https://www.kaktos.gr/?s=${encodeURIComponent(title)}`
      : 'https://www.kaktos.gr/';
  }
  if (n.includes('πατάκ')) {
    return title
      ? `https://www.patakis.gr/?s=${encodeURIComponent(title)}`
      : 'https://www.patakis.gr/';
  }
  if (n.includes('μεταίχμιο') || n.includes('metaixmio')) {
    return title
      ? `https://www.metaixmio.gr/el/search?q=${encodeURIComponent(title)}`
      : 'https://www.metaixmio.gr/el/categories/graphic-novels';
  }
  if (n.includes('διόπτρα') || n.includes('dioptra')) {
    return title
      ? `https://www.dioptra.gr/anazitisi?q=${encodeURIComponent(title)}`
      : 'https://www.dioptra.gr/';
  }
  if (n.includes('polaris')) {
    return title
      ? `https://www.polarisekdoseis.gr/?s=${encodeURIComponent(title)}`
      : 'https://www.polarisekdoseis.gr/product-category/graphic-novels/';
  }

  if (issue.id > 0 && issue.id < 9000000) {
    return `https://metron.cloud/issue/${issue.id}/`;
  }

  return getPublisherSiteUrl(publisherName);
}

function isGreekIssue(issue: MetronIssue): boolean {
  if (issue.id >= 9000000) return true;
  return (
    detectComicMarket(issue.series?.name, getPublisherName(issue), String(issue.number ?? '')) ===
    'greek'
  );
}

function ReleaseCard({
  issue,
  isFav,
  inCollection,
  adding,
  cardW,
  coverH,
  showSiteLink,
  onToggleFav,
  onAddCollection,
  onPress,
}: {
  issue: MetronIssue;
  isFav: boolean;
  inCollection: boolean;
  adding: boolean;
  cardW: number;
  coverH: number;
  showSiteLink: boolean;
  onToggleFav: () => void;
  onAddCollection: () => void;
  onPress: () => void;
}) {
  const publisherName = getPublisherName(issue);
  const issueSite = showSiteLink ? getIssueSiteUrl(issue) : null;

  const openIssueSite = () => {
    if (!issueSite) return;
    Linking.openURL(issueSite).catch(() => {});
  };

  return (
    <View style={[styles.card, { width: cardW }]}>
      {issue.image ? (
        <ZoomableCover
          uri={issue.image}
          style={{ width: cardW, height: coverH }}
          resizeMode="cover"
          caption={`${issue.series.name} #${issue.number}`}
        />
      ) : (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${issue.series.name} #${issue.number}`}>
          <View style={[{ width: cardW, height: coverH }, styles.coverPlaceholder]}>
            <Text style={styles.coverPlaceholderText} numberOfLines={3}>
              {issue.series.name}
            </Text>
            <Text style={styles.coverPlaceholderNum}>#{issue.number}</Text>
          </View>
        </Pressable>
      )}
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${issue.series.name} #${issue.number}`}>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {issue.series.name} #{issue.number}
          </Text>
          <Text style={styles.cardPublisher} numberOfLines={1}>
            {publisherName}
          </Text>
          <View style={styles.cardMeta}>
            <Text style={styles.cardDate} numberOfLines={1}>
              {formatDate(issue.store_date ?? issue.cover_date ?? '')}
            </Text>
            {issue.price ? (
              <Text style={styles.cardPrice}>
                {' '}
                · {issue.id >= 9000000 ? '€' : '$'}
                {issue.price}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>

      <View style={styles.cardActions}>
        <Pressable
          style={[styles.actionBtn, isFav && styles.actionBtnActive]}
          onPress={onToggleFav}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Αγαπημένα">
          <Ionicons
            name={isFav ? 'heart' : 'heart-outline'}
            size={15}
            color={theme.kirbyRed}
          />
        </Pressable>
        <Pressable
          style={[styles.actionBtn, styles.actionBtnAdd, inCollection && styles.actionBtnInCol]}
          onPress={onAddCollection}
          disabled={adding}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={inCollection ? 'Αφαίρεση από τη συλλογή' : 'Προσθήκη στη συλλογή'}>
          {adding ? (
            <ActivityIndicator size="small" color={theme.surface} />
          ) : (
            <Ionicons
              name={inCollection ? 'checkmark-circle' : 'add-circle-outline'}
              size={16}
              color={inCollection ? theme.kirbyMagenta : theme.surface}
            />
          )}
        </Pressable>
        {issueSite ? (
          <Pressable
            style={[styles.actionBtn, styles.actionBtnSite]}
            onPress={openIssueSite}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Σελίδα τίτλου">
            <Ionicons name="open-outline" size={15} color={theme.kirbyBlue} />
          </Pressable>
        ) : showSiteLink ? (
          <View style={styles.actionBtnSpacer} />
        ) : null}
      </View>
    </View>
  );
}

type FilterSection = 'calendar' | 'sort' | 'format' | 'genre' | 'publishers' | 'listStatus' | null;

function FilterPanel({
  visible,
  filters,
  publishers,
  panelWidth,
  onClose,
  onApply,
}: {
  visible: boolean;
  filters: Filters;
  publishers: string[];
  panelWidth: number;
  onClose: () => void;
  onApply: (f: Filters) => void;
}) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = getTabBarHeight(insets.bottom);
  const [local, setLocal] = useState<Filters>(() => cloneFilters(filters));
  const [openSection, setOpenSection] = useState<FilterSection>(null);
  const [publisherQuery, setPublisherQuery] = useState('');
  const [mounted, setMounted] = useState(visible);
  const slideAnim = useRef(new Animated.Value(panelWidth)).current;

  useEffect(() => {
    if (!visible) slideAnim.setValue(panelWidth);
  }, [panelWidth, slideAnim, visible]);

  useEffect(() => {
    if (visible) {
      setLocal(cloneFilters(filters));
      setMounted(true);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: false,
      }).start();
      return;
    }

    Animated.timing(slideAnim, {
      toValue: panelWidth,
      duration: 240,
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setMounted(false);
        setOpenSection(null);
        setPublisherQuery('');
      }
    });
  }, [visible, slideAnim, panelWidth, filters]);

  const toggleSet = (field: 'formats' | 'genres' | 'publishers', key: string) => {
    setLocal((prev) => {
      const next = new Set(prev[field]);
      next.has(key) ? next.delete(key) : next.add(key);
      return { ...prev, [field]: next };
    });
  };

  const SectionHeader = ({
    id,
    label,
    badge,
  }: {
    id: FilterSection;
    label: string;
    badge?: number;
  }) => {
    const open = openSection === id;
    return (
      <Pressable
        style={[styles.sectionHeader, open && styles.sectionHeaderOpen]}
        onPress={() => setOpenSection(open ? null : id)}>
        <Text style={styles.sectionHeaderText}>{label}</Text>
        {badge ? (
          <View style={styles.sectionBadge}>
            <Text style={styles.sectionBadgeText}>{badge}</Text>
          </View>
        ) : null}
        <Ionicons
          name={open ? 'chevron-down' : 'chevron-forward'}
          size={16}
          color={open ? theme.kirbyMagenta : theme.textMuted}
          style={{ marginLeft: 'auto' }}
        />
      </Pressable>
    );
  };

  const Radio = ({ selected }: { selected: boolean }) => (
    <View style={[styles.radio, selected && styles.radioActive]}>
      {selected && <View style={styles.radioDot} />}
    </View>
  );

  const Checkbox = ({ checked }: { checked: boolean }) => (
    <View style={[styles.checkbox, checked && styles.checkboxActive]}>
      {checked && <Ionicons name="checkmark" size={12} color={theme.surface} />}
    </View>
  );

  if (!mounted) return null;

  return (
    <View style={[styles.filterModalRoot, { bottom: tabBarHeight }]} pointerEvents="box-none">
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      <Animated.View
        style={[
          styles.filterPanel,
          { width: panelWidth, paddingTop: 12, transform: [{ translateX: slideAnim }] },
        ]}>
        <View style={styles.filterHeader}>
          <Text style={styles.filterTitle}>ΦΙΛΤΡΑ</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={theme.text} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <SectionHeader id="calendar" label="ΗΜΕΡΟΛΟΓΙΑΚΑ" badge={local.calendarMode !== 'week' ? 1 : undefined} />
          {openSection === 'calendar' && CALENDAR_OPTIONS.map((opt) => (
            <Pressable key={opt.key} style={styles.filterRow} onPress={() => setLocal((p) => ({ ...p, calendarMode: opt.key }))}>
              <Radio selected={local.calendarMode === opt.key} />
              <Text style={[styles.filterLabel, local.calendarMode === opt.key && styles.filterLabelActive]}>{opt.label}</Text>
            </Pressable>
          ))}

          <SectionHeader id="sort" label="ΤΑΞΙΝΟΜΗΣΗ" badge={local.sortBy !== 'alpha_asc' ? 1 : undefined} />
          {openSection === 'sort' && SORT_OPTIONS.map((opt) => (
            <Pressable key={opt.key} style={styles.filterRow} onPress={() => setLocal((p) => ({ ...p, sortBy: opt.key }))}>
              <Radio selected={local.sortBy === opt.key} />
              <Text style={[styles.filterLabel, local.sortBy === opt.key && styles.filterLabelActive]}>{opt.label}</Text>
            </Pressable>
          ))}

          <SectionHeader id="format" label="ΜΟΡΦΗ" badge={local.formats.size || undefined} />
          {openSection === 'format' && FORMAT_OPTIONS.map((f) => (
            <Pressable key={f.key} style={styles.filterRow} onPress={() => toggleSet('formats', f.key)}>
              <Checkbox checked={local.formats.has(f.key)} />
              <Text style={[styles.filterLabel, local.formats.has(f.key) && styles.filterLabelActive]}>{f.label}</Text>
            </Pressable>
          ))}

          <SectionHeader id="genre" label="ΚΑΤΗΓΟΡΙΕΣ / ΕΙΔΟΣ" badge={local.genres.size || undefined} />
          {openSection === 'genre' && GENRE_OPTIONS.map((g) => (
            <Pressable key={g.key} style={styles.filterRow} onPress={() => toggleSet('genres', g.key)}>
              <Checkbox checked={local.genres.has(g.key)} />
              <Text style={[styles.filterLabel, local.genres.has(g.key) && styles.filterLabelActive]}>{g.label}</Text>
            </Pressable>
          ))}

          <SectionHeader id="publishers" label="ΕΚΔΟΣΕΙΣ" badge={local.publishers.size || undefined} />
          {openSection === 'publishers' && (
            <>
              <View style={styles.publisherSearchWrap}>
                <Ionicons name="search" size={14} color={theme.textMuted} />
                <TextInput
                  style={styles.publisherSearchInput}
                  placeholder="Αναζήτηση έκδοσης…"
                  placeholderTextColor={theme.textMuted}
                  value={publisherQuery}
                  onChangeText={setPublisherQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {publisherQuery.length > 0 ? (
                  <Pressable onPress={() => setPublisherQuery('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={14} color={theme.textMuted} />
                  </Pressable>
                ) : null}
              </View>
              {(publisherQuery.trim()
                ? publishers.filter((pub) => pub.toLowerCase().includes(publisherQuery.trim().toLowerCase()))
                : publishers
              ).map((pub) => (
                <Pressable key={pub} style={styles.filterRow} onPress={() => toggleSet('publishers', pub)}>
                  <Checkbox checked={local.publishers.has(pub)} />
                  <Text style={[styles.filterLabel, local.publishers.has(pub) && styles.filterLabelActive]}>{pub}</Text>
                </Pressable>
              ))}
              {publishers.length === 0 ? (
                <Text style={styles.publisherEmpty}>Δεν υπάρχουν εκδόσεις στη λίστα.</Text>
              ) : null}
            </>
          )}

          <SectionHeader id="listStatus" label="ΚΑΤΑΣΤΑΣΗ ΛΙΣΤΑΣ ΜΟΥ" badge={local.listStatus !== 'all' ? 1 : undefined} />
          {openSection === 'listStatus' && LIST_STATUS_OPTIONS.map((opt) => (
            <Pressable key={opt.key} style={styles.filterRow} onPress={() => setLocal((p) => ({ ...p, listStatus: opt.key }))}>
              <Radio selected={local.listStatus === opt.key} />
              <Text style={[styles.filterLabel, local.listStatus === opt.key && styles.filterLabelActive]}>{opt.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.filterFooter}>
          <Pressable
            style={styles.filterReset}
            onPress={() => setLocal(cloneFilters(DEFAULT_FILTERS))}>
            <Text style={styles.filterResetText}>Επαναφορά</Text>
          </Pressable>
          <Pressable
            style={styles.filterApply}
            onPress={() => {
              onApply(cloneFilters(local));
              onClose();
            }}>
            <Text style={styles.filterApplyText}>Εφαρμογή</Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

function cloneFilters(f: Filters): Filters {
  return {
    calendarMode: f.calendarMode,
    sortBy: f.sortBy,
    formats: new Set(f.formats),
    genres: new Set(f.genres),
    publishers: new Set(f.publishers),
    listStatus: f.listStatus,
  };
}

export default function NewReleasesScreen() {
  const router = useRouter();
  const { width } = useAppViewport();
  const { cols, cardW, coverH, filterPanelW } = useMemo(() => getGridMetrics(width), [width]);
  const { items: collectionItems, reload: reloadCollection } = useCollectionData();
  const [periodOffset, setPeriodOffset] = useState(0);
  const [calendarEnabled, setCalendarEnabled] = useState(true);
  const [issues, setIssues] = useState<MetronIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [collected, setCollected] = useState<Set<number>>(new Set());
  const [collectedItemId, setCollectedItemId] = useState<Record<number, string>>({});
  const [addingId, setAddingId] = useState<number | null>(null);
  const addingLock = useRef<number | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS, formats: new Set(), genres: new Set(), publishers: new Set() });
  const [showGreek, setShowGreek] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (calendarEnabled && !showArchive) {
      setDebouncedSearch('');
      return;
    }
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search, calendarEnabled, showArchive]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError(null);

      const publisherNames = [...filters.publishers];
      const allDates = !calendarEnabled && !showArchive;
      const seriesQuery = allDates ? debouncedSearch : '';
      const cacheKey = releasesCacheKey(
        filters.calendarMode,
        periodOffset,
        publisherNames,
        allDates,
        seriesQuery,
      );
      const cached = !showGreek ? releasesCache.get(cacheKey) : null;

      const applyPublisherEnrichment = (rows: MetronIssue[]) => {
        // Skip on a full week list — extra series calls burn Metron burst
        // and then issue-detail 429s. Publisher filters still use server-side names.
        if (rows.length > 40) return;
        const needsEnrichment = rows.some((issue) => getPublisherName(issue) === '—');
        if (!needsEnrichment) return;
        void enrichIssuesWithPublishers(rows).then((enriched) => {
          if (!active) return;
          releasesCache.set(cacheKey, enriched);
          setIssues(enriched);
        });
      };

      if (showArchive) {
        void fetchReleaseFavoriteIds()
          .then((favIds) => {
            if (active) setFavorites(favIds);
          })
          .catch(() => undefined);

        const q = debouncedSearch.trim();
        if (q.length < 2) {
          setIssues([]);
          setLoading(false);
          setLoadingMore(false);
          setError(null);
          return () => {
            active = false;
            setShowFilters(false);
          };
        }

        setLoading(true);
        setLoadingMore(false);
        setError(null);
        searchArchive({ query: q, greek: showGreek })
          .then((rows) => {
            if (!active) return;
            setIssues(rows as MetronIssue[]);
            setLoading(false);
          })
          .catch((e) => {
            if (!active) return;
            setIssues([]);
            setError(e instanceof Error ? e.message : 'Αποτυχία αναζήτησης στο αρχείο.');
            setLoading(false);
          });

        return () => {
          active = false;
          setShowFilters(false);
        };
      }

      if (showGreek) {
        void fetchReleaseFavoriteIds()
          .then((favIds) => {
            if (active) setFavorites(favIds);
          })
          .catch(() => undefined);

        const seeded = fetchGreekReleases({ recentOnly: true }) as MetronIssue[];
        setIssues(seeded);
        setLoading(false);
        setLoadingMore(true);
        setError(null);
        loadGreekMarketReleases()
          .then((rows) => {
            if (!active) return;
            setIssues(rows as MetronIssue[]);
            setLoadingMore(false);
          })
          .catch((e) => {
            if (!active) return;
            if (seeded.length === 0) {
              setError(e instanceof Error ? e.message : 'Αποτυχία φόρτωσης ελληνικών κυκλοφοριών.');
            }
            setLoadingMore(false);
          });
        return () => {
          active = false;
          setShowFilters(false);
        };
      }

      void fetchReleaseFavoriteIds()
        .then((favIds) => {
          if (active) setFavorites(favIds);
        })
        .catch(() => undefined);

      // Instant paint from cache — never block the spinner on enrichment / soft refresh.
      if (cached?.length) {
        setIssues(cached);
        setLoading(false);
        setLoadingMore(false);
        applyPublisherEnrichment(cached);
        return () => {
          active = false;
          setShowFilters(false);
        };
      }

      setLoading(true);
      setLoadingMore(false);
      setIssues([]);

      const load = async () => {
        const data = await fetchNewReleases(filters.calendarMode, periodOffset, publisherNames, {
          allDates,
          seriesQuery,
        });
        if (!active) return;
        setIssues(data);
        setLoading(false);
        setLoadingMore(false);
        applyPublisherEnrichment(data);
      };

      load()
        .catch((e) => {
          if (!active) return;
          setError(e instanceof Error ? e.message : 'Αποτυχία.');
        })
        .finally(() => {
          if (active) {
            setLoading(false);
            setLoadingMore(false);
          }
        });

      return () => {
        active = false;
        setShowFilters(false);
      };
    }, [
      periodOffset,
      showGreek,
      showArchive,
      reloadKey,
      filters.calendarMode,
      filters.publishers,
      calendarEnabled,
      debouncedSearch,
    ]),
  );

  const { label } = getCalendarRange(filters.calendarMode, periodOffset);

  const collectionIndex = useMemo(() => {
    const owned = new Set<string>();
    const wanted = new Set<string>();
    const read = new Set<string>();
    const fav = new Set<string>();
    const itemIdByKey = new Map<string, string>();
    for (const item of collectionItems) {
      const key = issueMatchKey(item.series, item.issue);
      owned.add(key);
      itemIdByKey.set(key, item.id);
      if (item.isWishlist) wanted.add(key);
      if (item.isRead) read.add(key);
      if (item.isFavorite) fav.add(key);
    }
    return { owned, wanted, read, fav, itemIdByKey };
  }, [collectionItems]);

  // Unique publishers from results
  const publisherList = useMemo(() => {
    const set = new Set<string>(showGreek ? GREEK_PUBLISHERS.map((p) => p.name) : FOREIGN_PUBLISHERS);
    issues.forEach((i) => {
      const n = getPublisherName(i);
      if (n !== '—') set.add(n);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'el'));
  }, [issues, showGreek]);

  // Apply search + filters + sort
  const filtered = useMemo(() => {
    let result = [...issues];
    if (!showGreek && !showArchive) {
      result = result.filter((i) => !isGreekIssue(i));
    }
    if (search.trim() && !showArchive) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.series.name.toLowerCase().includes(q) ||
          getPublisherName(i).toLowerCase().includes(q),
      );
    }
    if (filters.publishers.size > 0) {
      result = result.filter((i) => {
        const name = getPublisherName(i);
        if (name === '—') return !showGreek;
        return publisherNameMatches(name, filters.publishers);
      });
    }
    if (filters.formats.size > 0) {
      result = result.filter((i) => matchesFormats(i, filters.formats));
    }
    if (filters.genres.size > 0) {
      result = result.filter((i) => matchesGenres(i, filters.genres));
    }
    if (filters.listStatus !== 'all') {
      result = result.filter((i) => {
        const key = issueMatchKey(i.series.name, i.number);
        const owned = collected.has(i.id) || collectionIndex.owned.has(key);
        switch (filters.listStatus) {
          case 'owned':
            return owned;
          case 'not_owned':
            return !owned;
          case 'wanted':
            return collectionIndex.wanted.has(key);
          case 'read':
            return collectionIndex.read.has(key);
          case 'not_read':
            return owned && !collectionIndex.read.has(key);
          case 'favorite':
            return favorites.has(i.id) || collectionIndex.fav.has(key);
          default:
            return true;
        }
      });
    }
    result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'alpha_desc':
          return b.series.name.localeCompare(a.series.name, 'el');
        case 'date_newest':
          return (b.store_date ?? '').localeCompare(a.store_date ?? '');
        case 'date_oldest':
          return (a.store_date ?? '').localeCompare(b.store_date ?? '');
        case 'publisher_asc':
          return getPublisherName(a).localeCompare(getPublisherName(b), 'el');
        case 'publisher_desc':
          return getPublisherName(b).localeCompare(getPublisherName(a), 'el');
        default:
          return a.series.name.localeCompare(b.series.name, 'el');
      }
    });
    return result;
  }, [issues, search, filters, collected, favorites, showGreek, showArchive, collectionIndex]);

  const archiveSuggestions = useMemo(() => {
    if (!showArchive) return [];
    return suggestArchiveSearch(search, { greek: showGreek, limit: 5 });
  }, [showArchive, search, showGreek]);

  const showArchiveSuggestions = useMemo(() => {
    if (!showArchive || loading) return false;
    return shouldShowArchiveSuggestions(search, archiveSuggestions, filtered.length > 0);
  }, [showArchive, loading, search, archiveSuggestions, filtered.length]);

  const activeFilterCount =
    filters.formats.size +
    filters.genres.size +
    filters.publishers.size +
    (filters.listStatus !== 'all' ? 1 : 0) +
    (filters.sortBy !== 'alpha_asc' ? 1 : 0) +
    (filters.calendarMode !== 'week' ? 1 : 0);
  const maxPeriodOffset = filters.calendarMode === 'week' ? 1 : 4;

  const toggleFav = (issue: MetronIssue) => {
    const nextHas = !favorites.has(issue.id);
    setFavorites((prev) => {
      const next = new Set(prev);
      nextHas ? next.add(issue.id) : next.delete(issue.id);
      return next;
    });

    toggleReleaseFavorite({
      id: issue.id,
      seriesName: issue.series.name,
      number: issue.number,
      coverUrl: issue.image,
      publisher: getPublisherName(issue),
      storeDate: issue.store_date ?? issue.cover_date,
    }).catch(() => {
      // revert optimistic update
      setFavorites((prev) => {
        const next = new Set(prev);
        nextHas ? next.delete(issue.id) : next.add(issue.id);
        return next;
      });
    });
  };

  const handleAddCollection = async (issue: MetronIssue) => {
    if (addingLock.current === issue.id) return;
    addingLock.current = issue.id;
    const key = issueMatchKey(issue.series.name, issue.number);
    const alreadyIn =
      collected.has(issue.id) || collectionIndex.owned.has(key);
    const existingId = collectedItemId[issue.id] ?? collectionIndex.itemIdByKey.get(key);

    setAddingId(issue.id);
    try {
      if (alreadyIn) {
        const itemId = existingId || (await findCollectionItemId(issue.series.name, issue.number));
        if (itemId) await deleteCollectionItem(itemId);
        setCollected((prev) => {
          const next = new Set(prev);
          next.delete(issue.id);
          return next;
        });
        setCollectedItemId((prev) => {
          const next = { ...prev };
          delete next[issue.id];
          return next;
        });
        await reloadCollection();
        return;
      }

      const year = (issue.store_date ?? issue.cover_date ?? '').slice(0, 4);
      const publisher = getPublisherName(issue);
      const coverUrl = isHttpUrl(issue.image) ? issue.image : undefined;
      const itemId = await addCollectionItem({
        series: issue.series.name,
        issue: issue.number,
        publisher: publisher === '—' ? '' : publisher,
        category: 'comic',
        condition: 'NM',
        coverUrl,
        year: /^\d{4}$/.test(year) ? year : undefined,
      });
      setCollected((prev) => new Set(prev).add(issue.id));
      if (itemId) {
        setCollectedItemId((prev) => ({ ...prev, [issue.id]: itemId }));
      }
      await reloadCollection();
    } catch {
      if (alreadyIn) return;
      setManualAddPrefill({
        series: issue.series.name,
        issue: issue.number,
        publisher: getPublisherName(issue),
      });
      router.push('/(tabs)/add/manual');
    } finally {
      addingLock.current = null;
      setAddingId(null);
    }
  };

  const rows: MetronIssue[][] = [];
  for (let i = 0; i < filtered.length; i += cols) {
    rows.push(filtered.slice(i, i + cols));
  }

  return (
    <CosmicBackground variant="void">
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.heading}>ΚΥΚΛΟΦΟΡΙΕΣ</Text>
            <View style={styles.segRow}>
              <View style={styles.langSegment}>
                <Pressable
                  style={[styles.langSegBtn, !showGreek && styles.langSegBtnActive]}
                  onPress={() => {
                    setShowGreek(false);
                  }}>
                  <View style={[styles.langLamp, !showGreek && styles.langLampOn]} />
                  <Text style={[styles.langSegText, !showGreek && styles.langSegTextActive]}>Ξένα</Text>
                </Pressable>
                <View style={styles.langSegDivider} />
                <Pressable
                  style={[styles.langSegBtn, showGreek && styles.langSegBtnActive]}
                  onPress={() => {
                    setShowGreek(true);
                    setFilters((prev) => ({
                      ...prev,
                      sortBy: 'date_newest',
                      publishers: new Set(),
                      formats: new Set(),
                      genres: new Set(),
                      listStatus: 'all',
                    }));
                  }}>
                  <View style={[styles.langLamp, showGreek && styles.langLampOn]} />
                  <Text style={[styles.langSegText, showGreek && styles.langSegTextActive]}>Ελληνικά</Text>
                </Pressable>
              </View>
              <View style={styles.langSegment}>
                <Pressable
                  style={[styles.langSegBtn, !showArchive && styles.langSegBtnActive]}
                  onPress={() => setShowArchive(false)}>
                  <View style={[styles.langLamp, !showArchive && styles.langLampOn]} />
                  <Text style={[styles.langSegText, !showArchive && styles.langSegTextActive]}>Νέες</Text>
                </Pressable>
                <View style={styles.langSegDivider} />
                <Pressable
                  style={[styles.langSegBtn, showArchive && styles.langSegBtnActive]}
                  onPress={() => {
                    setShowArchive(true);
                    setFilters((prev) => ({ ...prev, sortBy: 'date_oldest' }));
                  }}>
                  <View style={[styles.langLamp, showArchive && styles.langLampOn]} />
                  <Text style={[styles.langSegText, showArchive && styles.langSegTextActive]}>Αρχείο</Text>
                </Pressable>
              </View>
            </View>
            {!showGreek && !showArchive ? (
              <View style={styles.weekPickerRow}>
                <View style={[styles.weekPicker, !calendarEnabled && styles.weekPickerDisabled]}>
                  <Pressable
                    style={[styles.weekArrow, !calendarEnabled && styles.weekArrowDisabled]}
                    onPress={() => calendarEnabled && setPeriodOffset((o) => o - 1)}
                    hitSlop={8}
                    disabled={!calendarEnabled}>
                    <Ionicons
                      name="chevron-back"
                      size={18}
                      color={!calendarEnabled ? theme.textMuted : theme.text}
                    />
                  </Pressable>
                  <View style={styles.weekLabelWrap}>
                    <Ionicons
                      name="calendar-outline"
                      size={14}
                      color={theme.textMuted}
                    />
                    <Text style={styles.weekLabel}>
                      {calendarEnabled ? label : 'Όλες οι ημερομηνίες'}
                    </Text>
                  </View>
                  <Pressable
                    style={[
                      styles.weekArrow,
                      (!calendarEnabled || periodOffset >= maxPeriodOffset) && styles.weekArrowDisabled,
                    ]}
                    onPress={() => {
                      if (calendarEnabled && periodOffset < maxPeriodOffset) {
                        setPeriodOffset((o) => o + 1);
                      }
                    }}
                    hitSlop={8}
                    disabled={!calendarEnabled || periodOffset >= maxPeriodOffset}>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={
                        !calendarEnabled || periodOffset >= maxPeriodOffset
                          ? theme.textMuted
                          : theme.text
                      }
                    />
                  </Pressable>
                </View>
                <Pressable
                  style={[styles.calendarToggleBtn, !calendarEnabled && styles.calendarToggleBtnOff]}
                  onPress={() => setCalendarEnabled((v) => !v)}
                  hitSlop={6}
                  accessibilityLabel={
                    calendarEnabled
                      ? 'Απενεργοποίηση ημερολογίου — αναζήτηση σε όλες τις ημερομηνίες'
                      : 'Ενεργοποίηση ημερολογίου'
                  }
                  accessibilityState={{ checked: !calendarEnabled }}>
                  {calendarEnabled ? (
                    <View style={styles.calendarOffIcon} accessibilityElementsHidden>
                      <Ionicons name="calendar-outline" size={18} color={theme.text} />
                      <View style={styles.calendarOffSlash} />
                    </View>
                  ) : (
                    <Ionicons name="calendar" size={18} color={theme.surface} />
                  )}
                </Pressable>
              </View>
            ) : null}
          </View>

          {/* Search + filter bar */}
          <View style={styles.topBar}>
            <View style={styles.searchColumn}>
              <View style={styles.searchWrap}>
                <Ionicons name="search" size={16} color={theme.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={
                    showArchive
                      ? showGreek
                        ? 'π.χ. Batman, Αστερίξ, Μπλεκ, 1980…'
                        : 'π.χ. Amazing Spider-Man, Batman, 1963…'
                      : 'Αναζήτηση…'
                  }
                  placeholderTextColor={theme.textMuted}
                  value={search}
                  onChangeText={setSearch}
                  returnKeyType="search"
                />
                {search.length > 0 && (
                  <Pressable onPress={() => setSearch('')} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                  </Pressable>
                )}
              </View>
              {showArchiveSuggestions ? (
                <View style={styles.suggestBox}>
                  <Text style={styles.suggestTitle}>Μήπως εννοούσες;</Text>
                  {archiveSuggestions.map((item) => (
                    <Pressable
                      key={item.query}
                      style={styles.suggestRow}
                      onPress={() => setSearch(item.query)}>
                      <Ionicons name="search-outline" size={14} color={theme.textMuted} />
                      <Text style={styles.suggestText} numberOfLines={1}>
                        {item.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
            <Pressable style={styles.filterBtn} onPress={() => setShowFilters(true)} hitSlop={6}>
              <Ionicons name="options" size={20} color={theme.text} />
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
          {showArchive ? (
            <Text style={styles.archiveHint}>
              Ψάξε παλιά κόμικ — πρώτα τεύχη και δεκαετίες πίσω. Δοκίμασε τίτλο, ήρωα ή χρονιά (π.χ.
              «Batman 1966», «δεκαετία 80»).
            </Text>
          ) : null}

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.kirbyMagenta} />
              <Text style={styles.loadingText}>
                {showArchive ? 'Αναζήτηση στο αρχείο…' : 'Φόρτωση κυκλοφοριών…'}
              </Text>
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={40} color={theme.kirbyRed} />
              <Text style={styles.errorText}>{error}</Text>
              {/πολλά αιτήματα|429/i.test(error) ? (
                <Text style={styles.errorHint}>
                  Το Metron περιορίζει τα αιτήματα όταν γίνονται πολλά μαζί. Περίμενε λίγα δευτερόλεπτα.
                </Text>
              ) : /καταλόγου|συνδεθεί|401/i.test(error) ? (
                <Text style={styles.errorHint}>
                  Το Metron απόρριψε τα στοιχεία σύνδεσης. Έλεγξε τα secrets METRON_USER και METRON_PASS στο Supabase.
                </Text>
              ) : null}
              <Pressable
                style={styles.retryBtn}
                onPress={() => {
                  releasesCache.delete(
                    releasesCacheKey(
                      filters.calendarMode,
                      periodOffset,
                      [...filters.publishers],
                      !calendarEnabled,
                      !calendarEnabled ? debouncedSearch : '',
                    ),
                  );
                  setReloadKey((k) => k + 1);
                }}>
                <Text style={styles.retryBtnText}>Ξαναδοκίμασε</Text>
              </Pressable>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>
                {showArchive
                  ? search.trim().length < 2
                    ? 'Γράψε τουλάχιστον 2 γράμματα για να βρεις παλιά τεύχη.'
                    : `Δεν βρέθηκαν παλιά τεύχη για «${search.trim()}».`
                  : issues.length === 0
                    ? showGreek
                      ? 'Δεν βρέθηκαν ελληνικές κυκλοφορίες στον κατάλογο.'
                      : 'Δεν βρέθηκαν κυκλοφορίες για αυτή την περίοδο.'
                    : 'Κανένα αποτέλεσμα για αυτά τα φίλτρα.'}
              </Text>
            </View>
          ) : (
            <View style={styles.grid}>
              <Text style={styles.count}>
                {filtered.length}
                {filtered.length !== issues.length ? `/${issues.length}` : ''} τεύχη
                {loadingMore ? ' · φόρτωση…' : ''}
              </Text>
              {rows.map((row, ri) => (
                <View key={ri} style={styles.row}>
                  {row.map((issue) => (
                    <ReleaseCard
                      key={issue.id}
                      issue={issue}
                      isFav={favorites.has(issue.id)}
                      inCollection={
                        collected.has(issue.id) ||
                        collectionIndex.owned.has(issueMatchKey(issue.series.name, issue.number))
                      }
                      adding={addingId === issue.id}
                      cardW={cardW}
                      coverH={coverH}
                      showSiteLink
                      onToggleFav={() => toggleFav(issue)}
                      onAddCollection={() => handleAddCollection(issue)}
                      onPress={() => router.push({ pathname: '/(tabs)/issue-detail', params: { id: String(issue.id) } })}
                    />
                  ))}
                  {row.length < cols &&
                    Array.from({ length: cols - row.length }).map((_, i) => (
                      <View key={`empty-${i}`} style={{ width: cardW }} />
                    ))}
                </View>
              ))}
              {loadingMore ? (
                <View style={styles.moreWrap}>
                  <ActivityIndicator size="small" color={theme.kirbyMagenta} />
                  <Text style={styles.loadingText}>Φόρτωση υπόλοιπων κυκλοφοριών…</Text>
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>

        <FilterPanel
          visible={showFilters}
          filters={filters}
          publishers={publisherList}
          panelWidth={filterPanelW}
          onClose={() => setShowFilters(false)}
          onApply={(f) => {
            if (f.calendarMode !== filters.calendarMode) setPeriodOffset(0);
            setFilters(f);
          }}
        />
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  searchColumn: {
    flex: 1,
    gap: 4,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
    padding: 0,
  },
  suggestBox: {
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.border,
    paddingVertical: 4,
  },
  suggestTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.textMuted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  suggestText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: theme.text,
  },
  filterBtn: {
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.border,
    padding: 8,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.kirbyMagenta,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  filterBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: theme.surface,
  },
  content: {
    paddingHorizontal: H_PAD,
    paddingTop: 10,
    paddingBottom: 24,
    gap: 12,
    width: '100%',
  },
  header: { gap: 8 },
  segRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  heading: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.kirbyYellow,
    letterSpacing: 1,
  },
  weekPickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
  },
  weekPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.border,
    alignSelf: 'flex-start',
    overflow: 'hidden',
  },
  weekPickerDisabled: {
    opacity: 0.55,
  },
  weekArrow: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  weekArrowDisabled: { opacity: 0.35 },
  weekLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: theme.border,
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.text,
  },
  calendarToggleBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.border,
  },
  calendarToggleBtnOff: {
    backgroundColor: theme.kirbyMagenta,
    borderColor: theme.cosmicInk,
  },
  calendarOffIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarOffSlash: {
    position: 'absolute',
    width: 22,
    height: 2.5,
    backgroundColor: theme.kirbyRed,
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }],
  },
  langSegment: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'flex-start',
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  langSegBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.surface,
  },
  langSegBtnActive: {
    backgroundColor: '#fff8e0',
  },
  langSegDivider: {
    width: 2,
    backgroundColor: theme.border,
  },
  langLamp: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#c8c4b8',
    borderWidth: 1,
    borderColor: theme.border,
  },
  langLampOn: {
    backgroundColor: '#3DDC84',
    borderColor: '#1a9a4a',
  },
  langSegText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textMuted,
  },
  langSegTextActive: {
    color: theme.text,
    fontWeight: '900',
  },
  count: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  center: { alignItems: 'center', paddingTop: 60, gap: 12 },
  moreWrap: { alignItems: 'center', paddingVertical: 16, gap: 8 },
  loadingText: { fontSize: 13, fontWeight: '700', color: theme.textMuted },
  errorText: { fontSize: 13, fontWeight: '800', color: theme.kirbyRed, textAlign: 'center' },
  errorHint: {
    fontSize: 11, fontWeight: '600', color: theme.textMuted,
    textAlign: 'center', paddingHorizontal: 24, lineHeight: 16,
  },
  retryBtn: {
    marginTop: 4,
    backgroundColor: theme.kirbyYellow,
    borderWidth: 2,
    borderColor: theme.cosmicInk,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: theme.cosmicInk,
  },
  emptyText: { fontSize: 13, fontWeight: '700', color: theme.textMuted, textAlign: 'center' },
  archiveHint: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.surface,
    opacity: 0.85,
    lineHeight: 17,
  },
  grid: { gap: GAP },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: GAP },
  card: {
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.border,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  coverPlaceholder: {
    backgroundColor: theme.kirbyBlue,
    padding: 6,
    justifyContent: 'space-between',
  },
  coverPlaceholderText: { fontSize: 9, fontWeight: '900', color: theme.surface, lineHeight: 11 },
  coverPlaceholderNum: {
    fontSize: 13, fontWeight: '900', color: theme.kirbyYellow, alignSelf: 'flex-end',
  },
  cardBody: {
    flexGrow: 1,
    flexShrink: 0,
    minHeight: 64,
    paddingHorizontal: 6,
    paddingTop: 6,
    paddingBottom: 2,
    gap: 2,
  },
  cardPublisher: {
    fontSize: 9,
    fontWeight: '900',
    color: theme.kirbyMagenta,
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    minHeight: 12,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.text,
    lineHeight: 14,
    minHeight: 28,
  },
  cardMeta: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 4,
    minHeight: 14,
  },
  cardDate: { fontSize: 10, fontWeight: '700', color: theme.textMuted },
  cardPrice: { fontSize: 10, fontWeight: '700', color: theme.textMuted },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 5,
    paddingTop: 4,
    flexShrink: 0,
  },
  actionBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 6, borderWidth: 1.5,
    borderColor: theme.kirbyRed, backgroundColor: theme.background,
  },
  actionBtnActive: { borderColor: theme.kirbyRed, backgroundColor: '#fff0f0' },
  actionBtnAdd: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 6, backgroundColor: theme.kirbyMagenta,
    borderWidth: 1.5, borderColor: theme.kirbyMagenta,
  },
  actionBtnSite: {
    borderColor: theme.kirbyBlue,
    backgroundColor: theme.background,
  },
  actionBtnInCol: { backgroundColor: theme.background, borderColor: theme.kirbyMagenta },
  actionBtnSpacer: { flex: 1 },

  // Filter sections
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    gap: 8,
  },
  sectionHeaderOpen: {
    backgroundColor: '#fff8e0',
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '900',
    color: theme.text,
    letterSpacing: 0.5,
  },
  sectionBadge: {
    backgroundColor: theme.kirbyMagenta,
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  sectionBadgeText: { fontSize: 10, fontWeight: '900', color: theme.surface },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background,
  },
  radioActive: { borderColor: theme.kirbyMagenta },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.kirbyMagenta,
  },
  filterLabelActive: { fontWeight: '900', color: theme.kirbyMagenta },

  // Filter panel
  filterModalRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 0,
  },
  filterPanel: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: theme.surface,
    borderLeftWidth: 2,
    borderLeftColor: theme.border,
    paddingBottom: 20,
    zIndex: 2,
    elevation: 12,
  },
  filterHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: 2, borderBottomColor: theme.border, marginBottom: 4,
  },
  filterTitle: {
    fontSize: 16, fontWeight: '900', color: theme.text, letterSpacing: 1,
  },
  filterSection: {
    fontSize: 11, fontWeight: '900', color: theme.kirbyMagenta,
    letterSpacing: 0.8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6,
  },
  filterRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  publisherSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.background,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  publisherSearchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: theme.text,
    padding: 0,
  },
  publisherEmpty: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textMuted,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  checkbox: {
    width: 20, height: 20, borderWidth: 2, borderColor: theme.border,
    backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: theme.kirbyMagenta, borderColor: theme.kirbyMagenta },
  filterLabel: { fontSize: 13, fontWeight: '700', color: theme.text },
  filterFooter: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 2, borderTopColor: theme.border,
  },
  filterReset: {
    flex: 1, paddingVertical: 10, borderWidth: 2, borderColor: theme.border,
    alignItems: 'center',
  },
  filterResetText: { fontSize: 12, fontWeight: '900', color: theme.text },
  filterApply: {
    flex: 1, paddingVertical: 10, backgroundColor: theme.kirbyMagenta,
    borderWidth: 2, borderColor: theme.kirbyMagenta, alignItems: 'center',
  },
  filterApplyText: { fontSize: 12, fontWeight: '900', color: theme.surface },
});

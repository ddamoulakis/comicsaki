import { GREEK_RELEASES, type GreekReleaseSeed } from '@/data/greekReleases';
import { greekShopFetch, greekShopFetchText } from '@/lib/greekShopClient';

/** Same shape as MetronIssue used by market screen. */
export type GreekMarketIssue = {
  id: number;
  series: {
    id: number;
    name: string;
    volume: number;
    publisher?: { id: number; name: string };
  };
  number: string;
  cover_date: string | null;
  store_date: string | null;
  image: string | null;
  publisher?: { id: number; name: string };
  price: string | null;
  currency: 'EUR';
  price_currency?: 'EUR';
  sourceUrl?: string;
};

type ShopCategory = { id: number; slug?: string; name?: string };
type ShopImage = { src?: string; thumbnail?: string };
type ShopProduct = {
  id: number;
  name: string;
  permalink?: string;
  prices?: { price?: string; regular_price?: string; currency_minor_unit?: number };
  images?: ShopImage[];
  categories?: ShopCategory[];
};

type ShopKind = 'woocommerce' | 'html';

type ShopConfig = {
  publisher: GreekReleaseSeed['publisher'];
  origin: string;
  idBase: number;
  kind: ShopKind;
  comicSlugs: string[];
  excludeSlugs: string[];
  requiredSlugs: string[];
  fetchSlugs: string[];
  catalogUrls?: string[];
  skipTitle?: RegExp;
};

const SHOPS: ShopConfig[] = [
  {
    publisher: 'Anubis',
    origin: 'https://anubis.gr',
    idBase: 9_100_000,
    kind: 'woocommerce',
    comicSlugs: [
      'graphic-novels',
      'manga',
      'super-heroes',
      'dc-kosmos',
      'marvel-kosmos',
      'fantasy-manga',
    ],
    excludeSlugs: ['e-books', 'anubis-kids', 'eikonografhmenes-istories', 'cart-games'],
    requiredSlugs: [],
    fetchSlugs: ['graphic-novels', 'manga'],
  },
  {
    publisher: 'Jemma Press',
    origin: 'https://jemmacomics.com',
    idBase: 9_200_000,
    kind: 'woocommerce',
    comicSlugs: [],
    excludeSlugs: ['back-issues', 'agalmata-action-figures'],
    requiredSlugs: ['jemma-press-ekdoseis', 'nees-kuklofories'],
    fetchSlugs: ['nees-kuklofories'],
  },
  {
    publisher: 'Μαμούθ Comix',
    origin: 'https://mamouthcomix.gr',
    idBase: 9_300_000,
    kind: 'woocommerce',
    comicSlugs: [],
    excludeSlugs: [],
    requiredSlugs: [],
    fetchSlugs: [],
  },
  {
    publisher: 'Οξύ / Brainfood',
    origin: 'https://brainfood.gr',
    idBase: 9_500_000,
    kind: 'woocommerce',
    comicSlugs: [],
    excludeSlugs: ['e-books', 'ebooks'],
    requiredSlugs: [],
    fetchSlugs: ['comic'],
    skipTitle:
      /πορτοφόλι|τσάντα|νεσεσέρ|μαξιλάρ|κάλτσ|μαγνήτ|αφίσα|poster|tote|κούπα|mug|καδράκι|puzzle|υφασμάτιν/i,
  },
  {
    publisher: 'Κάκτος',
    origin: 'https://www.kaktos.gr',
    idBase: 9_600_000,
    kind: 'woocommerce',
    comicSlugs: ['graphic-novel'],
    excludeSlugs: [],
    requiredSlugs: [],
    fetchSlugs: ['graphic-novel'],
  },
  {
    publisher: 'Μικρός Ήρως',
    origin: 'https://www.mikrosiros.gr',
    idBase: 9_400_000,
    kind: 'html',
    comicSlugs: [],
    excludeSlugs: [],
    requiredSlugs: [],
    fetchSlugs: [],
    catalogUrls: [
      'https://www.mikrosiros.gr/comics?sort=p.date_added&order=DESC',
      'https://www.mikrosiros.gr/',
    ],
    skipTitle: /σταυρόλεξ|sudoku|σκανδιναβ|προσφορά|e-book|ebook/i,
  },
  {
    publisher: 'Polaris',
    origin: 'https://www.polarisekdoseis.gr',
    idBase: 9_050_000,
    kind: 'html',
    comicSlugs: [],
    excludeSlugs: [],
    requiredSlugs: [],
    fetchSlugs: [],
    catalogUrls: ['https://www.polarisekdoseis.gr/product-category/graphic-novels/'],
    skipTitle: /notebook|dibond|έργα τέχνης/i,
  },
  {
    publisher: 'Μεταίχμιο',
    origin: 'https://www.metaixmio.gr',
    idBase: 9_800_000,
    kind: 'html',
    comicSlugs: [],
    excludeSlugs: [],
    requiredSlugs: [],
    fetchSlugs: [],
    catalogUrls: [
      'https://www.metaixmio.gr/el/categories/graphic-novels',
      'https://www.metaixmio.gr/el/categories/paidika-graphic-novels',
    ],
  },
  {
    publisher: 'Πατάκη',
    origin: 'https://www.patakis.gr',
    idBase: 9_700_000,
    kind: 'html',
    comicSlugs: [],
    excludeSlugs: [],
    requiredSlugs: [],
    fetchSlugs: [],
    catalogUrls: [
      'https://www.patakis.gr/books/9786180700886-o-thisavros-tis-vagias-graphic-novel/',
      'https://vivliopoleiopataki.gr/vivlia/graphic-novels-komiks/graphic-novels-komiks-enilikon',
    ],
    skipTitle: /e-book|ebook|pdf/i,
  },
  {
    publisher: 'Διόπτρα',
    origin: 'https://www.dioptra.gr',
    idBase: 9_080_000,
    kind: 'html',
    comicSlugs: [],
    excludeSlugs: [],
    requiredSlugs: [],
    fetchSlugs: [],
    catalogUrls: [
      'https://www.dioptra.gr/suggrafeas/soloup',
      'https://www.dioptra.gr/vivlia/nikos-kazantzakis/zorbas-soloup',
      'https://www.dioptra.gr/vivlia/nikos-kazantzakis/kapetan-mixalis-graphic-novel',
    ],
    skipTitle: /οδηγό το αϊβαλί|εκπαίδευσ/i,
  },
];

const MARKET_SINCE = '2024-01-01';
const LIVE_CACHE_TTL_MS = 30 * 60 * 1000;
const SKIP_TITLE = /\b(hard\s*porn|e-book|ebook)\b/i;

let liveCache: { at: number; items: GreekMarketIssue[] } | null = null;

function toMarketIssue(seed: GreekReleaseSeed): GreekMarketIssue {
  return {
    id: seed.id,
    series: {
      id: seed.id,
      name: seed.series,
      volume: 1,
      publisher: { id: 0, name: seed.publisher },
    },
    number: seed.number,
    cover_date: seed.storeDate,
    store_date: seed.storeDate,
    image: seed.image,
    publisher: { id: 0, name: seed.publisher },
    price: seed.price,
    currency: 'EUR',
    price_currency: 'EUR',
    sourceUrl: seed.sourceUrl,
  };
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8230;|&hellip;/g, '…')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function greekVolumeNumber(raw: string): string {
  const t = raw.replace(/[΄'’]/g, '').toUpperCase();
  const map: Record<string, string> = {
    Α: '1',
    Β: '2',
    Γ: '3',
    Δ: '4',
    Ε: '5',
    ΣΤ: '6',
    Ζ: '7',
    Η: '8',
    Θ: '9',
    Ι: '10',
  };
  return map[t] ?? raw.replace(/[΄'’]/g, '');
}

function parseTitle(name: string): { series: string; number: string } {
  const decoded = decodeHtml(name).replace(/\s+/g, ' ').trim();
  const vol = decoded.match(/,?\s*(?:Vol\.?|Volume|Τόμος|#)\s*([0-9IVXΑ-ΩA-Z΄']+)\s*$/iu);
  if (vol && vol.index != null) {
    return {
      series: decoded.slice(0, vol.index).replace(/[–—-]\s*$/, '').trim(),
      number: greekVolumeNumber(vol[1]),
    };
  }
  const trailing = decoded.match(/\s+(\d+)\s*$/);
  if (trailing && trailing.index != null) {
    return {
      series: decoded.slice(0, trailing.index).replace(/[–—-]\s*$/, '').trim(),
      number: trailing[1],
    };
  }
  return { series: decoded, number: '1' };
}

function formatPrice(product: ShopProduct): string | null {
  const raw = product.prices?.price || product.prices?.regular_price;
  if (!raw) return null;
  const minor = product.prices?.currency_minor_unit ?? 2;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return (n / 10 ** minor).toFixed(2);
}

function coverFromProduct(product: ShopProduct): string | null {
  const src = product.images?.[0]?.src || product.images?.[0]?.thumbnail || null;
  return src ? src.replace(/-\d+x\d+(?=\.\w+$)/, '') : null;
}

function dateFromImageUrl(src: string | null): string | null {
  if (!src) return null;
  const m = src.match(/\/uploads\/(\d{4})\/(\d{2})\//);
  if (!m) return null;
  return `${m[1]}-${m[2]}-01`;
}

function slugsOf(product: ShopProduct): string[] {
  return (product.categories ?? []).map((c) => (c.slug ?? '').toLowerCase()).filter(Boolean);
}

function isComicProduct(product: ShopProduct, shop: ShopConfig): boolean {
  const name = decodeHtml(product.name);
  if (SKIP_TITLE.test(name) || shop.skipTitle?.test(name)) return false;
  const slugs = slugsOf(product);
  if (shop.excludeSlugs.some((s) => slugs.includes(s))) return false;
  if (shop.requiredSlugs.length > 0) {
    return shop.requiredSlugs.some((s) => slugs.includes(s));
  }
  if (shop.comicSlugs.length > 0) {
    return shop.comicSlugs.some((s) => slugs.includes(s));
  }
  return Boolean(coverFromProduct(product));
}

function productToIssue(product: ShopProduct, shop: ShopConfig): GreekMarketIssue | null {
  if (!isComicProduct(product, shop)) return null;
  const image = coverFromProduct(product);
  if (!image) return null;
  const { series, number } = parseTitle(product.name);
  if (!series) return null;
  const id = shop.idBase + (product.id % 100_000);
  const storeDate = dateFromImageUrl(image);
  return {
    id,
    series: {
      id,
      name: series,
      volume: 1,
      publisher: { id: 0, name: shop.publisher },
    },
    number,
    cover_date: storeDate,
    store_date: storeDate,
    image,
    publisher: { id: 0, name: shop.publisher },
    price: formatPrice(product),
    currency: 'EUR',
    price_currency: 'EUR',
    sourceUrl: product.permalink,
  };
}

async function fetchShopProducts(
  origin: string,
  category?: string | number,
): Promise<ShopProduct[]> {
  const params = new URLSearchParams({
    orderby: 'date',
    per_page: '50',
  });
  if (category != null && category !== '') params.set('category', String(category));
  const data = await greekShopFetch(`${origin}/wp-json/wc/store/v1/products?${params}`);
  return Array.isArray(data) ? (data as ShopProduct[]) : [];
}

async function loadShop(shop: ShopConfig): Promise<GreekMarketIssue[]> {
  if (shop.kind === 'html') return loadHtmlShop(shop);
  const queues: Array<string | undefined> =
    shop.fetchSlugs.length > 0 ? shop.fetchSlugs : [undefined];
  const pages = await Promise.all(
    queues.map(async (category) => {
      try {
        return await fetchShopProducts(shop.origin, category);
      } catch {
        return [] as ShopProduct[];
      }
    }),
  );
  const merged = new Map<number, GreekMarketIssue>();
  for (const products of pages) {
    for (const product of products) {
      const issue = productToIssue(product, shop);
      if (issue) merged.set(issue.id, issue);
    }
  }
  return [...merged.values()];
}

type HtmlProduct = { title: string; href: string; image: string; price: string | null };

function idFromKey(idBase: number, key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i += 1) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return idBase + (h >>> 0) % 100_000;
}

function absoluteUrl(origin: string, href: string): string {
  try {
    return new URL(href, origin).href.split('#')[0];
  } catch {
    return href;
  }
}

function fullCoverUrl(src: string): string {
  return src
    .replace(/&amp;/g, '&')
    .replace(/-\d+x\d+[wh]?(?=\.\w+$)/i, '')
    .replace('/image/cache/catalog/', '/image/catalog/');
}

function parseEuroPrice(raw: string | undefined): string | null {
  if (!raw) return null;
  const m = raw.replace(/\s/g, '').match(/(\d+[.,]\d{2})/);
  return m ? m[1].replace(',', '.') : null;
}

function attr(tag: string, name: string): string | null {
  const m = tag.match(new RegExp(`${name}="([^"]+)"`, 'i')) || tag.match(new RegExp(`${name}='([^']+)'`, 'i'));
  return m ? decodeHtml(m[1]) : null;
}

function parseOpenCartProducts(html: string, origin: string): HtmlProduct[] {
  const out: HtmlProduct[] = [];
  const parts = html.split(/<div class="product-thumb/);
  for (const part of parts.slice(1)) {
    const hrefM = part.match(/href="(https?:\/\/[^"?#]+|\/[^"?#]+)"/i);
    const imgM = part.match(/src="(https?:\/\/[^"]+\/image\/(?:cache\/)?catalog\/[^"]+)"/i);
    const nameM =
      part.match(/class="name"[^>]*>\s*<a[^>]*>([^<]+)/i) || part.match(/<h4>\s*<a[^>]*>([^<]+)/i);
    if (!hrefM || !imgM || !nameM) continue;
    const image = fullCoverUrl(imgM[1]);
    if (/covers_other_publishers|logo_|1280x380|-108x150/i.test(image)) continue;
    const href = absoluteUrl(origin, hrefM[1]);
    if (/\/blog\//i.test(href)) continue;
    const path = href.replace(/^https?:\/\/[^/]+/i, '').split('?')[0];
    if (/^\/(comics|efhvika|home)?\/?$/i.test(path)) continue;
    const priceM =
      part.match(/class="price-new"[^>]*>([^<]+)/i) || part.match(/Τιμή eshop:\s*([^<]+)/i);
    out.push({
      title: decodeHtml(nameM[1]),
      href,
      image,
      price: parseEuroPrice(priceM?.[1]),
    });
  }
  return out;
}

function parseWooLoopProducts(html: string, origin: string): HtmlProduct[] {
  const out: HtmlProduct[] = [];
  const items = html.match(/<li[^>]*class="[^"]*product[^"]*"[\s\S]*?<\/li>/gi) ?? [];
  for (const item of items) {
    const hrefM = item.match(/href="(https?:\/\/[^"]+\/product\/[^"]+\/?)"/i);
    const imgM = item.match(/<img[^>]+src="([^"]+)"/i);
    const titleM =
      item.match(/product-list-title[^>]*>\s*<a[^>]*>([^<]+)/i) ||
      item.match(/woocommerce-loop-product__title[^>]*>([^<]+)/i);
    if (!hrefM || !imgM || !titleM) continue;
    const image = fullCoverUrl(imgM[1]);
    if (/logo|banner|favicon|facebook-image/i.test(image)) continue;
    const priceM = item.match(/woocommerce-Price-amount[^>]*>[\s\S]*?(\d+[.,]\d{2})/i);
    out.push({
      title: decodeHtml(titleM[1]),
      href: absoluteUrl(origin, hrefM[1]),
      image,
      price: parseEuroPrice(priceM?.[1]),
    });
  }
  return out;
}

function parseOgProduct(html: string, pageUrl: string): HtmlProduct | null {
  const title =
    html.match(/property="og:title"\s+content="([^"]+)"/i)?.[1] ||
    html.match(/content="([^"]+)"\s+property="og:title"/i)?.[1] ||
    html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1];
  const image =
    html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1] ||
    html.match(/content="([^"]+)"\s+property="og:image"/i)?.[1];
  if (!title || !image) return null;
  if (/logo|banner/i.test(image)) return null;
  const priceM = html.match(/itemprop="price"\s+content="([^"]+)"/i) || html.match(/(\d+[.,]\d{2})\s*€/);
  return {
    title: decodeHtml(title)
      .replace(/^Βιβλίο,\s*/i, '')
      .replace(/\s*[|].{0,40}$/, '')
      .trim(),
    href: pageUrl,
    image: fullCoverUrl(decodeHtml(image)),
    price: parseEuroPrice(priceM?.[1]),
  };
}

function parseMagentoItems(html: string, origin: string, requireText?: string): HtmlProduct[] {
  const out: HtmlProduct[] = [];
  const items =
    html.match(/<li[^>]*class="[^"]*product-item[^"]*"[\s\S]*?<\/li>/gi) ??
    html.match(/<div[^>]*class="[^"]*product-item-info[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi) ??
    [];
  for (const item of items) {
    if (requireText && !item.includes(requireText)) continue;
    const hrefM = item.match(/href="(https?:\/\/[^"]+)"/i);
    const imgM = item.match(/<img[^>]+src="([^"]+)"/i);
    const titleM =
      item.match(/product-item-link[^>]*>([^<]+)/i) ||
      item.match(/product-item-name[^>]*>[\s\S]*?>([^<]+)/i) ||
      (imgM ? [null, attr(imgM[0], 'alt') ?? ''] : null);
    if (!hrefM || !imgM || !titleM?.[1]) continue;
    const href = absoluteUrl(origin, hrefM[1]);
    if (/\/vivlia\/|\/categories\//i.test(href) && !/[\w-]{8,}/.test(href.split('/').pop() ?? '')) continue;
    const image = fullCoverUrl(absoluteUrl(origin, imgM[1]));
    if (/logo|placeholder|sprite/i.test(image)) continue;
    const priceM = item.match(/(\d+[.,]\d{2})\s*€/);
    out.push({
      title: decodeHtml(String(titleM[1])).replace(/\s+/g, ' ').trim(),
      href,
      image,
      price: parseEuroPrice(priceM?.[1]),
    });
  }
  return out;
}

function parseGenericCards(html: string, origin: string, shop: ShopConfig): HtmlProduct[] {
  const out: HtmlProduct[] = [];
  const hosts = new Set<string>([origin.replace(/^https?:\/\//i, '')]);
  for (const url of shop.catalogUrls ?? []) {
    try {
      hosts.add(new URL(url).hostname);
    } catch {
      /* ignore */
    }
  }
  const hostAlt = [...hosts].map((h) => h.replace(/\./g, '\\.')).join('|');
  const linkRe = new RegExp(
    `href="((?:https?:\\/\\/(?:${hostAlt}))?\\/(?:el\\/|en\\/)?(?:products?|vivlia|books)\\/[^"]+)"`,
    'gi',
  );
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html))) {
    const href = absoluteUrl(origin, m[1]).replace(/[?].*$/, '');
    if (seen.has(href) || /categories|seires|suggrafeas|search|e-book/i.test(href)) continue;
    seen.add(href);
    const window = html.slice(Math.max(0, m.index - 1400), Math.min(html.length, m.index + 1800));
    if (shop.publisher === 'Πατάκη' && /vivliopoleiopataki/.test(href) && !/Εκδόσεις Πατάκη/.test(window)) {
      continue;
    }
    const imgM = window.match(/<img[^>]+src="([^"]+\.(?:jpg|jpeg|png|webp)(?:\?[^"]*)?)"/i);
    const heading = window.match(/<(?:h[1-4])[^>]*>([^<]{3,120})<\/(?:h[1-4])>/i);
    const alt = imgM ? attr(imgM[0], 'alt') : null;
    const title = decodeHtml((heading?.[1] || alt || '').replace(/\s+/g, ' ')).trim();
    if (!imgM || !title) continue;
    const image = fullCoverUrl(absoluteUrl(origin, imgM[1]));
    if (/logo|banner|placeholder|sprite/i.test(image)) continue;
    const priceM = window.match(/(\d+[.,]\d{2})\s*€/);
    out.push({ title, href, image, price: parseEuroPrice(priceM?.[1]) });
  }
  return out;
}

function htmlProductsFor(html: string, pageUrl: string, shop: ShopConfig): HtmlProduct[] {
  const origin = shop.origin;
  const fromOg = parseOgProduct(html, pageUrl);
  const cards = [
    ...parseOpenCartProducts(html, origin),
    ...parseWooLoopProducts(html, origin),
    ...parseMagentoItems(html, origin, shop.publisher === 'Πατάκη' ? 'Εκδόσεις Πατάκη' : undefined),
    ...parseGenericCards(html, origin, shop),
  ];
  if (fromOg && cards.length === 0) cards.push(fromOg);
  const merged = new Map<string, HtmlProduct>();
  for (const product of cards) {
    const title = product.title.replace(/\s+/g, ' ').trim();
    if (!title || SKIP_TITLE.test(title) || shop.skipTitle?.test(title)) continue;
    if (shop.publisher === 'Πατάκη' && /vivliopoleiopataki/.test(product.href)) {
      if (!/graphic novel|κόμικ|comic|γκράφικ/i.test(title)) continue;
    }
    const key = product.href.replace(/\/$/, '').toLowerCase();
    if (!merged.has(key)) merged.set(key, { ...product, title });
  }
  return [...merged.values()];
}

function htmlProductToIssue(product: HtmlProduct, shop: ShopConfig): GreekMarketIssue | null {
  const image = product.image;
  if (!image) return null;
  const { series, number } = parseTitle(product.title);
  if (!series) return null;
  const id = idFromKey(shop.idBase, product.href);
  const storeDate = dateFromImageUrl(image);
  return {
    id,
    series: {
      id,
      name: series,
      volume: 1,
      publisher: { id: 0, name: shop.publisher },
    },
    number,
    cover_date: storeDate,
    store_date: storeDate,
    image,
    publisher: { id: 0, name: shop.publisher },
    price: product.price,
    currency: 'EUR',
    price_currency: 'EUR',
    sourceUrl: product.href,
  };
}

async function loadHtmlShop(shop: ShopConfig): Promise<GreekMarketIssue[]> {
  const urls = shop.catalogUrls ?? [];
  const pages = await Promise.all(
    urls.map(async (url) => {
      try {
        const html = await greekShopFetchText(url);
        return htmlProductsFor(html, url, shop);
      } catch {
        return [] as HtmlProduct[];
      }
    }),
  );
  const merged = new Map<number, GreekMarketIssue>();
  for (const products of pages) {
    for (const product of products) {
      const issue = htmlProductToIssue(product, shop);
      if (issue) merged.set(issue.id, issue);
    }
  }
  return [...merged.values()];
}

function issueKey(issue: GreekMarketIssue): string {
  return `${issue.publisher?.name ?? ''}|${issue.series.name}|${issue.number}`.toLowerCase();
}

/**
 * Greek catalog for «Νέα κυκλοφορία → Ελληνικά».
 * Not week-bound like Metron: returns curated publisher catalog sorted newest-first.
 * Optional week filter keeps titles whose store_date falls in range; undated stay visible.
 */
export function fetchGreekReleases(opts?: {
  after?: string;
  before?: string;
  filterByWeek?: boolean;
  recentOnly?: boolean;
}): GreekMarketIssue[] {
  let items = GREEK_RELEASES.map(toMarketIssue);

  if (opts?.filterByWeek && opts.after && opts.before) {
    items = items.filter((item) => {
      if (!item.store_date) return true;
      return item.store_date >= opts.after! && item.store_date <= opts.before!;
    });
  }

  if (opts?.recentOnly) {
    items = items.filter((item) => !item.store_date || item.store_date >= MARKET_SINCE);
  }

  return items.sort((a, b) => (b.store_date ?? '').localeCompare(a.store_date ?? ''));
}

/** Live e-shop new releases, merged with the recent curated catalog. */
export async function loadGreekMarketReleases(): Promise<GreekMarketIssue[]> {
  if (liveCache && Date.now() - liveCache.at < LIVE_CACHE_TTL_MS) {
    return liveCache.items;
  }

  const fallback = fetchGreekReleases({ recentOnly: true });
  const liveGroups = await Promise.all(SHOPS.map((shop) => loadShop(shop)));
  const live = liveGroups.flat();

  const merged = new Map<string, GreekMarketIssue>();
  for (const issue of live) merged.set(issueKey(issue), issue);
  for (const issue of fallback) {
    const key = issueKey(issue);
    if (!merged.has(key)) merged.set(key, issue);
  }

  const items = [...merged.values()].sort((a, b) =>
    (b.store_date ?? '').localeCompare(a.store_date ?? ''),
  );
  if (live.length > 0) liveCache = { at: Date.now(), items };
  return items;
}

export function getGreekMarketIssueById(id: number): GreekMarketIssue | null {
  if (liveCache) {
    const hit = liveCache.items.find((item) => item.id === id);
    if (hit) return hit;
  }
  const seed = GREEK_RELEASES.find((item) => item.id === id);
  return seed ? toMarketIssue(seed) : null;
}

export const GREEK_PUBLISHERS = [
  { name: 'Anubis', url: 'https://anubis.gr/', focus: 'Graphic novels, manga, Marvel/DC μεταφράσεις' },
  { name: 'Jemma Press', url: 'https://jemmacomics.com/', focus: 'Ελληνική σκηνή + μεταφρασμένα κόμικς' },
  { name: 'Μαμούθ Comix', url: 'https://mamouthcomix.gr/', focus: 'Ευρωπαϊκά (Αστερίξ, Λούκυ Λουκ κ.ά.)' },
  { name: 'Μικρός Ήρως', url: 'https://www.mikrosiros.gr/', focus: 'Κλασικά ελληνικά κόμικς, manga, γαλλοβελγικά' },
  { name: 'Οξύ / Brainfood', url: 'https://brainfood.gr/ekdoseis/comic/', focus: 'Οξύ Comics / Brainfood graphic novels' },
  { name: 'Κάκτος', url: 'https://www.kaktos.gr/product-category/sygxrones-ekdoseis/logotexnia/graphic-novel/', focus: 'Graphic novel διασκευές' },
  { name: 'Πατάκη', url: 'https://www.patakis.gr/', focus: 'Graphic novels ελληνικής λογοτεχνίας' },
  { name: 'Μεταίχμιο', url: 'https://www.metaixmio.gr/el/categories/graphic-novels', focus: 'Graphic novels ενηλίκων και παιδιών' },
  { name: 'Διόπτρα', url: 'https://www.dioptra.gr/', focus: 'Graphic novels (Soloup, Καζαντζάκης)' },
  { name: 'Polaris', url: 'https://www.polarisekdoseis.gr/product-category/graphic-novels/', focus: 'Ελληνικά graphic novels' },
] as const;

function normalizeTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[–—−]/g, '-')
    .replace(/[^a-z0-9α-ωίϊΐύϋΰάέήόώ\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleOverlap(a: string, b: string): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const wa = new Set(na.split(' ').filter((w) => w.length > 2));
  const wb = new Set(nb.split(' ').filter((w) => w.length > 2));
  if (wa.size === 0 || wb.size === 0) return 0;
  let hit = 0;
  for (const w of wa) if (wb.has(w)) hit += 1;
  return hit / Math.max(wa.size, wb.size);
}

/** English / alternate titles for Metron when Greek catalog has no cover. */
const FOREIGN_SERIES_ALIASES: Record<string, string[]> = {
  'λουκυ λουκ': ['Lucky Luke'],
  'αστεριξ': ['Asterix'],
  'αστεριξ στον δρομο για την κινα': ['Asterix'],
  watchmen: ['Watchmen'],
  'solo leveling': ['Solo Leveling'],
};

/**
 * Official shop cover from curated Greek catalog (Anubis / Jemma / Μαμούθ).
 */
export function resolveGreekCoverUrl(
  series: string,
  issueNumber?: string,
  publisher?: string,
): string | undefined {
  const seriesClean = series.replace(/\s*\([^)]*\)\s*$/u, '').trim();
  const issue = (issueNumber ?? '').trim();
  const pub = (publisher ?? '').trim().toLowerCase();

  const scored = GREEK_RELEASES.map((seed) => {
    let score = titleOverlap(seriesClean, seed.series);
    if (score < 0.45) return null;
    if (pub) {
      const seedPub = seed.publisher.toLowerCase();
      if (pub.includes('μαμούθ') || pub.includes('mamouth') || pub.includes('κόμιξ')) {
        if (seedPub.includes('μαμούθ') || seedPub.includes('mamouth')) score += 0.1;
      } else if (
        seedPub.includes(pub.slice(0, Math.min(5, pub.length))) ||
        pub.includes(seedPub.slice(0, 5))
      ) {
        score += 0.1;
      }
    }
    return { seed, score };
  }).filter((x): x is { seed: GreekReleaseSeed; score: number } => Boolean(x));

  if (issue) {
    const exact = scored
      .filter((x) => x.seed.number === issue)
      .sort((a, b) => b.score - a.score)[0];
    if (exact && exact.score >= 0.45) return exact.seed.image;
    return undefined;
  }

  const best = scored.sort((a, b) => b.score - a.score)[0];
  return best && best.score >= 0.7 ? best.seed.image : undefined;
}

/** Publication year (YYYY) from curated Greek catalog when series+issue match. */
export function resolveGreekYear(
  series: string,
  issueNumber?: string,
  publisher?: string,
): string | undefined {
  const seriesClean = series.replace(/\s*\([^)]*\)\s*$/u, '').trim();
  const issue = (issueNumber ?? '').trim();
  if (!issue) return undefined;

  let best: { score: number; year: string } | null = null;
  for (const seed of GREEK_RELEASES) {
    if (seed.number !== issue) continue;
    let score = titleOverlap(seriesClean, seed.series);
    if (score < 0.45) continue;
    const year = seed.storeDate?.slice(0, 4);
    if (!year || !/^\d{4}$/.test(year)) continue;
    if (publisher) {
      const pub = publisher.toLowerCase();
      const seedPub = seed.publisher.toLowerCase();
      if (pub.includes('μαμούθ') || pub.includes('mamouth')) {
        if (seedPub.includes('μαμούθ') || seedPub.includes('mamouth')) score += 0.1;
      }
    }
    if (!best || score > best.score) best = { score, year };
  }
  return best && best.score >= 0.45 ? best.year : undefined;
}

/** Titles to try on Metron for Greek-published European albums. */
export function metronAliasTitles(series: string): string[] {
  const clean = series.replace(/\s*\([^)]*\)\s*$/u, '').trim();
  const out = [clean];
  for (const [k, vals] of Object.entries(FOREIGN_SERIES_ALIASES)) {
    if (titleOverlap(clean, k) >= 0.8) out.push(...vals);
  }
  return [...new Set(out.filter(Boolean))];
}

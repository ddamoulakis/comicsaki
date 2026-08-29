/**
 * Harvest official cover URLs for the historical Greek catalog.
 * Sources: mikrosiros.gr (OpenCart) + kathimerini.gr/k/disney (publisher pages).
 * Writes JSON + SQL upsert. Official shop covers only — greekcomics.gr is ingested separately
 * via `python scripts/ingest-greekcomics-catalog.py`.
 * Use --from-json to regenerate SQL from data/greekCatalogHarvest.json without refetching.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const DELAY_MS = 160;

const MH_CATEGORIES = [
  { seriesKey: 'blek', url: 'https://www.mikrosiros.gr/mplek' },
  { seriesKey: 'neos-blek', url: 'https://www.mikrosiros.gr/neos-blek' },
  { seriesKey: 'syllektiko-blek', url: 'https://www.mikrosiros.gr/sullektiko-mplek' },
  { seriesKey: 'popeye', url: 'https://www.mikrosiros.gr/popeye' },
  { seriesKey: 'popeye', url: 'https://www.mikrosiros.gr/popeye-magazine' },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&nbsp;/g, ' ')
    .trim();
}

function fullCoverUrl(src) {
  return src
    .replace(/&amp;/g, '&')
    .replace(/-\d+x\d+[wh]?(?=\.\w+$)/i, '')
    .replace('/image/cache/catalog/', '/image/catalog/');
}

function sqlStr(value) {
  if (value == null || value === '') return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

const GREEK_LATIN = {
  α: 'a',
  β: 'v',
  γ: 'g',
  δ: 'd',
  ε: 'e',
  ζ: 'z',
  η: 'i',
  θ: 'th',
  ι: 'i',
  κ: 'k',
  λ: 'l',
  μ: 'm',
  ν: 'n',
  ξ: 'x',
  ο: 'o',
  π: 'p',
  ρ: 'r',
  σ: 's',
  ς: 's',
  τ: 't',
  υ: 'y',
  φ: 'f',
  χ: 'ch',
  ψ: 'ps',
  ω: 'o',
};

function slugIssue(seriesKey, number) {
  const n = String(number)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[α-ω]/g, (ch) => GREEK_LATIN[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `${seriesKey}-${n}`;
}

function skipTitle(title) {
  return /προσφορά|prosfora|#\s*\d+\s*[-–]\s*\d+|τόμος\s*$|set\b/i.test(title);
}

function classifyMh(title, fallback) {
  const t = title.toLowerCase();
  if (/νέος\s*μπλεκ|neos\s*mplek/.test(t)) return 'neos-blek';
  if (/συλλεκτικ[οό]\s*μπλεκ|syllektiko|sullektiko/.test(t)) return 'syllektiko-blek';
  if (/popeye|ποπά[υϋ]|ποπαυ/.test(t)) return 'popeye';
  if (/μπλεκ|blek/.test(t)) return 'blek';
  return fallback;
}

function parseIssueNumber(title, seriesKey) {
  const hash = title.match(/#\s*(\d{1,4})\b/);
  if (hash) return String(Number(hash[1]));
  if (seriesKey === 'popeye' && /θίασος|thiasos/i.test(title)) return 'Θίασος';
  return '';
}

function parseYear(text) {
  const m = text.match(/\b(20[1-2]\d|199\d)\b/);
  return m ? Number(m[1]) : null;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xml,application/json;q=0.9,*/*;q=0.8',
      'User-Agent': UA,
      'Accept-Language': 'el,en;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  return { status: res.status, text, url: res.url };
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i], i);
    }
  }
  const n = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

function parseOpenCartProducts(html, origin) {
  const out = [];
  const seen = new Set();
  const parts = html.split(/<div class="product-thumb/);
  for (const part of parts.slice(1)) {
    const nameM = part.match(/class="name"[^>]*>\s*<a href="([^"]+)"[^>]*>([^<]+)/i);
    const imgM = part.match(/src="(https?:\/\/[^"]+\/image\/(?:cache\/)?catalog\/[^"]+)"/i);
    if (!nameM || !imgM) continue;
    const image = fullCoverUrl(imgM[1]);
    if (/covers_other_publishers|logo_|placeholder|1280x380/i.test(image)) continue;
    const href = new URL(nameM[1], origin).href.split('?')[0].split('#')[0];
    if (/\/blog\//i.test(href) || seen.has(href)) continue;
    seen.add(href);
    out.push({ title: decodeHtml(nameM[2]), href, image });
  }
  if (out.length) return out;

  const loose = /<div class="name"><a href="(https:\/\/www\.mikrosiros\.gr\/[^"]+)">([^<]+)<\/a><\/div>/gi;
  let m;
  while ((m = loose.exec(html))) {
    const href = m[1].split('?')[0];
    if (seen.has(href) || /\/blog\//i.test(href)) continue;
    const before = html.slice(Math.max(0, m.index - 1800), m.index);
    const imgM = before.match(/src="(https?:\/\/[^"]+\/image\/(?:cache\/)?catalog\/[^"]+)"/i);
    if (!imgM) continue;
    const image = fullCoverUrl(imgM[1]);
    if (/covers_other_publishers|logo_|placeholder/i.test(image)) continue;
    seen.add(href);
    out.push({ title: decodeHtml(m[2]), href, image });
  }
  return out;
}

function parseOg(html) {
  const title =
    html.match(/property="og:title"\s+content="([^"]+)"/i)?.[1] ||
    html.match(/content="([^"]+)"\s+property="og:title"/i)?.[1] ||
    '';
  const image =
    html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1] ||
    html.match(/content="([^"]+)"\s+property="og:image"/i)?.[1] ||
    '';
  return { title: decodeHtml(title), image: image ? fullCoverUrl(decodeHtml(image)) : '' };
}

async function harvestMikrosiros() {
  const rows = [];
  const seenHref = new Set();

  for (const cat of MH_CATEGORIES) {
    for (let page = 1; page <= 20; page += 1) {
      const url = `${cat.url}${cat.url.includes('?') ? '&' : '?'}limit=100&page=${page}`;
      const { status, text } = await fetchText(url);
      await sleep(DELAY_MS);
      if (status >= 400) {
        if (page === 1) console.log(`skip ${cat.url} (${status})`);
        break;
      }
      const products = parseOpenCartProducts(text, 'https://www.mikrosiros.gr');
      if (!products.length) break;
      console.log(`MH ${cat.seriesKey} p${page}: ${products.length}`);
      for (const p of products) {
        if (seenHref.has(p.href) || skipTitle(p.title)) continue;
        seenHref.add(p.href);
        const seriesKey = classifyMh(p.title, cat.seriesKey);
        const number = parseIssueNumber(p.title, seriesKey);
        if (!number) continue;
        const yearM = text.match(new RegExp(`${p.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]{0,400}?((?:19|20)\\d{2})`));
        rows.push({
          seriesKey,
          catalogKey: slugIssue(seriesKey, number),
          issueNumber: number,
          title: p.title,
          year: yearM ? Number(yearM[1]) : null,
          coverUrl: p.image,
          sourceUrl: p.href,
        });
      }
      if (products.length < 50) break;
    }
  }
  return rows;
}

function classifyKathimerini(title) {
  if (/μίκυ\s*μάους|μικυ\s*μαουσ|miky\s*maoys/i.test(title)) return 'mickey';
  if (/κόμιξ|κομιξ|komix/i.test(title)) return 'komix';
  return '';
}

function pickKathimeriniImage(block) {
  const urls = [
    ...(block.match(/data-srcset="([^"]+)"/gi) ?? []).map((s) => s.replace(/^data-srcset="/i, '').replace(/"$/, '')),
    ...(block.match(/srcset="([^"]+)"/gi) ?? []).map((s) => s.replace(/^srcset="/i, '').replace(/"$/, '')),
    ...(block.match(/data-src="(https:\/\/www\.kathimerini\.gr\/wp-content\/uploads\/[^"]+)"/gi) ?? []).map((s) =>
      s.replace(/^data-src="/i, '').replace(/"$/, ''),
    ),
    ...(block.match(/src="(https:\/\/www\.kathimerini\.gr\/wp-content\/uploads\/[^"]+)"/gi) ?? []).map((s) =>
      s.replace(/^src="/i, '').replace(/"$/, ''),
    ),
  ]
    .flatMap((v) => v.split(',').map((p) => p.trim().split(/\s+/)[0]))
    .filter((u) => /^https:\/\//.test(u) && !/data:image|svg/i.test(u));
  if (!urls.length) return '';
  urls.sort((a, b) => b.length - a.length);
  return fullCoverUrl(urls[0].split('?')[0]);
}

function parseKathimeriniListing(html) {
  const out = [];
  const seen = new Set();
  const cards = html.split(/disney-card/);
  for (const block of cards.slice(1)) {
    const titleM = block.match(/nx-title">([^<]+)/i) || block.match(/<p class="title[^"]*">([^<]+)/i);
    const hrefM = block.match(/href="(https:\/\/www\.kathimerini\.gr\/k\/disney\/\d+\/[^"]+)"/i);
    if (!titleM || !hrefM) continue;
    const title = decodeHtml(titleM[1]);
    const seriesKey = classifyKathimerini(title);
    const num = title.match(/#\s*(\d{1,4})/);
    if (!seriesKey || !num) continue;
    const href = hrefM[1];
    if (seen.has(href)) continue;
    seen.add(href);
    const image = pickKathimeriniImage(block);
    const yearM = image.match(/\/wp-content\/uploads\/(\d{4})\//);
    out.push({
      href,
      seriesKey,
      number: String(Number(num[1])),
      title,
      image,
      year: yearM ? Number(yearM[1]) : null,
    });
  }
  return out;
}

async function harvestKathimerini() {
  const rows = [];
  const seen = new Set();

  for (let page = 1; page <= 120; page += 1) {
    const url =
      page === 1
        ? 'https://www.kathimerini.gr/k/disney/'
        : `https://www.kathimerini.gr/k/disney/page/${page}/`;
    const { status, text } = await fetchText(url);
    await sleep(DELAY_MS);
    if (status >= 400) break;
    const items = parseKathimeriniListing(text);
    if (!items.length) break;
    let added = 0;
    for (const item of items) {
      const catalogKey = slugIssue(item.seriesKey, item.number);
      if (seen.has(catalogKey) || !item.image) continue;
      seen.add(catalogKey);
      added += 1;
      rows.push({
        seriesKey: item.seriesKey,
        catalogKey,
        issueNumber: item.number,
        title: item.title.replace(/\s*[|].*$/, '').trim(),
        year: item.year,
        coverUrl: item.image,
        sourceUrl: item.href,
      });
    }
    console.log(`HTML disney p${page}: ${items.length} cards, +${added}`);
    if (!/disney-card/.test(text)) break;
  }
  return rows;
}

function classifyKathimeriniUrl(url) {
  if (/\/super-miky-/i.test(url) || /\/ntonalnt-/i.test(url)) return null;
  const mickey = url.match(/\/miky-maoys-(\d{1,4})(?:-|$)/i);
  if (mickey) return { seriesKey: 'mickey', number: String(Number(mickey[1])) };
  const komix = url.match(/\/komix-(\d{1,4})(?:-|$)/i);
  if (komix) return { seriesKey: 'komix', number: String(Number(komix[1])) };
  return null;
}

async function harvestKathimeriniSitemap(existingKeys) {
  const rows = [];
  const seen = new Set(existingKeys);
  const index = await fetchText('https://www.kathimerini.gr/sitemap.xml');
  const maps = [...index.text.matchAll(/<loc>(https:\/\/www\.kathimerini\.gr\/sitemap-pt-post-(201[4-9]|202[0-6])-\d{2}\.xml)<\/loc>/g)].map(
    (m) => m[1],
  );
  console.log(`sitemap months: ${maps.length}`);
  const urls = new Set();
  await mapPool(maps, 6, async (mapUrl) => {
    try {
      const { text, status } = await fetchText(mapUrl);
      if (status >= 400) return;
      for (const m of text.matchAll(/<loc>(https:\/\/www\.kathimerini\.gr\/k\/disney\/\d+\/[^<]+)<\/loc>/g)) {
        urls.add(m[1]);
      }
    } catch {
      // skip month
    }
  });
  const wanted = [...urls].filter((u) => classifyKathimeriniUrl(u));
  console.log(`sitemap disney issue URLs: ${wanted.length}`);
  await mapPool(wanted, 5, async (href) => {
    const meta = classifyKathimeriniUrl(href);
    if (!meta) return;
    const catalogKey = slugIssue(meta.seriesKey, meta.number);
    if (seen.has(catalogKey)) return;
    try {
      await sleep(40);
      const article = await fetchText(href);
      const og = parseOg(article.text);
      if (!og.image || /logo|placeholder|svg$/i.test(og.image)) return;
      seen.add(catalogKey);
      const yearM = og.image.match(/\/uploads\/(\d{4})\//) || href.match(/\/(20\d{2})\//);
      rows.push({
        seriesKey: meta.seriesKey,
        catalogKey,
        issueNumber: meta.number,
        title: (og.title || '').replace(/\s*[|].*$/, '').trim() || `issue ${meta.number}`,
        year: yearM ? Number(yearM[1]) : null,
        coverUrl: og.image.split('?')[0],
        sourceUrl: href,
      });
    } catch {
      // skip article
    }
  });
  console.log(`sitemap new rows: ${rows.length}`);
  return rows;
}

function mergeRows(groups) {
  const minYear = {
    blek: 2018,
    'neos-blek': 2013,
    'syllektiko-blek': 1995,
    popeye: 2015,
    mickey: 2014,
    komix: 2014,
  };
  const maxYear = new Date().getFullYear() + 1;
  const byCatalog = new Map();
  const bySeriesIssue = new Map();
  for (const raw of groups.flat()) {
    const row = { ...raw, catalogKey: slugIssue(raw.seriesKey, raw.issueNumber) };
    const min = minYear[row.seriesKey] ?? 1990;
    if (row.year && (row.year < min || row.year > maxYear)) row.year = null;
    const seriesIssue = `${row.seriesKey}::${row.issueNumber}`;
    const prev = byCatalog.get(row.catalogKey) ?? bySeriesIssue.get(seriesIssue);
    if (!prev) {
      byCatalog.set(row.catalogKey, row);
      bySeriesIssue.set(seriesIssue, row);
      continue;
    }
    const betterCover = row.coverUrl && (!prev.coverUrl || row.coverUrl.length > prev.coverUrl.length);
    if (betterCover) prev.coverUrl = row.coverUrl;
    if (!prev.sourceUrl && row.sourceUrl) prev.sourceUrl = row.sourceUrl;
    if (!prev.year && row.year) prev.year = row.year;
    if (row.title && row.title.length > (prev.title?.length ?? 0)) prev.title = row.title;
    prev.catalogKey = row.catalogKey;
    byCatalog.set(prev.catalogKey, prev);
    bySeriesIssue.set(seriesIssue, prev);
  }
  return [...byCatalog.values()].sort((a, b) =>
    a.seriesKey === b.seriesKey
      ? String(a.issueNumber).localeCompare(String(b.issueNumber), 'el', { numeric: true })
      : a.seriesKey.localeCompare(b.seriesKey),
  );
}

function toSql(rows) {
  const values = rows
    .map(
      (r) =>
        `  (${sqlStr(r.seriesKey)}, ${sqlStr(r.catalogKey)}, ${sqlStr(r.issueNumber)}, ${sqlStr(r.title)}, ${r.year ?? 'null'}, ${sqlStr(r.coverUrl)}, ${sqlStr(r.sourceUrl)})`,
    )
    .join(',\n');
  return `-- Harvested official covers (Mikrosiros + Kathimerini Disney).
-- Re-run safe: upserts on greek_issues.catalog_key.

insert into public.greek_issues (series_id, catalog_key, issue_number, title, year, cover_url, source_url)
select s.id, v.catalog_key, v.issue_number, v.title, v.year, v.cover_url, v.source_url
from public.greek_series s
join (values
${values}
) as v(series_key, catalog_key, issue_number, title, year, cover_url, source_url)
  on s.catalog_key = v.series_key
on conflict (catalog_key) do update set
  issue_number = excluded.issue_number,
  title = excluded.title,
  year = coalesce(excluded.year, public.greek_issues.year),
  cover_url = excluded.cover_url,
  source_url = excluded.source_url;
`;
}

let rows;
if (process.argv.includes('--from-json')) {
  rows = mergeRows([JSON.parse(readFileSync(join(ROOT, 'data/greekCatalogHarvest.json'), 'utf8'))]);
} else {
  const mh = await harvestMikrosiros();
  console.log(`Mikrosiros rows: ${mh.length}`);
  const kathList = await harvestKathimerini();
  console.log(`Kathimerini listing rows: ${kathList.length}`);
  const kathExtra = await harvestKathimeriniSitemap(kathList.map((r) => r.catalogKey));
  const kath = [...kathList, ...kathExtra];
  console.log(`Kathimerini rows: ${kath.length}`);
  rows = mergeRows([mh, kath]);
}
console.log(`Merged unique: ${rows.length}`);
const counts = {};
for (const r of rows) counts[r.seriesKey] = (counts[r.seriesKey] ?? 0) + 1;
console.log(counts);

const outDir = join(ROOT, 'data');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'greekCatalogHarvest.json'), JSON.stringify(rows, null, 2));
writeFileSync(join(ROOT, 'supabase/migrations/20260827_greek_catalog_harvest.sql'), toSql(rows));
console.log('Wrote data/greekCatalogHarvest.json and supabase/migrations/20260827_greek_catalog_harvest.sql');

const byKey = new Map(rows.map((r) => [r.catalogKey, r]));
const seriesIssue = new Set();
for (const r of rows) {
  const k = `${r.seriesKey}::${r.issueNumber}`;
  if (seriesIssue.has(k)) {
    console.error(`VERIFY FAIL duplicate series+issue ${k}`);
    process.exitCode = 1;
  }
  seriesIssue.add(k);
}
const expected = ['blek-31', 'mickey-630', 'komix-146', 'popeye-thiasos'];
for (const key of expected) {
  const row = byKey.get(key);
  if (!row?.coverUrl) {
    console.error(`VERIFY FAIL ${key}: missing coverUrl`);
    process.exitCode = 1;
  } else {
    console.log(`VERIFY OK ${key} ${row.coverUrl}`);
  }
}
if (!byKey.get('komix-140')?.coverUrl) {
  console.log('NOTE komix-140 is not on Kathimerini listings/sitemap (nearby issues harvested).');
}

/**
 * Confirm bundled harvest JSON has official covers for later issues.
 * Matcher wiring is verified separately via TypeScript import of this JSON.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const harvest = JSON.parse(readFileSync(join(ROOT, 'data/greekCatalogHarvest.json'), 'utf8'));
const sql = readFileSync(join(ROOT, 'supabase/migrations/20260827_greek_catalog_harvest.sql'), 'utf8');
const byKey = new Map(harvest.map((r) => [r.catalogKey, r]));

const required = [
  ['blek-31', /mikrosiros\.gr/i],
  ['mickey-630', /kathimerini\.gr/i],
  ['komix-146', /kathimerini\.gr/i],
];

let failed = false;
for (const [key, host] of required) {
  const row = byKey.get(key);
  if (!row?.coverUrl || !host.test(row.coverUrl)) {
    console.error(`FAIL ${key}`, row);
    failed = true;
    continue;
  }
  if (!sql.includes(`'${key}'`)) {
    console.error(`FAIL SQL missing ${key}`);
    failed = true;
    continue;
  }
  console.log(`OK ${key} ${row.coverUrl}`);
}

if (harvest.some((r) => r.seriesKey === 'blek' && r.year && r.year < 2018)) {
  console.error('FAIL blek year sanitizer');
  failed = true;
}

if (failed) process.exit(1);
console.log(`Harvest rows: ${harvest.length}`);

const gcPath = join(ROOT, 'data/greekcomicsCatalog.json');
const gc = JSON.parse(readFileSync(gcPath, 'utf8'));
const panic = (gc.series ?? []).find((s) => s.id === '6116');
if (!panic || !/πανικ/i.test(panic.n) || !panic.i?.some((i) => String(i.n) === '1')) {
  console.error('FAIL greekcomics ΠΑΝΙΚ ΑΤΤΑΚ', panic);
  process.exit(1);
}
console.log(`Greekcomics series: ${gc.series.length}  issues: ${gc.series.reduce((n, s) => n + (s.i?.length ?? 0), 0)}`);

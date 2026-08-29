/**
 * Upload scraped greekcomics cover files to Supabase Storage (greek-covers bucket).
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env (never commit). Public URLs:
 *   {EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/public/greek-covers/{covId}_{file}
 *
 * Usage:
 *   node scripts/upload-greek-covers.mjs
 *   node scripts/upload-greek-covers.mjs --limit 500
 *   node scripts/upload-greek-covers.mjs --dry-run
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'greek-covers';
const CONCURRENCY = 8;
const FILE_RE = /^[A-Za-z0-9._-]+$/;

function loadDotEnv() {
  const path = join(ROOT, '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function coverDirs() {
  return [
    join(ROOT, 'data', 'greekcomics_scrape', 'covers'),
    join(homedir(), 'Desktop', 'Αρχειο Ελληνικών Κομικ', 'greekcomics_scrape', 'covers'),
  ];
}

function listCoverFiles() {
  const seen = new Set();
  const files = [];
  for (const dir of coverDirs()) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!FILE_RE.test(name) || seen.has(name)) continue;
      const full = join(dir, name);
      if (!statSync(full).isFile()) continue;
      seen.add(name);
      files.push(full);
    }
  }
  return files.sort((a, b) => basename(a).localeCompare(basename(b)));
}

function mimeFor(file) {
  const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'image/jpeg';
}

async function ensureBucket(supabase) {
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    throw new Error(`Create bucket: ${error.message}`);
  }
}

async function listExisting(supabase) {
  const existing = new Set();
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list('', {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      if (row.name) existing.add(row.name);
    }
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return existing;
}

async function uploadOne(supabase, filePath, dryRun) {
  const name = basename(filePath);
  if (dryRun) return { name, status: 'dry-run' };

  const body = readFileSync(filePath);
  const { error } = await supabase.storage.from(BUCKET).upload(name, body, {
    contentType: mimeFor(name),
    upsert: true,
  });
  if (error) throw new Error(`${name}: ${error.message}`);
  return { name, status: 'uploaded' };
}

async function runPool(items, worker) {
  let index = 0;
  const results = [];
  async function next() {
    while (index < items.length) {
      const i = index++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => next()));
  return results;
}

function parseArgs(argv) {
  const args = { dryRun: false, limit: 0, skipExisting: true };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--all') args.skipExisting = false;
    else if (arg === '--limit') args.limit = Number(argv[++i] ?? 0);
  }
  return args;
}

async function main() {
  loadDotEnv();
  const { dryRun, limit, skipExisting } = parseArgs(process.argv);
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/+$/u, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL in .env');
  if (!serviceKey && !dryRun) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in .env (required for upload)');
  }

  const files = listCoverFiles();
  if (!files.length) {
    throw new Error('No cover files found under data/greekcomics_scrape/covers');
  }

  console.log(`Found ${files.length} local cover files`);
  const supabase = serviceKey ? createClient(supabaseUrl, serviceKey) : null;

  if (supabase) await ensureBucket(supabase);

  let queue = files;
  if (skipExisting && supabase) {
    console.log('Listing remote bucket…');
    const existing = await listExisting(supabase);
    queue = files.filter((file) => !existing.has(basename(file)));
    console.log(`Skipping ${files.length - queue.length} already uploaded`);
  }

  if (limit > 0) queue = queue.slice(0, limit);
  if (!queue.length) {
    console.log('Nothing to upload.');
    return;
  }

  console.log(`${dryRun ? 'Dry run' : 'Uploading'} ${queue.length} files to ${BUCKET}…`);
  let uploaded = 0;
  let failed = 0;
  const started = Date.now();

  await runPool(queue, async (filePath, i) => {
    try {
      const result = await uploadOne(supabase, filePath, dryRun);
      uploaded++;
      if ((i + 1) % 250 === 0 || i + 1 === queue.length) {
        const elapsed = ((Date.now() - started) / 1000).toFixed(1);
        console.log(`  ${i + 1}/${queue.length} (${uploaded} ok, ${failed} failed, ${elapsed}s)`);
      }
      return result;
    } catch (err) {
      failed++;
      console.error(String(err));
      return { name: basename(filePath), status: 'failed' };
    }
  });

  const base = `${supabaseUrl}/storage/v1/object/public/${BUCKET}`;
  console.log(`Done. Public base: ${base}`);
  if (failed) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

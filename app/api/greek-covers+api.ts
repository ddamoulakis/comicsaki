import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, normalize, sep } from 'node:path';

const FILE_RE = /^[A-Za-z0-9._-]+$/;
const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

function coverDirs(): string[] {
  return [
    join(process.cwd(), 'data', 'greekcomics_scrape', 'covers'),
    join(homedir(), 'Desktop', 'Αρχειο Ελληνικών Κομικ', 'greekcomics_scrape', 'covers'),
  ];
}

function mimeFor(file: string): string {
  const ext = file.slice(file.lastIndexOf('.')).toLowerCase();
  return MIME[ext] ?? 'application/octet-stream';
}

function isInside(dir: string, filePath: string): boolean {
  const root = normalize(dir) + sep;
  return normalize(filePath).startsWith(root);
}

/** Serves scraped greekcomics covers from the local archive folder. */
export async function GET(request: Request) {
  const file = new URL(request.url).searchParams.get('file') ?? '';
  if (!FILE_RE.test(file)) {
    return new Response('Bad file', { status: 400 });
  }

  for (const dir of coverDirs()) {
    const full = join(dir, file);
    if (!isInside(dir, full)) continue;
    try {
      const body = await readFile(full);
      return new Response(new Uint8Array(body), {
        headers: {
          'Content-Type': mimeFor(file),
          'Cache-Control': 'public, max-age=86400',
        },
      });
    } catch {
      // try next folder
    }
  }

  return new Response('Cover not found', { status: 404 });
}

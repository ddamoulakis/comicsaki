/**
 * Lightweight cover-to-cover visual similarity (TinEye-style ranking without TinEye).
 * Compares a scan photo against catalog cover URLs using downsampled RGB grids.
 */

import { fetchCoverBlob } from '@/lib/fetchCoverImage';

const GRID = 24;
/** Max catalog covers to score — avoid hanging mobile on 25 parallel downloads. */
const MAX_CANDIDATES = 8;

async function blobToRgbGrid(blob: Blob): Promise<Float32Array | null> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    return null;
  }

  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = GRID;
    canvas.height = GRID;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      bitmap.close();
      return null;
    }
    ctx.drawImage(bitmap, 0, 0, GRID, GRID);
    bitmap.close();
    const { data } = ctx.getImageData(0, 0, GRID, GRID);
    const out = new Float32Array(GRID * GRID * 3);
    for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
      out[j] = data[i] / 255;
      out[j + 1] = data[i + 1] / 255;
      out[j + 2] = data[i + 2] / 255;
    }
    return out;
  } catch {
    return null;
  }
}

async function loadRgbGrid(uri: string): Promise<Float32Array | null> {
  if (/^(blob:|data:|file:|content:)/i.test(uri) || uri.startsWith('/')) {
    try {
      const response = await fetch(uri);
      if (!response.ok) return null;
      return blobToRgbGrid(await response.blob());
    } catch {
      return null;
    }
  }

  const blob = await fetchCoverBlob(uri, 3500);
  if (!blob) return null;
  return blobToRgbGrid(blob);
}

function gridSimilarity(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  const mse = sum / n;
  return Math.max(0, Math.min(1, 1 - mse * 8));
}

/**
 * Score how well each catalog cover matches the scan photo.
 * Items without coverUrl get score 0. Caps work to avoid scan hang.
 */
export async function rankCoversByVisualMatch<T extends { coverUrl?: string }>(
  scanUri: string,
  candidates: T[],
): Promise<Array<T & { visualScore: number }>> {
  const withZero = candidates.map((c) => ({ ...c, visualScore: 0 }));

  try {
    const scanGrid = await loadRgbGrid(scanUri);
    if (!scanGrid) return withZero;

    const withCover = candidates
      .map((c, index) => ({ c, index }))
      .filter((x) => !!x.c.coverUrl)
      .slice(0, MAX_CANDIDATES);

    const scored = await Promise.all(
      withCover.map(async ({ c, index }) => {
        const grid = await loadRgbGrid(c.coverUrl!);
        const visualScore = grid ? gridSimilarity(scanGrid, grid) : 0;
        return { index, visualScore };
      }),
    );

    const out = [...withZero];
    for (const s of scored) {
      out[s.index] = { ...out[s.index], visualScore: s.visualScore };
    }
    return out.sort((a, b) => b.visualScore - a.visualScore);
  } catch {
    return withZero;
  }
}

/**
 * League of Comic Geeks-style barcode lookup: UPC/ISBN → catalog, no AI.
 */

import { isMetronConfigured, isSupabaseConfigured } from '@/lib/env';
import { normalizeScannedBarcode } from '@/lib/barcodeNormalize';
import {
  searchMetronByIsbn,
  searchMetronByUpc,
  searchMetronByUpcPrefix,
  type MetronSearchResult,
} from '@/services/metron';
import { lookupCoverFromQuery } from '@/services/supabase/lookupCover';
import type { CoverLookupResult, CoverMatch } from '@/types/coverLookup';

function tagMatches(
  result: MetronSearchResult,
  sourceName: string,
  confidence: number,
): CoverMatch[] {
  return result.matches.map((m) => ({
    ...m,
    confidence,
    sourceName,
    editions: m.editions.map((ed) => ({
      ...ed,
      confidence,
      sourceName,
    })),
  }));
}

function toLookup(
  queryHint: string,
  result: MetronSearchResult,
  sourceName: string,
  confidence: number,
): CoverLookupResult | null {
  if (!result.matches.length) return null;
  return {
    photoUri: '',
    queryHint,
    matches: tagMatches(result, sourceName, confidence),
    usedDemo: false,
  };
}

async function lookupMetron(parsed: ReturnType<typeof normalizeScannedBarcode>) {
  if (parsed.isbn) {
    return toLookup(
      parsed.isbn,
      await searchMetronByIsbn(parsed.isbn),
      'Metron · ISBN',
      0.97,
    );
  }

  if (parsed.upcExact && parsed.upcExact.length >= 17) {
    const exact = toLookup(
      parsed.upcExact,
      await searchMetronByUpc(parsed.upcExact),
      'Metron · UPC',
      0.98,
    );
    if (exact) return exact;
    if (parsed.upc12) {
      return toLookup(
        parsed.upc12,
        await searchMetronByUpcPrefix(parsed.upc12),
        'Metron · UPC',
        0.94,
      );
    }
    return null;
  }

  if (parsed.upcExact && parsed.upcExact.length === 13) {
    const exact = toLookup(
      parsed.upcExact,
      await searchMetronByUpc(parsed.upcExact),
      'Metron · UPC',
      0.97,
    );
    if (exact) return exact;
  }

  if (parsed.upc12) {
    try {
      const prefix = toLookup(
        parsed.upc12,
        await searchMetronByUpcPrefix(parsed.upc12),
        'Metron · UPC',
        0.94,
      );
      if (prefix) return prefix;
    } catch {
      // Metron may not accept upc_starts_with on older API
    }
    return toLookup(
      parsed.upc12,
      await searchMetronByUpc(parsed.upc12),
      'Metron · UPC',
      0.93,
    );
  }

  if (parsed.upcExact) {
    return toLookup(
      parsed.upcExact,
      await searchMetronByUpc(parsed.upcExact),
      'Metron · UPC',
      0.9,
    );
  }

  return null;
}

export async function lookupComicByBarcode(raw: string): Promise<CoverLookupResult> {
  const parsed = normalizeScannedBarcode(raw);
  if (parsed.digits.length < 8) {
    throw new Error('Ο κωδικός είναι πολύ κοντός. Σκάναρε ολόκληρο το barcode.');
  }

  if (isMetronConfigured()) {
    const metron = await lookupMetron(parsed);
    if (metron) return metron;
  }

  if (isSupabaseConfigured()) {
    try {
      const local = await lookupCoverFromQuery(parsed.digits);
      if (local.matches.length) {
        return { ...local, queryHint: parsed.digits, photoUri: '' };
      }
    } catch {
      // lookup-cover may be missing — Metron is the source of truth
    }
  }

  throw new Error(
    `Δεν βρέθηκε τεύχος για ${parsed.digits}. Δοκίμασε Scan εξωφύλλου ή πληκτρολόγησε τον κωδικό ξανά.`,
  );
}

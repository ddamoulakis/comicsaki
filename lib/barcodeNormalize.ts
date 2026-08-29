/**
 * Normalize camera / typed comic barcodes.
 * US issues: 12-digit UPC-A, often plus a 5-digit add-on (issue + printing).
 * Mobile scanners usually return only the 12 digits (Metron `upc_starts_with`).
 */

export type NormalizedBarcode = {
  digits: string;
  isbn?: string;
  /** 12-digit UPC-A for Metron upc_starts_with */
  upc12?: string;
  /** Full UPC to try as exact Metron `upc` (12, 13, or 17 digits) */
  upcExact?: string;
};

export function compactBarcode(raw: string): string {
  const trimmed = raw.trim();
  const isbn10 = trimmed.replace(/[^0-9Xx]/g, '').toUpperCase();
  if (/^\d{9}[\dX]$/.test(isbn10)) return isbn10;
  return trimmed.replace(/\D/g, '');
}

export function normalizeScannedBarcode(raw: string): NormalizedBarcode {
  let digits = compactBarcode(raw);

  // EAN-13 wrapping of UPC-A (leading 0). ISBN-13 never starts with 0.
  if (digits.length === 13 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  // EAN-13 + 5-digit add-on with leading 0 → 17-digit comic UPC
  if (digits.length === 18 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length >= 17) {
    const upcExact = digits.slice(0, 17);
    return { digits: upcExact, upcExact, upc12: upcExact.slice(0, 12) };
  }

  if (digits.length === 13 && /^(978|979)/.test(digits)) {
    return { digits, isbn: digits };
  }

  if (digits.length === 10 || /^\d{9}X$/.test(digits)) {
    return { digits, isbn: digits };
  }

  if (digits.length === 12) {
    return { digits, upc12: digits, upcExact: digits };
  }

  if (digits.length === 13) {
    return { digits, upcExact: digits, upc12: digits.slice(0, 12) };
  }

  if (digits.length >= 8) {
    return {
      digits,
      upcExact: digits,
      upc12: digits.length >= 12 ? digits.slice(0, 12) : undefined,
    };
  }

  return { digits };
}

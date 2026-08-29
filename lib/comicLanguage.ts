/**
 * Detect whether cover text looks like a Greek comic (vs foreign/Metron).
 */

const GREEK_PUBLISHER_RE =
  /\b(ΜΑΜΟΥΘ|MAMMOTH|MODERN\s*TIMES|JEMMA|ANUBIS|COMPUPRESS|ΚΟΜΙΞ|ΚΟΜΙΧ|ΕΙΚΟΝΕΣ|ΟΡΙΖΟΝΤΕΣ|ΠΑΡΑΠΕΝΤΕ|ΠΑΡΑ\s*ΠΕΝΤΕ|ΨΥΧΟΓΙΟΣ|ΛΙΒΑΝΗΣ|ΕΚΔΟΣΕΙΣ|ΜΙΚΡΟΣ\s*ΗΡΩΣ|ΜΙΚΡΟΣ\s*ΉΡΩΣ|ΟΞΥ|BRAINFOOD|ΚΑΚΤΟΣ|ΠΑΤΑΚΗ|ΜΕΤΑΙΧΜΙΟ|ΜΕΤΑΊΧΜΙΟ|ΔΙΟΠΤΡΑ|POLARIS|ΚΑΘΗΜΕΡΙΝΗ|ΤΕΡΖΟΠΟΥΛΟΣ|ΝΕΑ\s*ΑΚΤΙΝΑ|ΜΠΛΕΚ|ΑΛΜΑΝΑΚΟ|ΠΟΠΑΥ|ΜΙΚΥ\s*ΜΑΟΥΣ)\b/i;

/** Fold Greek/Latin comic text for alias matching (strip tonos, lowercase). */
export function foldComicText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ς/g, 'σ')
    .replace(/[–—−]/g, '-')
    .replace(/[^a-z0-9α-ω\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countGreekLetters(text: string): number {
  const matches = text.match(/[\u0370-\u03FF\u1F00-\u1FFF]/g);
  return matches?.length ?? 0;
}

/**
 * Heuristic: treat as Greek comic when OCR/title has meaningful Greek,
 * or known Greek publishers. Otherwise foreign (Metron).
 */
export function isGreekComicText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (GREEK_PUBLISHER_RE.test(t)) return true;

  const greek = countGreekLetters(t);
  if (greek === 0) return false;

  // Enough Greek letters relative to length (ignore spaces/digits/punct)
  const letters = (t.match(/[A-Za-z\u0370-\u03FF\u1F00-\u1FFF]/g) ?? []).length;
  if (letters === 0) return greek >= 3;
  return greek / letters >= 0.35 || greek >= 8;
}

export type ComicMarket = 'greek' | 'foreign';

export function detectComicMarket(...parts: Array<string | null | undefined>): ComicMarket {
  const combined = parts.filter(Boolean).join('\n');
  return isGreekComicText(combined) ? 'greek' : 'foreign';
}

/** Greek publishers that license Marvel/DC/manga — Metron still has usable covers. */
const GREEK_LICENSEE_RE =
  /\b(anubis|jemma|modern\s*times|μαμούθ|mamouth|οξύ|oxy|brainfood|compupress|μεταίχμιο|μεταιχμιο|πατάκη|πατακη|polaris)\b/i;

export function isGreekLicenseePublisher(publisher: string): boolean {
  return GREEK_LICENSEE_RE.test(publisher.trim());
}

/**
 * When the Greek catalog has no shop scan, fall back to Metron for licensed
 * reprints (Anubis Batman) and Latin-script series titles.
 */
export function shouldFallbackToMetronCover(series: string, publisher: string): boolean {
  if (isGreekLicenseePublisher(publisher)) return true;
  return /[A-Za-z]{3,}/.test(series);
}

import { foldComicText } from '@/lib/comicLanguage';

// Known multi-word series names to detect directly in OCR text (checked before scoring)
const KNOWN_SERIES: string[] = [
  'MARVEL TEAM-UP', 'MARVEL TWO-IN-ONE', 'MARVEL SUPER HEROES',
  'MARVEL PREMIERE', 'MARVEL TALES', 'MARVEL SPOTLIGHT', 'MARVEL FANFARE',
  'THE AMAZING SPIDER-MAN', 'AMAZING SPIDER-MAN',
  'THE SPECTACULAR SPIDER-MAN', 'SPECTACULAR SPIDER-MAN',
  'X-MEN', 'X MEN',
  'THE UNCANNY X-MEN', 'UNCANNY X-MEN',
  'THE AVENGERS', 'WEST COAST AVENGERS', 'NEW AVENGERS',
  'FANTASTIC FOUR', 'SECRET WARS',
  'THE INCREDIBLE HULK', 'INCREDIBLE HULK',
  'CAPTAIN AMERICA', 'CAPTAIN MARVEL',
  'IRON MAN', 'INVINCIBLE IRON MAN', 'IRON FIST',
  'THOR', 'MIGHTY THOR',
  'DAREDEVIL', 'GHOST RIDER',
  'SILVER SURFER', 'DOCTOR STRANGE',
  'THE FLASH', 'ACTION COMICS', 'DETECTIVE COMICS',
  'JUSTICE LEAGUE', 'TEEN TITANS', 'NEW TEEN TITANS',
  'BATMAN', 'SUPERMAN', 'WONDER WOMAN',
  'GREEN LANTERN', 'GREEN ARROW',
  'SWAMP THING', 'SAGA OF THE SWAMP THING',
  'SANDMAN', 'HELLBLAZER',
  'SPAWN', 'WITCHBLADE',
  'WALKING DEAD', 'THE WALKING DEAD',
  'INVINCIBLE',
];

/** Canonical Greek series names for OCR / typed add-flow (matched after folding tonos). */
const KNOWN_GREEK_SERIES: Array<{ needle: string; canonical: string }> = [
  { needle: 'ΝΕΟΣ ΜΠΛΕΚ', canonical: 'Νέος Μπλεκ' },
  { needle: 'ΣΥΛΛΕΚΤΙΚΟ ΜΠΛΕΚ', canonical: 'Συλλεκτικό Μπλεκ' },
  { needle: 'ΜΙΚΥ ΜΑΟΥΣ', canonical: 'Μίκυ Μάους' },
  { needle: 'MICKEY MOUSE', canonical: 'Μίκυ Μάους' },
  { needle: 'ΑΛΜΑΝΑΚΟ', canonical: 'Αλμανάκο' },
  { needle: 'ΚΛΑΣΙΚΕΣ ΙΣΤΟΡΙΕΣ POPEYE', canonical: 'Ποπάυ' },
  { needle: 'ΚΟΜΙΞ', canonical: 'ΚΟΜΙΞ' },
  { needle: 'ΚΟΜΙΧ', canonical: 'ΚΟΜΙΞ' },
  { needle: 'ΚΟΜΙX', canonical: 'ΚΟΜΙΞ' },
  { needle: 'ΠΟΠΑΥ', canonical: 'Ποπάυ' },
  { needle: 'POPEYE', canonical: 'Ποπάυ' },
  { needle: 'ΜΠΛΕΚ', canonical: 'Μπλεκ' },
  { needle: 'IL GRANDE BLEK', canonical: 'Μπλεκ' },
  { needle: 'BLEK', canonical: 'Μπλεκ' },
  { needle: 'ΜΙΚΥ', canonical: 'Μίκυ Μάους' },
];

// Words/phrases to skip when picking title lines
const SKIP_WORDS = new Set([
  'MARVEL', 'DC', 'COMICS', 'GROUP', 'INC', 'DEC', 'JAN', 'FEB',
  'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV',
  'FIRST', 'ISSUE', 'COLLECTOR', 'EDITION', 'BY', 'POPULAR', 'DEMAND',
  'FEATURING', 'THE', 'STINGING', 'RETURN', 'OF', 'AND', 'IN', 'AN',
  'ALL', 'NEW', 'ACTION', 'SERIES', 'STARS', 'WW', 'PRESENTS',
  'SPECIAL', 'ANNUAL', 'LIMITED', 'DIRECT', 'EDITION', 'SALE',
  'IMAGE', 'DARK', 'HORSE', 'IDW', 'BOOM', 'VALIANT', 'DYNAMITE',
  'PANINI', 'TITAN', 'ARCHIE',
]);

const PUBLISHER_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /MARVEL\s*COMICS\s*GROUP/i, name: 'Marvel' },
  { pattern: /MARVEL\s*COMICS/i, name: 'Marvel' },
  { pattern: /\bMARVEL\b/i, name: 'Marvel' },
  { pattern: /DC\s*COMICS/i, name: 'DC Comics' },
  { pattern: /\bDC\b/, name: 'DC Comics' },
  { pattern: /IMAGE\s*COMICS/i, name: 'Image Comics' },
  { pattern: /DARK\s*HORSE/i, name: 'Dark Horse' },
  { pattern: /\bIDW\b/i, name: 'IDW' },
  { pattern: /BOOM[!.]?\s*STUDIOS/i, name: 'Boom! Studios' },
  { pattern: /\bVALIANT\b/i, name: 'Valiant' },
  { pattern: /\bDYNAMITE\b/i, name: 'Dynamite' },
  { pattern: /\bPANINI\b/i, name: 'Panini' },
  { pattern: /\bTITAN\s*COMICS\b/i, name: 'Titan Comics' },
  { pattern: /\bARCHIE\b/i, name: 'Archie Comics' },
  { pattern: /ΜΑΜΟΥΘ/i, name: 'Μαμούθ Comix' },
  { pattern: /MODERN\s*TIMES/i, name: 'Modern Times' },
  { pattern: /JEMMA\s*PRESS/i, name: 'Jemma Press' },
  { pattern: /\bANUBIS\b/i, name: 'Anubis' },
  { pattern: /COMPUPRESS/i, name: 'Compupress' },
  { pattern: /ΜΙΚΡΟΣ\s*[ΉΗ]ΡΩΣ/i, name: 'Μικρός Ήρως' },
  { pattern: /BRAINFOOD|\bΟΞΥ\b|\bOXY\s*COMICS\b/i, name: 'Οξύ / Brainfood' },
  { pattern: /ΚΑΚΤΟΣ|\bKAKTOS\b/i, name: 'Κάκτος' },
  { pattern: /ΠΑΤΑΚΗ|\bPATAKI/i, name: 'Πατάκη' },
  { pattern: /ΜΕΤΑ[ΙΊ]ΧΜΙΟ|METAIXMIO/i, name: 'Μεταίχμιο' },
  { pattern: /ΔΙΟΠΤΡΑ|\bDIOPTRA\b/i, name: 'Διόπτρα' },
  { pattern: /\bPOLARIS\b/i, name: 'Polaris' },
  { pattern: /ΚΑΘΗΜΕΡΙΝΗ/i, name: 'Καθημερινή' },
  { pattern: /ΤΕΡΖΟΠΟΥΛΟΣ|ΝΕΑ\s*ΑΚΤΙΝΑ/i, name: 'Τερζόπουλος / Νέα Ακτίνα' },
];

export function extractComicInfoFromOcr(ocrText: string): {
  title: string;
  issue: string;
  publisher: string;
} {
  const lines = ocrText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // --- Issue number ---
  // Classic Marvel/DC corner box is often "124" above "AUG" / "25¢" — never treat cents as issue.
  let issue = '';
  const monthToken = '(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)';
  const tefchosMatch = ocrText.match(/\bΤΕΥΧΟΣ\s*[#:]?\s*(\d{1,4})\b/i);
  const hashMatch = ocrText.match(/#\s*(\d{1,4})\b/);
  const volNoMatch = ocrText.match(/\bVOL\.?\s*\d+\s*(?:NO\.?\s*)?(\d{1,4})\b/i);
  const noMatch = ocrText.match(/\bN[Oo]\.?\s*(\d{1,4})\b/);
  const issueMatch = ocrText.match(/\bISSUE\s+(\d{1,4})\b/i);
  // "124 AUG" / "AUG 124" on Bronze/Silver Age covers (allow 2–3 digit issues, not only <100)
  const indiciaMonthMatch = ocrText.match(
    new RegExp(`\\b(\\d{2,3})\\s*${monthToken}\\b`, 'i'),
  );
  const monthIndiciaMatch = ocrText.match(
    new RegExp(`\\b${monthToken}\\s*(\\d{2,3})\\b`, 'i'),
  );

  // Strip price tokens so 25¢ / $0.35 / 350 ΔΡΧ never become the issue
  const textNoPrice = ocrText
    .replace(/\bΤΙΜΗ\b[^\n]*/gi, ' ')
    .replace(/\b\d{1,3}\s*[¢c]\b/gi, ' ')
    .replace(/\$\s*\d+(?:[.,]\d+)?/g, ' ')
    .replace(/\b\d{2,5}\s*(ΔΡΧ\.?|ΔΡΑΧΜ|€|EUR|EURO)\b/gi, ' ');

  // Standalone numbers near the top of the cover (corner box) — prefer those.
  const earlyStandalone: number[] = [];
  const allStandalone: number[] = [];
  textNoPrice.split(/\n+/).forEach((rawLine, idx) => {
    const l = rawLine.trim();
    if (!/^\d{1,4}$/.test(l)) return;
    const n = Number(l);
    // Skip barcode-ish / year-ish noise
    if (n < 1 || n > 9999 || n === 50) return;
    if (/^(19|20)\d{2}$/.test(l)) return;
    allStandalone.push(n);
    if (idx < 8) earlyStandalone.push(n);
  });

  const plausibleIssue = (n: number) => n >= 1 && n <= 9999;

  if (tefchosMatch && plausibleIssue(Number(tefchosMatch[1]))) issue = tefchosMatch[1];
  else if (hashMatch && plausibleIssue(Number(hashMatch[1]))) issue = hashMatch[1];
  else if (volNoMatch && plausibleIssue(Number(volNoMatch[1]))) issue = volNoMatch[1];
  else if (noMatch && plausibleIssue(Number(noMatch[1]))) issue = noMatch[1];
  else if (issueMatch && plausibleIssue(Number(issueMatch[1]))) issue = issueMatch[1];
  else if (indiciaMonthMatch && plausibleIssue(Number(indiciaMonthMatch[1]))) {
    issue = String(Number(indiciaMonthMatch[1]));
  } else if (monthIndiciaMatch && plausibleIssue(Number(monthIndiciaMatch[1]))) {
    issue = String(Number(monthIndiciaMatch[1]));
  } else if (earlyStandalone.length > 0) {
    // Corner-box issues are often the largest early number (124 beats leftover 1/10 noise)
    const fourDigit = earlyStandalone.filter((n) => n >= 1000 && n <= 9999);
    const threeDigit = earlyStandalone.filter((n) => n >= 100 && n < 1000);
    issue = String(
      fourDigit.length > 0
        ? Math.max(...fourDigit)
        : threeDigit.length > 0
          ? Math.max(...threeDigit)
          : Math.max(...earlyStandalone),
    );
  } else if (allStandalone.length > 0) {
    const fourDigit = allStandalone.filter((n) => n >= 1000 && n <= 9999);
    const threeDigit = allStandalone.filter((n) => n >= 100 && n < 1000);
    issue = String(
      fourDigit.length > 0
        ? Math.max(...fourDigit)
        : threeDigit.length > 0
          ? Math.max(...threeDigit)
          : Math.max(...allStandalone),
    );
  }

  // --- Publisher ---
  let publisher = '';
  for (const { pattern, name } of PUBLISHER_PATTERNS) {
    if (pattern.test(ocrText)) {
      publisher = name;
      break;
    }
  }

  // --- Title ---

  // Pass 1: check for known series names directly in OCR text (most reliable)
  let title = '';
  const foldedOcr = foldComicText(ocrText);
  const greekSeriesBySpecificity = [...KNOWN_GREEK_SERIES].sort(
    (a, b) => foldComicText(b.needle).length - foldComicText(a.needle).length,
  );
  for (const series of greekSeriesBySpecificity) {
    const needle = foldComicText(series.needle);
    if (needle && foldedOcr.includes(needle)) {
      title = series.canonical;
      break;
    }
  }

  const upperOcr = ocrText.toUpperCase();
  // Prefer the most specific known series first (longer names before short aliases).
  if (!title) {
  const knownSeriesBySpecificity = [...KNOWN_SERIES].sort((a, b) => b.length - a.length);
  for (const series of knownSeriesBySpecificity) {
    if (upperOcr.includes(series)) {
      // Use the proper casing from the known list (Title Case)
      title = series
        .split(' ')
        .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ');
      // Fix hyphens: "Team-Up" not "Team-up"
      title = title.replace(/-(\w)/g, (_, c: string) => `-${c.toUpperCase()}`);
      break;
    }
  }
  }

  // Pass 2 (fallback): score each line if no known series found
  if (!title) {
  const scored: Array<{ line: string; score: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const up = line.toUpperCase();

    // Skip pure numbers, very short/long lines
    if (/^\d+$/.test(line)) continue;
    if (line.length < 3 || line.length > 70) continue;
    // Skip publisher lines
    if (publisher && up.includes(publisher.toUpperCase())) continue;
    // Skip lines that are entirely skip words
    const words = up.split(/\s+/);
    if (words.every((w) => SKIP_WORDS.has(w) || /^\d+$/.test(w))) continue;
    // Skip price/date patterns
    if (/^\$[\d.]+|^\d+p\b|^\d{4}$|^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/i.test(line)) continue;
    // Skip lines with issue number
    if (issue && line === issue) continue;

    let score = 0;
    // Earlier lines get higher score (titles are usually at top)
    score += Math.max(0, 10 - i) * 2;
    // All-caps lines are likely titles
    if (line === up && /[A-Z]/.test(line)) score += 8;
    // Longer lines (but not too long) score higher
    score += Math.min(line.replace(/\s/g, '').length, 20);
    // Contains hyphen (compound superhero names like SPIDER-MAN)
    if (/-/.test(line)) score += 4;
    // Avoid lines that look like credits ("Written by", "Art by")
    if (/\b(written|art|story|cover|color|letter|ink|pencil|script|by)\b/i.test(line)) score -= 20;

    scored.push({ line, score });
  }

  scored.sort((a, b) => b.score - a.score);

  if (scored.length > 0) {
    const best = scored[0].line;
    title = best;

    // Try to merge with the next line if they appear consecutive and both score well
    if (scored.length > 1) {
      const bestIdx = lines.indexOf(best);
      const secondBest = scored[1].line;
      const secondIdx = lines.indexOf(secondBest);

      if (
        Math.abs(bestIdx - secondIdx) === 1 &&
        scored[1].score > scored[0].score * 0.6 &&
        (title + ' ' + secondBest).length <= 60
      ) {
        title = bestIdx < secondIdx
          ? `${best} ${secondBest}`
          : `${secondBest} ${best}`;
      }
    }
  }
  } // end pass 2

  // Clean up the title
  title = title.replace(/#\s*\d+/g, '').replace(/\s+/g, ' ').trim();

  return { title, issue, publisher };
}

/**
 * Greek release shape: periodic issue, numbered volume, or standalone graphic novel.
 */

export type GreekReleaseFormat = 'τεύχος' | 'τόμος' | 'graphic_novel';

/** Short codes stored in greekcomicsCatalog.json (`fmt` on series). */
export type GreekFormatCode = 't' | 'v' | 'n';

const CODE_TO_FORMAT: Record<GreekFormatCode, GreekReleaseFormat> = {
  t: 'τεύχος',
  v: 'τόμος',
  n: 'graphic_novel',
};

export const greekFormatLabels: Record<GreekReleaseFormat, string> = {
  τεύχος: 'Τεύχος',
  τόμος: 'Τόμος',
  graphic_novel: 'Graphic Novel',
};

/** Normalize legacy / Gemini / DB spellings onto canonical format. */
export function normalizeGreekFormat(
  value?: string | null,
): GreekReleaseFormat | undefined {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ');
  if (!raw) return undefined;

  if (raw === 't' || raw === 'τευχος' || raw === 'περιοδικο' || raw === 'periodic' || raw === 'issue') {
    return 'τεύχος';
  }
  if (
    raw === 'v' ||
    raw === 'tomos' ||
    raw === 'τομος' ||
    raw === 'volume' ||
    raw === 'vol' ||
    raw === 'tpb' ||
    raw === 'collected'
  ) {
    return 'τόμος';
  }
  if (
    raw === 'n' ||
    raw === 'gn' ||
    raw === 'graphic novel' ||
    raw === 'graphic_novel' ||
    raw === 'album' ||
    raw === 'one shot' ||
    raw === 'oneshot'
  ) {
    return 'graphic_novel';
  }
  return undefined;
}

export function greekFormatFromCode(code?: string | null): GreekReleaseFormat | undefined {
  if (!code) return undefined;
  const c = code.trim() as GreekFormatCode;
  return CODE_TO_FORMAT[c] ?? normalizeGreekFormat(code);
}

export function greekFormatToCode(format: GreekReleaseFormat): GreekFormatCode {
  if (format === 'τεύχος') return 't';
  if (format === 'τόμος') return 'v';
  return 'n';
}

export function greekFormatLabel(format?: string | null): string | undefined {
  const normalized = normalizeGreekFormat(format);
  return normalized ? greekFormatLabels[normalized] : undefined;
}

/**
 * Infer catalog format from series title + how many covers exist in the archive.
 * Used when ingesting greekcomics.gr and as a runtime fallback.
 */
export function inferGreekSeriesFormat(seriesTitle: string, issueCount: number): GreekReleaseFormat {
  const upper = seriesTitle.toUpperCase();
  const plain = seriesTitle;

  if (/GRAPHIC\s*NOVEL/i.test(upper)) return 'graphic_novel';
  if (/\(ΤΟΜΟΙ\)|ΤΟΜΟΙ\)|\bΤΟΜΟΣ\b|\bVOL\.?\s*\d/i.test(upper)) return 'τόμος';
  if (/\bΤόμος\b|\bΤόμ\.?\s*\d/u.test(plain)) return 'τόμος';

  const periodical =
    /ΜΠΛΕΚ|ΜΙΚΥ|ΚΟΜΙΞ|ΚΟΜΙΧ|ΑΛΜΑΝΑΚ|ΠΕΡΙΟΔΙΚ|ΜΙΚΥ ΜΑΟΥΣ|ΜΙΚΥ ΜΑΟΥΣ/i.test(upper);
  if (periodical) return 'τεύχος';

  if (issueCount <= 1) return 'graphic_novel';
  if (issueCount >= 48) return 'τεύχος';
  return 'τόμος';
}

/** Guess format from Gemini scan text (title, issue, volume, notes). */
export function inferGreekFormatFromScan(input: {
  series?: string;
  issue?: string;
  volume?: string;
  notes?: string;
  format?: string;
}): GreekReleaseFormat | undefined {
  const fromField = normalizeGreekFormat(input.format);
  if (fromField) return fromField;

  const blob = `${input.series ?? ''} ${input.notes ?? ''}`.toUpperCase();
  if (/GRAPHIC\s*NOVEL/.test(blob)) return 'graphic_novel';
  if (/\(ΤΟΜΟΙ\)|\bΤΟΜΟΣ\b|\bVOL\.?\s*\d/.test(blob)) return 'τόμος';
  if (/\bΤΕΥΧΟΣ\b|\bISSUE\b|\b#?\d{2,4}\b/.test(blob) && !/ΤΟΜΟΣ|VOL/.test(blob)) {
    if (input.issue?.trim()) return 'τεύχος';
  }

  if (input.volume?.trim()) return 'τόμος';
  if (input.issue?.trim()) {
    const n = Number(input.issue);
    if (Number.isFinite(n) && n >= 1 && n <= 3 && !input.volume && /:/.test(input.series ?? '')) {
      return 'graphic_novel';
    }
    return inferGreekSeriesFormat(input.series ?? '', 12);
  }
  if (/:/.test(input.series ?? '') || !input.issue?.trim()) return 'graphic_novel';
  return undefined;
}

export function formatsCompatible(
  a?: GreekReleaseFormat,
  b?: GreekReleaseFormat,
): boolean {
  if (!a || !b) return true;
  if (a === b) return true;
  if (
    (a === 'τόμος' && b === 'graphic_novel') ||
    (a === 'graphic_novel' && b === 'τόμος')
  ) {
    return true;
  }
  return false;
}

/** Catalog + forms use one issue field; for τόμοι that number is the volume index. */
export function resolveGreekIssueNumber(input: {
  issue?: string | null;
  volume?: string | null;
  format?: GreekReleaseFormat | string | null;
  notes?: string | null;
}): string {
  const issue = String(input.issue ?? '')
    .trim()
    .replace(/^#/, '');
  if (issue) return issue;

  let volume = String(input.volume ?? '')
    .trim()
    .replace(/^#/, '');
  const notes = String(input.notes ?? '');
  if (!volume && notes) {
    const volMatch = notes.match(/\b(?:vol\.?|τόμ(?:ος|\.?))\s*[#:]?\s*(\d{1,4})\b/iu);
    if (volMatch) volume = volMatch[1];
  }

  const format = normalizeGreekFormat(input.format);
  if (!volume) return '';
  if (format === 'graphic_novel') return '';
  return volume;
}

export function isGreekVolumeFormat(format?: string | null): boolean {
  return normalizeGreekFormat(format) === 'τόμος';
}

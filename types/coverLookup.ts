export type EditionKind =
  | '1st_print'
  | '2nd_print'
  | 'reprint'
  | 'facsimile'
  | 'variant'
  | 'special'
  | 'unknown';

export type CoverEdition = {
  id: string;
  issueId?: string;
  kind: EditionKind;
  label: string;
  year?: string;
  publisher?: string;
  notes?: string;
  confidence: number;
  sourceName: string;
  sourceUrl?: string;
};

export type CoverMatch = {
  id: string;
  issueId?: string;
  series: string;
  issue: string;
  title: string;
  publisher: string;
  category?: string;
  /** Greek release shape when known (τεύχος / τόμος / graphic novel). */
  releaseFormat?: string;
  coverUrl?: string;
  confidence: number;
  sourceName: string;
  sourceUrl?: string;
  editions: CoverEdition[];
};

export type CoverLookupResult = {
  photoUri: string;
  queryHint?: string;
  matches: CoverMatch[];
  usedDemo: boolean;
};

export const editionKindLabels: Record<EditionKind, string> = {
  '1st_print': '1η εκτύπωση',
  '2nd_print': '2η εκτύπωση',
  reprint: 'Reprint',
  facsimile: 'Facsimile',
  variant: 'Variant cover',
  special: 'Special edition',
  unknown: 'Άγνωστη έκδοση',
};

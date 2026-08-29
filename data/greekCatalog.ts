/**
 * Historical Greek comics catalog (flagship series + greekcomics.gr archive).
 * Flagship cover URLs are official publisher/shop files.
 * Archive metadata comes from data/greekcomicsCatalog.json.
 * Kept as a local fallback until/unless Supabase `greek_series` + `greek_issues` is applied.
 */

export type GreekCatalogFormat = 'τεύχος' | 'τόμος' | 'graphic_novel';

export type GreekCatalogSeriesSeed = {
  catalogKey: string;
  name: string;
  publisher: string;
  yearStart?: number;
  yearEnd?: number;
  format: GreekCatalogFormat;
  aliases: string[];
};

export type GreekCatalogIssueSeed = {
  seriesKey: string;
  catalogKey: string;
  number: string;
  title?: string;
  year?: number;
  coverUrl?: string;
  sourceUrl?: string;
};

export const GREEK_CATALOG_SERIES: GreekCatalogSeriesSeed[] = [
  {
    catalogKey: 'blek',
    name: 'Μπλεκ',
    publisher: 'Μικρός Ήρως',
    yearStart: 2018,
    format: 'τεύχος',
    aliases: ['Μπλεκ', 'ΜΠΛΕΚ', 'Blek', 'Il Grande Blek', 'Ο Ξανθός Γίγας'],
  },
  {
    catalogKey: 'neos-blek',
    name: 'Νέος Μπλεκ',
    publisher: 'Μικρός Ήρως',
    yearStart: 2014,
    format: 'τεύχος',
    aliases: ['Νέος Μπλεκ', 'ΝΕΟΣ ΜΠΛΕΚ', 'Neos Blek'],
  },
  {
    catalogKey: 'syllektiko-blek',
    name: 'Συλλεκτικό Μπλεκ',
    publisher: 'Μικρός Ήρως',
    yearStart: 1994,
    format: 'τεύχος',
    aliases: ['Συλλεκτικό Μπλεκ', 'ΣΥΛΛΕΚΤΙΚΟ ΜΠΛΕΚ', 'Syllektiko Blek'],
  },
  {
    catalogKey: 'mickey',
    name: 'Μίκυ Μάους',
    publisher: 'Καθημερινή',
    yearStart: 2014,
    format: 'τεύχος',
    aliases: ['Μίκυ Μάους', 'ΜΙΚΥ ΜΑΟΥΣ', 'ΜΙΚΥ', 'Mickey Mouse', 'Μίκυ'],
  },
  {
    catalogKey: 'komix',
    name: 'ΚΟΜΙΞ',
    publisher: 'Καθημερινή',
    yearStart: 2014,
    format: 'τεύχος',
    aliases: ['ΚΟΜΙΞ', 'ΚΟΜΙΧ', 'Κόμιξ', 'Komix', 'COMIX'],
  },
  {
    catalogKey: 'almanako',
    name: 'Αλμανάκο',
    publisher: 'Τερζόπουλος / Νέα Ακτίνα',
    yearStart: 1990,
    yearEnd: 2012,
    format: 'τεύχος',
    aliases: ['Αλμανάκο', 'ΑΛΜΑΝΑΚΟ', 'Almanako', 'Σούπερ Αλμανάκο', 'Αλμανάκο Φάντομ Ντακ'],
  },
  {
    catalogKey: 'popeye',
    name: 'Ποπάυ',
    publisher: 'Μικρός Ήρως',
    yearStart: 2022,
    format: 'τόμος',
    aliases: ['Ποπάυ', 'ΠΟΠΑΥ', 'Popeye', 'Κλασικές Ιστορίες Popeye'],
  },
];

const MH = 'https://www.mikrosiros.gr';
const MH_IMG = `${MH}/image/catalog`;
const KATH = 'https://www.kathimerini.gr';

function blekIssue(n: number, year?: number): GreekCatalogIssueSeed {
  const padded = String(n).padStart(3, '0');
  return {
    seriesKey: 'blek',
    catalogKey: `blek-${n}`,
    number: String(n),
    title: `Μπλεκ #${n}`,
    year,
    coverUrl: `${MH_IMG}/mikros-iros_mplek${padded}.jpg`,
    sourceUrl: n === 1 ? `${MH}/mplek-no1` : `${MH}/mplek-no-${n}`,
  };
}

export const GREEK_CATALOG_ISSUES: GreekCatalogIssueSeed[] = [
  // Μπλεκ (τρέχον περιοδικό Μικρός Ήρως) — official OpenCart covers
  blekIssue(1, 2018),
  blekIssue(2),
  blekIssue(3),
  blekIssue(4),
  blekIssue(5),
  blekIssue(6),
  blekIssue(7, 2019),
  blekIssue(8, 2020),
  blekIssue(9, 2020),
  blekIssue(10),
  blekIssue(11),
  blekIssue(12),
  {
    seriesKey: 'neos-blek',
    catalogKey: 'neos-blek-53',
    number: '53',
    title: 'Νέος Μπλεκ #53',
    year: 2018,
    coverUrl: `${MH_IMG}/mikros-iros_neos_mplek053.jpg`,
    sourceUrl: `${MH}/neos-mplek-no-53`,
  },
  {
    seriesKey: 'syllektiko-blek',
    catalogKey: 'syllektiko-blek-33',
    number: '33',
    title: 'Συλλεκτικό Μπλεκ #33 — Η Γκρέτα εκδικείται',
    coverUrl: `${MH_IMG}/mikros-iros_syl_mplek033.jpg`,
    sourceUrl: `${MH}/no-33-h-greta-ekdikeitai`,
  },

  // Μίκυ Μάους — official Kathimerini Disney article images
  {
    seriesKey: 'mickey',
    catalogKey: 'mickey-537',
    number: '537',
    title: 'Ο καλύτερος βοηθός',
    year: 2024,
    coverUrl: `${KATH}/wp-content/uploads/2024/08/swm-MM537_1920x1080-1200x630.jpg`,
    sourceUrl: `${KATH}/k/disney/563189950/miky-maoys-537-o-kalyteros-voithos/`,
  },
  {
    seriesKey: 'mickey',
    catalogKey: 'mickey-633',
    number: '633',
    title: 'Αποστολή στους τροπικούς',
    year: 2026,
    coverUrl: `${KATH}/wp-content/uploads/2026/06/swm-MM633_1920x1080-1200x630.jpg`,
    sourceUrl: `${KATH}/k/disney/564316075/miky-maoys-633-apostoli-stoys-tropikoys/`,
  },
  {
    seriesKey: 'mickey',
    catalogKey: 'mickey-634',
    number: '634',
    title: 'Τα δύο χωριά',
    year: 2026,
    coverUrl: `${KATH}/wp-content/uploads/2026/08/swm-MM634_1920x1080-1200x630.jpg`,
    sourceUrl: `${KATH}/k/disney/564387673/miky-maoys-634-ta-dyo-choria/`,
  },
  {
    seriesKey: 'mickey',
    catalogKey: 'mickey-635',
    number: '635',
    title: 'Η πηγή της νιότης',
    year: 2026,
    coverUrl: `${KATH}/wp-content/uploads/2026/08/swm-MM635_1920x1080-1200x630.jpg`,
    sourceUrl: `${KATH}/k/disney/564395935/miky-maoys-635-i-pigi-tis-niotis/`,
  },

  // ΚΟΜΙΞ — official Kathimerini Disney article images
  {
    seriesKey: 'komix',
    catalogKey: 'komix-145',
    number: '145',
    title: 'Ο φαραώ Ντακταγχαμών',
    year: 2026,
    coverUrl: `${KATH}/wp-content/uploads/2026/06/swm-Cx145_1920x1080-1200x630.jpg`,
    sourceUrl: `${KATH}/k/disney/564316063/komix-145-o-farao-ntaktagchamon/`,
  },
  {
    seriesKey: 'komix',
    catalogKey: 'komix-146',
    number: '146',
    title: 'Ο γάμος του Σκρουτζ Μακ Ντακ',
    year: 2026,
    coverUrl: `${KATH}/wp-content/uploads/2026/08/swm-Cx146_1920x1080-1200x630.jpg`,
    sourceUrl: `${KATH}/k/disney/564405661/komix-146-o-gamos-toy-skroytz-mak-ntak/`,
  },

  // Αλμανάκο — no official shop covers remain; series + known issue numbers only
  {
    seriesKey: 'almanako',
    catalogKey: 'almanako-1',
    number: '1',
    title: 'Αλμανάκο #1',
    year: 1990,
  },
  {
    seriesKey: 'almanako',
    catalogKey: 'almanako-257',
    number: '257',
    title: 'Αλμανάκο #257',
    year: 2012,
  },

  // Ποπάυ — official Mikrosiros covers
  {
    seriesKey: 'popeye',
    catalogKey: 'popeye-1',
    number: '1',
    title: 'Κλασικές Ιστορίες Popeye #1 — Το μωβ μαργαριτάρι',
    year: 2022,
    coverUrl: `${MH_IMG}/popeye-classic-01-mh.jpg`,
    sourceUrl: `${MH}/klasikes-istories-popeye-01`,
  },
  {
    seriesKey: 'popeye',
    catalogKey: 'popeye-5',
    number: '5',
    title: 'Κλασικές Ιστορίες Popeye #5 — Ηλεκτρονικές μπαφλιάρες',
    year: 2025,
    coverUrl: `${MH_IMG}/popeye-5-cover-mikros-iros.jpg`,
    sourceUrl: `${MH}/klasikes-istories-popeye-5`,
  },
  {
    seriesKey: 'popeye',
    catalogKey: 'popeye-7',
    number: '7',
    title: 'Κλασικές Ιστορίες Popeye #7 — Ο βασιλιάς φάντασμα',
    year: 2026,
    coverUrl: `${MH_IMG}/popeyeclassics7-mh.jpg`,
    sourceUrl: `${MH}/klasikes-istories-popeye-7`,
  },
  {
    seriesKey: 'popeye',
    catalogKey: 'popeye-thiasos',
    number: 'Θίασος',
    title: 'Ποπάυ — Ο Θίασος',
    year: 2026,
    coverUrl: `${MH_IMG}/popeye-o-thiasos-cover.jpg`,
    sourceUrl: `${MH}/popeye-o-thiasos`,
  },
];

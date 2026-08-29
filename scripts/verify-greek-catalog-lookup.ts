import {
  findTightGreekScanHits,
  localGreekCatalogRows,
  lookupExactGreekCatalogCover,
  searchGreekCatalogLocal,
} from '@/lib/greekCatalogMatch';

const queries: Array<[string, string]> = [
  ['Μπλεκ #31', 'blek-31'],
  ['Μίκυ Μάους #630', 'mickey-630'],
  ['ΚΟΜΙΞ #146', 'komix-146'],
  ['ΠΑΝΙΚ ΑΤΤΑΚ #1', 'gc-6116-1'],
  ['SOLO LEVELING #7', 'gc-7208-7'],
  ['BATMAN-DEADPOOL', 'gc-7286-1'],
];

let failed = false;
for (const [query, catalogKey] of queries) {
  const hits = searchGreekCatalogLocal(query);
  const hit = hits.find((h) => h.catalogKey === catalogKey) ?? hits[0];
  const needsCover = !catalogKey.startsWith('gc-');
  if (!hit || hit.catalogKey !== catalogKey || (needsCover && !hit.coverUrl)) {
    console.error(`FAIL lookup ${query}`, hits.slice(0, 3));
    failed = true;
    continue;
  }
  console.log(`OK lookup ${query} -> ${hit.catalogKey} ${hit.coverUrl ?? hit.publisher}${hit.format ? ` [${hit.format}]` : ''}`);
}

const solo = searchGreekCatalogLocal('SOLO LEVELING #7').find((h) => h.catalogKey === 'gc-7208-7');
if (solo?.format !== 'τόμος') {
  console.error('FAIL format SOLO LEVELING', solo?.format);
  failed = true;
} else {
  console.log('OK format SOLO LEVELING -> τόμος');
}

const gn = searchGreekCatalogLocal('BATMAN-DEADPOOL').find((h) => h.catalogKey === 'gc-7286-1');
if (gn?.format !== 'graphic_novel') {
  console.error('FAIL format BATMAN-DEADPOOL', gn?.format);
  failed = true;
} else {
  console.log('OK format BATMAN-DEADPOOL -> graphic_novel');
}

const blek = searchGreekCatalogLocal('Μπλεκ #31').find((h) => h.catalogKey === 'blek-31');
if (blek?.format !== 'τεύχος') {
  console.error('FAIL format Μπλεκ', blek?.format);
  failed = true;
} else {
  console.log('OK format Μπλεκ -> τεύχος');
}

const supermanTight = findTightGreekScanHits(localGreekCatalogRows(), {
  title: 'Superman',
  issue: '7',
  publisher: 'Anubis',
  format: 'τόμος',
});
const supermanHit = supermanTight.find((h) => h.catalogKey === 'gc-144-7');
const supermanCover = lookupExactGreekCatalogCover('Superman', '7', 'Anubis');
if (!supermanHit?.coverUrl || !supermanCover || supermanHit.format !== 'τόμος') {
  console.error('FAIL Superman Anubis τόμος 7', {
    supermanCover,
    supermanTight: supermanTight.slice(0, 3),
  });
  failed = true;
} else {
  console.log(`OK Superman Anubis τόμος 7 -> ${supermanHit.catalogKey} ${supermanCover}`);
}

const superman = searchGreekCatalogLocal('Superman', {
  title: 'Superman',
  issue: '7',
  publisher: 'Anubis',
  format: 'τόμος',
}).find((h) => h.catalogKey === 'gc-144-7');
if (!superman || superman.format !== 'τόμος') {
  console.error('FAIL Superman τόμος 7', superman?.catalogKey, superman?.format);
  failed = true;
} else {
  console.log('OK lookup Superman τόμος 7 ->', superman.catalogKey, superman.coverUrl);
}

const batmanCover = lookupExactGreekCatalogCover('Batman', '25', 'Anubis');
const batmanTight = findTightGreekScanHits(localGreekCatalogRows(), {
  title: 'Batman',
  issue: '25',
  publisher: 'Anubis',
  format: 'τεύχος',
});
const batmanHit = batmanTight.find((h) => h.catalogKey === 'gc-142-25');
if (!batmanCover || !batmanHit?.coverUrl || batmanHit.catalogKey !== 'gc-142-25') {
  console.error('FAIL Batman Anubis #25 cover', { batmanCover, batmanTight: batmanTight.slice(0, 3) });
  failed = true;
} else {
  console.log(`OK Batman Anubis #25 -> ${batmanHit.catalogKey} ${batmanCover}`);
}

if (failed) process.exit(1);

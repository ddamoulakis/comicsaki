/**
 * Curated Greek comics / graphic novels from major Greek publishers.
 * Cover URLs from public e-shop product images.
 * IDs use 9xxxxxx range to avoid clashing with Metron issue IDs.
 */

export type GreekReleaseSeed = {
  id: number;
  series: string;
  number: string;
  publisher:
    | 'Anubis'
    | 'Jemma Press'
    | 'Μαμούθ Comix'
    | 'Μικρός Ήρως'
    | 'Οξύ / Brainfood'
    | 'Κάκτος'
    | 'Πατάκη'
    | 'Μεταίχμιο'
    | 'Διόπτρα'
    | 'Polaris';
  storeDate: string | null;
  image: string;
  price: string | null;
  sourceUrl?: string;
};

export const GREEK_RELEASES: GreekReleaseSeed[] = [
  // ——— Anubis ———
  {
    id: 9000031,
    series: 'Batman/Deadpool: Αλλόκοτη Συνάντηση',
    number: '1',
    publisher: 'Anubis',
    storeDate: '2026-06-19',
    image: 'https://anubis.gr/wp-content/uploads/2026/06/Deadpool_Batman_2026.jpg',
    price: '15.50',
    sourceUrl: 'https://anubis.gr/product/batman-deadpool-allokoti-synantisi/',
  },
  {
    id: 9000032,
    series: 'Spider-Man: Κοσμικό Χάος!',
    number: '1',
    publisher: 'Anubis',
    storeDate: '2026-04-01',
    image: 'https://anubis.gr/wp-content/uploads/2026/04/Spider-Man-Kosmiko-Xaos.jpg',
    price: null,
    sourceUrl: 'https://anubis.gr/product/spider-man-kosmiko-chaos/',
  },
  {
    id: 9000033,
    series: 'Spider-Man: Κβαντική Αποστολή',
    number: '1',
    publisher: 'Anubis',
    storeDate: '2026-01-01',
    image:
      'https://anubis.gr/wp-content/uploads/2026/01/%CE%95%CE%BE%CF%8E%CF%86%CF%85%CE%BB%CE%BB%CE%BF-SPIDERMAN-Kvantiki-Apostoli-Quantum-Quest.jpg',
    price: null,
    sourceUrl: 'https://anubis.gr/product/spider-man-kvantiki-apostoli/',
  },
  {
    id: 9000034,
    series: 'Solo Leveling',
    number: '7',
    publisher: 'Anubis',
    storeDate: '2026-02-25',
    image: 'https://anubis.gr/wp-content/uploads/2026/02/SOLO-LEVELING7.jpg',
    price: null,
    sourceUrl: 'https://anubis.gr/product/solo-leveling-tomos-z/',
  },
  {
    id: 9000035,
    series: 'Avengers: Το Λυκόφως των Ηρώων',
    number: '1',
    publisher: 'Anubis',
    storeDate: '2025-06-01',
    image: 'https://anubis.gr/wp-content/uploads/2025/06/AVENGERS-TWILIGHT-cover.jpg',
    price: '21.90',
    sourceUrl: 'https://anubis.gr/product/avengers-to-lykofos-ton-iroon/',
  },
  {
    id: 9000036,
    series: 'Spider-Men II',
    number: '1',
    publisher: 'Anubis',
    storeDate: '2025-06-01',
    image:
      'https://anubis.gr/wp-content/uploads/2025/06/%CE%95%CE%BE%CF%8E%CF%86%CF%85%CE%BB%CE%BB%CE%BF-SPIDERMEN2.jpg',
    price: null,
    sourceUrl: 'https://anubis.gr/product/spider-men-ii/',
  },
  {
    id: 9000037,
    series: 'Superman: Ο Οίκος του Μπρέινιακ',
    number: '1',
    publisher: 'Anubis',
    storeDate: '2025-04-01',
    image:
      'https://anubis.gr/wp-content/uploads/2025/04/Εξώφυλλο-SUPERMAN-O-OIKOΣ-ΤΟΥ-ΜΠΡΕΙΝΙΑΚ.jpg',
    price: null,
    sourceUrl: 'https://anubis.gr/product/superman-o-oikos-toy-mpreiniak/',
  },
  {
    id: 9000001,
    series: 'Watchmen',
    number: 'TPB',
    publisher: 'Anubis',
    storeDate: '2024-04-24',
    image:
      'https://anubis.gr/wp-content/uploads/2024/04/%CE%95%CE%BE%CF%8E%CF%86%CF%85%CE%BB%CE%BB%CE%BF-Watchmen.jpg',
    price: '32.90',
    sourceUrl: 'https://anubis.gr/product/watchmen/',
  },
  {
    id: 9000009,
    series: 'Solo Leveling',
    number: '3',
    publisher: 'Anubis',
    storeDate: '2024-09-20',
    image: 'https://anubis.gr/wp-content/uploads/2024/08/SOLO-LEVELING3.jpg',
    price: '15.50',
    sourceUrl: 'https://anubis.gr/product/solo-leveling-tomos-g/',
  },

  // ——— Jemma Press (covers from jemmacomics.com) ———
  {
    id: 9000101,
    series: 'Κουραφέλκυθρα',
    number: '1',
    publisher: 'Jemma Press',
    storeDate: '2026-04-01',
    image:
      'https://jemmacomics.com/wp-content/uploads/2026/05/KOURAFELKITHRA_DEN_EINAI_KAN_COVER_VELVET-1.jpg',
    price: '8.50',
  },
  {
    id: 9000102,
    series: 'Ντίνγκο',
    number: '1',
    publisher: 'Jemma Press',
    storeDate: '2026-04-01',
    image: 'https://jemmacomics.com/wp-content/uploads/2026/05/DINGO_COVER_VELVET-1.jpg',
    price: '7.50',
  },
  {
    id: 9000103,
    series: 'Τίποτα δεν φυτρώνει στην Έρημο',
    number: '1',
    publisher: 'Jemma Press',
    storeDate: '2026-04-01',
    image: 'https://jemmacomics.com/wp-content/uploads/2026/05/TIPOTA_DEN_FYTRONI_COVER.jpg',
    price: '11.95',
  },
  {
    id: 9000104,
    series: 'ΣΠΑΛΤΣ!',
    number: '1',
    publisher: 'Jemma Press',
    storeDate: '2026-03-15',
    image: 'https://jemmacomics.com/wp-content/uploads/2026/05/SPALTS-ALBUM-COVER_J-1.jpg',
    price: '14.95',
  },
  {
    id: 9000105,
    series: 'Γκραν Γκρινιόλ',
    number: '1',
    publisher: 'Jemma Press',
    storeDate: '2026-02-01',
    image: 'https://jemmacomics.com/wp-content/uploads/2026/05/GGRINIOL_COVER_BRISTOL-1.jpg',
    price: '10.00',
  },
  {
    id: 9000106,
    series: 'Φονικό Μοντάζ',
    number: '1',
    publisher: 'Jemma Press',
    storeDate: '2026-01-15',
    image: 'https://jemmacomics.com/wp-content/uploads/2026/05/FONIKO_MONTAZ_COVER_BRISTOL-1.jpg',
    price: '12.95',
  },
  {
    id: 9000107,
    series: 'Katakunga',
    number: '1',
    publisher: 'Jemma Press',
    storeDate: '2025-11-01',
    image: 'https://jemmacomics.com/wp-content/uploads/2026/05/KATAKUNGA_COVER_BRISTOL-1.jpg',
    price: '14.93',
  },
  {
    id: 9000108,
    series: 'Δαγκάνα – Εσύ θα ξεχωρίσεις!',
    number: '1',
    publisher: 'Jemma Press',
    storeDate: '2025-10-01',
    image: 'https://jemmacomics.com/wp-content/uploads/2026/05/DAGANA_COVER_VELVET-1.jpg',
    price: '15.95',
  },
  {
    id: 9000109,
    series: 'Ρίγος (Junji Ito επιλέγει)',
    number: '1',
    publisher: 'Jemma Press',
    storeDate: '2026-04-04',
    image: 'https://jemmacomics.com/wp-content/uploads/2026/04/Aunnamed.jpg',
    price: '21.95',
  },
  {
    id: 9000110,
    series: 'X εις τον Ψ',
    number: '1',
    publisher: 'Jemma Press',
    storeDate: '2025-09-01',
    image: 'https://jemmacomics.com/wp-content/uploads/2025/11/X_PSI_COVER.jpg',
    price: '22.00',
  },
  {
    id: 9000111,
    series: 'El Eternauta 1969',
    number: '1',
    publisher: 'Jemma Press',
    storeDate: '2025-08-01',
    image: 'https://jemmacomics.com/wp-content/uploads/2025/11/ETERNAUTA1969_COVER_HC.jpg',
    price: '19.95',
  },
  {
    id: 9000112,
    series: 'Suspiria – Βασίλισσα του νεκρόκοσμου',
    number: '1',
    publisher: 'Jemma Press',
    storeDate: '2025-06-01',
    image: 'https://jemmacomics.com/wp-content/uploads/2025/11/SUSPIRIA_4_COVER.jpg',
    price: '9.95',
  },
  {
    id: 9000113,
    series: 'Diabolik',
    number: '1',
    publisher: 'Jemma Press',
    storeDate: '2025-05-01',
    image:
      'https://jemmacomics.com/wp-content/uploads/2025/09/529720315_18292145206271008_7569439156602679067_n.jpg',
    price: '12.95',
  },
  {
    id: 9000116,
    series: 'Περιπλανώμενοι',
    number: '1',
    publisher: 'Jemma Press',
    storeDate: '2025-02-01',
    image: 'https://jemmacomics.com/wp-content/uploads/2026/04/AGunnamed.jpg',
    price: '10.95',
  },
  {
    id: 9000117,
    series: 'O Δράκουλας στο Φαρ Ουέστ',
    number: '1',
    publisher: 'Jemma Press',
    storeDate: '2025-09-01',
    image: 'https://jemmacomics.com/wp-content/uploads/2025/09/DRACULA.jpg',
    price: '9.95',
  },

  // ——— Μαμούθ Comix ———
  {
    id: 9000201,
    series: 'Αστερίξ',
    number: '40',
    publisher: 'Μαμούθ Comix',
    storeDate: '2023-10-26',
    image:
      'https://mamouthcomix.gr/wp-content/uploads/2023/11/%CE%91%CF%83%CF%84%CE%B5%CF%81%CE%AF%CE%BE-%CE%97-%CE%9B%CE%B5%CF%85%CE%BA%CE%AE-%CE%AF%CF%81%CE%B9%CE%B4%CE%B1.png',
    price: '5.80',
    sourceUrl: 'https://mamouthcomix.gr/?s=%CE%91%CF%83%CF%84%CE%B5%CF%81%CE%AF%CE%BE%2040',
  },
  {
    id: 9000202,
    series: 'Αστερίξ',
    number: '39',
    publisher: 'Μαμούθ Comix',
    storeDate: '2021-10-21',
    image: 'https://mamouthcomix.gr/wp-content/uploads/2022/04/GRYPAS-EXOFYLLO.jpg',
    price: '5.80',
    sourceUrl: 'https://mamouthcomix.gr/?s=%CE%91%CF%83%CF%84%CE%B5%CF%81%CE%AF%CE%BE%2039',
  },
  {
    id: 9000203,
    series: 'Αστερίξ',
    number: '38',
    publisher: 'Μαμούθ Comix',
    storeDate: '2019-10-24',
    image:
      'https://mamouthcomix.gr/wp-content/uploads/2020/12/asterix-38-h-korh-tou-versinzetorix.jpg',
    price: '5.30',
    sourceUrl: 'https://mamouthcomix.gr/?s=%CE%91%CF%83%CF%84%CE%B5%CF%81%CE%AF%CE%BE%2038',
  },
  {
    id: 9000204,
    series: 'Αστερίξ – Στον δρόμο για την Κίνα',
    number: '1',
    publisher: 'Μαμούθ Comix',
    storeDate: '2024-06-01',
    image:
      'https://mamouthcomix.gr/wp-content/uploads/2023/10/%CE%91%CF%83%CF%84%CE%B5%CF%81%CE%AF%CE%BE-%CF%83%CF%84%CE%BF%CE%BD-%CE%B4%CF%81%CF%8C%CE%BC%CE%BF-%CE%B3%CE%B9-%CE%B1%CF%84%CE%B7%CE%BD-%CE%9A%CE%AF%CE%BD%CE%B1-scaled.jpg',
    price: '5.80',
    sourceUrl:
      'https://mamouthcomix.gr/?s=%CE%91%CF%83%CF%84%CE%B5%CF%81%CE%AF%CE%BE%20%CE%9A%CE%AF%CE%BD%CE%B1',
  },
  {
    id: 9000205,
    series: 'Λούκυ Λουκ',
    number: '89',
    publisher: 'Μαμούθ Comix',
    storeDate: '2023-11-01',
    image:
      'https://mamouthcomix.gr/wp-content/uploads/2023/11/%CE%9B%CE%BF%CF%8D%CE%BA%CF%85-%CE%BB%CE%BF%CF%85%CE%BA-89-%CE%97-%CE%BA%CE%B9%CE%B2%CF%89%CF%84%CF%8C%CF%82-%CF%84%CE%BF%CF%85-%CE%A1%CE%B1%CE%BD%CF%84%CE%B1%CE%BD%CF%80%CE%BB%CE%B1%CE%BD.png',
    price: null,
    sourceUrl: 'https://mamouthcomix.gr/?s=%CE%9B%CE%BF%CF%8D%CE%BA%CF%85%20%CE%9B%CE%BF%CF%85%CE%BA%2089',
  },
  {
    id: 9000206,
    series: '12 μήνες θητεία',
    number: '1',
    publisher: 'Μαμούθ Comix',
    storeDate: '2022-05-01',
    image: 'https://mamouthcomix.gr/wp-content/uploads/2018/04/12mines-01.jpg',
    price: '5.80',
    sourceUrl: 'https://mamouthcomix.gr/product/12-%ce%bc%ce%ae%ce%bd%ce%b5%cf%82-%ce%b8%ce%b7%cf%84%ce%b5%ce%af%ce%b1-01/',
  },
  {
    id: 9000207,
    series: '12 μήνες θητεία',
    number: '2',
    publisher: 'Μαμούθ Comix',
    storeDate: '2023-05-01',
    image: 'https://mamouthcomix.gr/wp-content/uploads/2018/04/12mines-02.jpg',
    price: '5.80',
    sourceUrl: 'https://mamouthcomix.gr/product/12-%ce%bc%ce%ae%ce%bd%ce%b5%cf%82-%ce%b8%ce%b7%cf%84%ce%b5%ce%af%ce%b1-02/',
  },
  {
    id: 9000208,
    series: '32 Δεκέμβρη',
    number: '1',
    publisher: 'Μαμούθ Comix',
    storeDate: '2020-01-01',
    image: 'https://mamouthcomix.gr/wp-content/uploads/2018/04/32dec.jpg',
    price: '14.50',
    sourceUrl: 'https://mamouthcomix.gr/product/32-%ce%b4%ce%b5%ce%ba%ce%ad%ce%bc%ce%b2%cf%81%ce%b7/',
  },
  {
    id: 9000209,
    series: 'ANIMAL’Z',
    number: '1',
    publisher: 'Μαμούθ Comix',
    storeDate: '2019-01-01',
    image: 'https://mamouthcomix.gr/wp-content/uploads/2018/04/animalz.jpg',
    price: '18.00',
    sourceUrl: 'https://mamouthcomix.gr/product/animalz/',
  },
  {
    id: 9000210,
    series: 'Άλφα',
    number: '1',
    publisher: 'Μαμούθ Comix',
    storeDate: '2018-01-01',
    image: 'https://mamouthcomix.gr/wp-content/uploads/2018/04/al-01.jpg',
    price: '4.80',
    sourceUrl: 'https://mamouthcomix.gr/product/%ce%b1%ce%bb%cf%86%ce%b1-01/',
  },
  {
    id: 9000211,
    series: 'Άλφα',
    number: '2',
    publisher: 'Μαμούθ Comix',
    storeDate: '2018-06-01',
    image: 'https://mamouthcomix.gr/wp-content/uploads/2018/04/al-02.jpg',
    price: '4.80',
    sourceUrl: 'https://mamouthcomix.gr/product/%ce%b1%ce%bb%cf%86%ce%b1-02/',
  },
  {
    id: 9000212,
    series: 'Αστερίξ',
    number: '1',
    publisher: 'Μαμούθ Comix',
    storeDate: '2018-02-01',
    image: 'https://mamouthcomix.gr/wp-content/uploads/2018/02/Asterix-01.jpg',
    price: '5.30',
    sourceUrl: 'https://mamouthcomix.gr/?s=%CE%91%CF%83%CF%84%CE%B5%CF%81%CE%AF%CE%BE%2001',
  },
  {
    id: 9000213,
    series: 'Αστερίξ',
    number: '2',
    publisher: 'Μαμούθ Comix',
    storeDate: '2018-02-01',
    image: 'https://mamouthcomix.gr/wp-content/uploads/2018/02/Asterix-02.jpg',
    price: '5.30',
    sourceUrl: 'https://mamouthcomix.gr/?s=%CE%91%CF%83%CF%84%CE%B5%CF%81%CE%AF%CE%BE%2002',
  },
  {
    id: 9000214,
    series: 'Αστερίξ',
    number: '3',
    publisher: 'Μαμούθ Comix',
    storeDate: '2018-02-01',
    image: 'https://mamouthcomix.gr/wp-content/uploads/2018/02/Asterix-03.jpg',
    price: '5.30',
    sourceUrl: 'https://mamouthcomix.gr/?s=%CE%91%CF%83%CF%84%CE%B5%CF%81%CE%AF%CE%BE%2003',
  },

  // ——— Μικρός Ήρως ———
  {
    id: 9000301,
    series: 'Undertaker',
    number: '2',
    publisher: 'Μικρός Ήρως',
    storeDate: '2026-07-01',
    image: 'https://www.mikrosiros.gr/image/catalog/undertaker-2-final-cover-mh.jpg',
    price: '5.94',
    sourceUrl: 'https://www.mikrosiros.gr/undertaker-02',
  },

  // ——— Κάκτος ———
  {
    id: 9000501,
    series: '1984',
    number: '1',
    publisher: 'Κάκτος',
    storeDate: null,
    image: 'https://www.kaktos.gr/wp-content/uploads/2023/03/005898.jpg',
    price: '9.54',
    sourceUrl: 'https://www.kaktos.gr/product/1984-2/',
  },
  {
    id: 9000502,
    series: 'Η Φάρμα των ζώων',
    number: '1',
    publisher: 'Κάκτος',
    storeDate: null,
    image: 'https://www.kaktos.gr/wp-content/uploads/2023/03/005896.jpg',
    price: '14.41',
    sourceUrl: 'https://www.kaktos.gr/product/i-farma-ton-zoon-2/',
  },

  // ——— Polaris ———
  {
    id: 9000901,
    series: 'Γυμνά Οστά',
    number: '1',
    publisher: 'Polaris',
    storeDate: null,
    image: 'https://www.polarisekdoseis.gr/wp-content/uploads/2021/06/GYMNA-OSTA_cover.jpg',
    price: null,
    sourceUrl: 'https://www.polarisekdoseis.gr/product/gymna-osta/',
  },
  {
    id: 9000902,
    series: 'Ο Ζητιάνος',
    number: '1',
    publisher: 'Polaris',
    storeDate: null,
    image: 'https://www.polarisekdoseis.gr/wp-content/uploads/2019/08/zitianos1.jpg',
    price: null,
    sourceUrl: 'https://www.polarisekdoseis.gr/product/o-zitianos/',
  },

  // ——— Διόπτρα ———
  {
    id: 9000801,
    series: 'Ζορμπάς – Πράσινη πέτρα ωραιοτάτη',
    number: '1',
    publisher: 'Διόπτρα',
    storeDate: null,
    image: 'https://www.dioptra.gr/mediastream/w640/files/products/4fbc18f264fb88adab47c5ac6c35007b.jpg.jpg',
    price: null,
    sourceUrl: 'https://www.dioptra.gr/vivlia/nikos-kazantzakis/zorbas-soloup',
  },
  {
    id: 9000802,
    series: 'Καπετάν Μιχάλης',
    number: '1',
    publisher: 'Διόπτρα',
    storeDate: null,
    image: 'https://www.dioptra.gr/mediastream/w640/files/products/90d42ee8f86f1f52adbbf025a3635864.jpg.jpg',
    price: null,
    sourceUrl: 'https://www.dioptra.gr/vivlia/nikos-kazantzakis/kapetan-mixalis-graphic-novel',
  },
];

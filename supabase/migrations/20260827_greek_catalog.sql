-- Historical Greek comics catalog (separate from market new-releases).
-- Public read; covers are official publisher/shop URLs only.

create table if not exists public.greek_series (
  id uuid primary key default gen_random_uuid(),
  catalog_key text not null unique,
  name text not null,
  publisher text not null,
  year_start integer,
  year_end integer,
  format text not null default 'περιοδικό'
    check (format in ('περιοδικό', 'τόμος')),
  aliases text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.greek_issues (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.greek_series(id) on delete cascade,
  catalog_key text not null unique,
  issue_number text not null,
  title text,
  year integer,
  cover_url text,
  source_url text,
  created_at timestamptz not null default now(),
  unique (series_id, issue_number)
);

create index if not exists greek_issues_series_id_idx on public.greek_issues (series_id);
create index if not exists greek_issues_number_idx on public.greek_issues (issue_number);
create index if not exists greek_series_aliases_idx on public.greek_series using gin (aliases);

alter table public.greek_series enable row level security;
alter table public.greek_issues enable row level security;

drop policy if exists greek_series_select_all on public.greek_series;
create policy greek_series_select_all
  on public.greek_series for select
  to anon, authenticated
  using (true);

drop policy if exists greek_issues_select_all on public.greek_issues;
create policy greek_issues_select_all
  on public.greek_issues for select
  to anon, authenticated
  using (true);

grant select on public.greek_series to anon, authenticated;
grant select on public.greek_issues to anon, authenticated;

insert into public.greek_series (catalog_key, name, publisher, year_start, year_end, format, aliases)
values
  ('blek', 'Μπλεκ', 'Μικρός Ήρως', 2018, null, 'περιοδικό',
    array['Μπλεκ', 'ΜΠΛΕΚ', 'Blek', 'Il Grande Blek', 'Ο Ξανθός Γίγας']),
  ('neos-blek', 'Νέος Μπλεκ', 'Μικρός Ήρως', 2014, null, 'περιοδικό',
    array['Νέος Μπλεκ', 'ΝΕΟΣ ΜΠΛΕΚ', 'Neos Blek']),
  ('syllektiko-blek', 'Συλλεκτικό Μπλεκ', 'Μικρός Ήρως', 1994, null, 'περιοδικό',
    array['Συλλεκτικό Μπλεκ', 'ΣΥΛΛΕΚΤΙΚΟ ΜΠΛΕΚ', 'Syllektiko Blek']),
  ('mickey', 'Μίκυ Μάους', 'Καθημερινή', 2014, null, 'περιοδικό',
    array['Μίκυ Μάους', 'ΜΙΚΥ ΜΑΟΥΣ', 'ΜΙΚΥ', 'Mickey Mouse', 'Μίκυ']),
  ('komix', 'ΚΟΜΙΞ', 'Καθημερινή', 2014, null, 'περιοδικό',
    array['ΚΟΜΙΞ', 'ΚΟΜΙΧ', 'Κόμιξ', 'Komix', 'COMIX']),
  ('almanako', 'Αλμανάκο', 'Τερζόπουλος / Νέα Ακτίνα', 1990, 2012, 'περιοδικό',
    array['Αλμανάκο', 'ΑΛΜΑΝΑΚΟ', 'Almanako', 'Σούπερ Αλμανάκο', 'Αλμανάκο Φάντομ Ντακ']),
  ('popeye', 'Ποπάυ', 'Μικρός Ήρως', 2022, null, 'τόμος',
    array['Ποπάυ', 'ΠΟΠΑΥ', 'Popeye', 'Κλασικές Ιστορίες Popeye'])
on conflict (catalog_key) do update set
  name = excluded.name,
  publisher = excluded.publisher,
  year_start = excluded.year_start,
  year_end = excluded.year_end,
  format = excluded.format,
  aliases = excluded.aliases;

insert into public.greek_issues (series_id, catalog_key, issue_number, title, year, cover_url, source_url)
select s.id, v.catalog_key, v.issue_number, v.title, v.year, v.cover_url, v.source_url
from public.greek_series s
join (values
  ('blek', 'blek-1', '1', 'Μπλεκ #1', 2018,
    'https://www.mikrosiros.gr/image/catalog/mikros-iros_mplek001.jpg',
    'https://www.mikrosiros.gr/mplek-no1'),
  ('blek', 'blek-2', '2', 'Μπλεκ #2', null,
    'https://www.mikrosiros.gr/image/catalog/mikros-iros_mplek002.jpg',
    'https://www.mikrosiros.gr/mplek-no-2'),
  ('blek', 'blek-3', '3', 'Μπλεκ #3', null,
    'https://www.mikrosiros.gr/image/catalog/mikros-iros_mplek003.jpg',
    'https://www.mikrosiros.gr/mplek-no-3'),
  ('blek', 'blek-4', '4', 'Μπλεκ #4', null,
    'https://www.mikrosiros.gr/image/catalog/mikros-iros_mplek004.jpg',
    'https://www.mikrosiros.gr/mplek-no-4'),
  ('blek', 'blek-5', '5', 'Μπλεκ #5', null,
    'https://www.mikrosiros.gr/image/catalog/mikros-iros_mplek005.jpg',
    'https://www.mikrosiros.gr/mplek-no-5'),
  ('blek', 'blek-6', '6', 'Μπλεκ #6', null,
    'https://www.mikrosiros.gr/image/catalog/mikros-iros_mplek006.jpg',
    'https://www.mikrosiros.gr/mplek-no-6'),
  ('blek', 'blek-7', '7', 'Μπλεκ #7', 2019,
    'https://www.mikrosiros.gr/image/catalog/mikros-iros_mplek007.jpg',
    'https://www.mikrosiros.gr/mplek-no-7'),
  ('blek', 'blek-8', '8', 'Μπλεκ #8', 2020,
    'https://www.mikrosiros.gr/image/catalog/mikros-iros_mplek008.jpg',
    'https://www.mikrosiros.gr/mplek-no-8'),
  ('blek', 'blek-9', '9', 'Μπλεκ #9', 2020,
    'https://www.mikrosiros.gr/image/catalog/mikros-iros_mplek009.jpg',
    'https://www.mikrosiros.gr/mplek-no-9'),
  ('blek', 'blek-10', '10', 'Μπλεκ #10', null,
    'https://www.mikrosiros.gr/image/catalog/mikros-iros_mplek010.jpg',
    'https://www.mikrosiros.gr/mplek-no-10'),
  ('blek', 'blek-11', '11', 'Μπλεκ #11', null,
    'https://www.mikrosiros.gr/image/catalog/mikros-iros_mplek011.jpg',
    'https://www.mikrosiros.gr/mplek-no-11'),
  ('blek', 'blek-12', '12', 'Μπλεκ #12', null,
    'https://www.mikrosiros.gr/image/catalog/mikros-iros_mplek012.jpg',
    'https://www.mikrosiros.gr/mplek-no-12'),
  ('neos-blek', 'neos-blek-53', '53', 'Νέος Μπλεκ #53', 2018,
    'https://www.mikrosiros.gr/image/catalog/mikros-iros_neos_mplek053.jpg',
    'https://www.mikrosiros.gr/neos-mplek-no-53'),
  ('syllektiko-blek', 'syllektiko-blek-33', '33', 'Συλλεκτικό Μπλεκ #33 — Η Γκρέτα εκδικείται', null,
    'https://www.mikrosiros.gr/image/catalog/mikros-iros_syl_mplek033.jpg',
    'https://www.mikrosiros.gr/no-33-h-greta-ekdikeitai'),
  ('mickey', 'mickey-537', '537', 'Ο καλύτερος βοηθός', 2024,
    'https://www.kathimerini.gr/wp-content/uploads/2024/08/swm-MM537_1920x1080-1200x630.jpg',
    'https://www.kathimerini.gr/k/disney/563189950/miky-maoys-537-o-kalyteros-voithos/'),
  ('mickey', 'mickey-633', '633', 'Αποστολή στους τροπικούς', 2026,
    'https://www.kathimerini.gr/wp-content/uploads/2026/06/swm-MM633_1920x1080-1200x630.jpg',
    'https://www.kathimerini.gr/k/disney/564316075/miky-maoys-633-apostoli-stoys-tropikoys/'),
  ('mickey', 'mickey-634', '634', 'Τα δύο χωριά', 2026,
    'https://www.kathimerini.gr/wp-content/uploads/2026/08/swm-MM634_1920x1080-1200x630.jpg',
    'https://www.kathimerini.gr/k/disney/564387673/miky-maoys-634-ta-dyo-choria/'),
  ('mickey', 'mickey-635', '635', 'Η πηγή της νιότης', 2026,
    'https://www.kathimerini.gr/wp-content/uploads/2026/08/swm-MM635_1920x1080-1200x630.jpg',
    'https://www.kathimerini.gr/k/disney/564395935/miky-maoys-635-i-pigi-tis-niotis/'),
  ('komix', 'komix-145', '145', 'Ο φαραώ Ντακταγχαμών', 2026,
    'https://www.kathimerini.gr/wp-content/uploads/2026/06/swm-Cx145_1920x1080-1200x630.jpg',
    'https://www.kathimerini.gr/k/disney/564316063/komix-145-o-farao-ntaktagchamon/'),
  ('komix', 'komix-146', '146', 'Ο γάμος του Σκρουτζ Μακ Ντακ', 2026,
    'https://www.kathimerini.gr/wp-content/uploads/2026/08/swm-Cx146_1920x1080-1200x630.jpg',
    'https://www.kathimerini.gr/k/disney/564405661/komix-146-o-gamos-toy-skroytz-mak-ntak/'),
  ('almanako', 'almanako-1', '1', 'Αλμανάκο #1', 1990, null, null),
  ('almanako', 'almanako-257', '257', 'Αλμανάκο #257', 2012, null, null),
  ('popeye', 'popeye-1', '1', 'Κλασικές Ιστορίες Popeye #1 — Το μωβ μαργαριτάρι', 2022,
    'https://www.mikrosiros.gr/image/catalog/popeye-classic-01-mh.jpg',
    'https://www.mikrosiros.gr/klasikes-istories-popeye-01'),
  ('popeye', 'popeye-5', '5', 'Κλασικές Ιστορίες Popeye #5 — Ηλεκτρονικές μπαφλιάρες', 2025,
    'https://www.mikrosiros.gr/image/catalog/popeye-5-cover-mikros-iros.jpg',
    'https://www.mikrosiros.gr/klasikes-istories-popeye-5'),
  ('popeye', 'popeye-7', '7', 'Κλασικές Ιστορίες Popeye #7 — Ο βασιλιάς φάντασμα', 2026,
    'https://www.mikrosiros.gr/image/catalog/popeyeclassics7-mh.jpg',
    'https://www.mikrosiros.gr/klasikes-istories-popeye-7'),
  ('popeye', 'popeye-thiasos', 'Θίασος', 'Ποπάυ — Ο Θίασος', 2026,
    'https://www.mikrosiros.gr/image/catalog/popeye-o-thiasos-cover.jpg',
    'https://www.mikrosiros.gr/popeye-o-thiasos')
) as v(series_key, catalog_key, issue_number, title, year, cover_url, source_url)
  on s.catalog_key = v.series_key
on conflict (catalog_key) do update set
  issue_number = excluded.issue_number,
  title = excluded.title,
  year = excluded.year,
  cover_url = excluded.cover_url,
  source_url = excluded.source_url;

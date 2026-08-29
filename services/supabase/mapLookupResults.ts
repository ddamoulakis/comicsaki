import type { EditionKind, CoverEdition, CoverMatch } from '@/types/coverLookup';
import type { SupabaseLookupRow } from '@/types/supabase';

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function inferEditionKind(row: SupabaseLookupRow): EditionKind {
  const label = `${row.edition_type ?? ''} ${row.edition_label ?? ''}`.toLowerCase();
  if (label.includes('facsimile')) return 'facsimile';
  if (label.includes('2nd') || label.includes('2η') || label.includes('second')) return '2nd_print';
  if (label.includes('variant')) return 'variant';
  if (row.is_special_edition) return 'special';
  if (row.is_reprint || label.includes('reprint') || label.includes('επανέκδοση')) return 'reprint';
  if (label.includes('1st') || label.includes('1η') || label.includes('first')) return '1st_print';
  return 'unknown';
}

function editionLabel(row: SupabaseLookupRow): string {
  if (row.edition_label) return row.edition_label;
  const kind = inferEditionKind(row);
  if (kind === '1st_print') return '1η εκτύπωση';
  if (kind === '2nd_print') return '2η εκτύπωση';
  if (kind === 'reprint') return 'Reprint';
  if (kind === 'facsimile') return 'Facsimile';
  if (kind === 'variant') return 'Variant cover';
  if (kind === 'special') return 'Special edition';
  if (row.is_reprint) return 'Reprint';
  if (row.is_special_edition) return 'Special edition';
  return 'Έκδοση';
}

function rowToEdition(row: SupabaseLookupRow, index: number): CoverEdition {
  const kind = inferEditionKind(row);
  return {
    id: row.issue_id ?? `edition-${index}-${slug(row.source_name ?? 'src')}`,
    issueId: row.issue_id ?? undefined,
    kind,
    label: editionLabel(row),
    year: row.release_year != null ? String(row.release_year) : undefined,
    publisher: row.publisher ?? undefined,
    notes: row.notes ?? undefined,
    confidence: row.confidence_score ?? 0.5,
    sourceName: row.source_name ?? 'Catalog',
    sourceUrl: row.source_url ?? undefined,
  };
}

function matchKey(row: SupabaseLookupRow): string {
  const series = row.series ?? row.series_title ?? row.title ?? 'unknown';
  const issue = row.issue_number ?? '-';
  return `${series}::${issue}`.toLowerCase();
}

export function mapLookupRowsToCoverMatches(rows: SupabaseLookupRow[]): CoverMatch[] {
  const grouped = new Map<string, SupabaseLookupRow[]>();

  for (const row of rows) {
    const key = matchKey(row);
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }

  return [...grouped.entries()].map(([key, groupRows]) => {
    const sorted = [...groupRows].sort(
      (a, b) => (b.confidence_score ?? 0) - (a.confidence_score ?? 0),
    );
    const primary = sorted[0];
    const series = primary.series ?? primary.series_title ?? primary.title ?? 'Άγνωστη σειρά';
    const issue = primary.issue_number ?? '-';
    const title = primary.title ?? series;
    const editions = sorted.map((row, index) => rowToEdition(row, index));

    return {
      id: primary.issue_id ?? `match-${slug(key)}`,
      issueId: primary.issue_id ?? undefined,
      series,
      issue,
      title,
      publisher: primary.publisher ?? '—',
      category: primary.category ?? undefined,
      coverUrl: primary.cover_url ?? undefined,
      confidence: primary.confidence_score ?? 0.5,
      sourceName: primary.source_name ?? 'Catalog',
      sourceUrl: primary.source_url ?? undefined,
      editions,
    };
  });
}

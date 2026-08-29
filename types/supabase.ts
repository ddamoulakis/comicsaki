export type LookupQueryType = 'text' | 'isbn' | 'barcode' | 'image';

export type SupabaseLookupRow = {
  issue_id?: string | null;
  title?: string | null;
  series?: string | null;
  series_title?: string | null;
  issue_number?: string | null;
  publisher?: string | null;
  isbn?: string | null;
  barcode?: string | null;
  cover_url?: string | null;
  confidence_score?: number | null;
  source_name?: string | null;
  source_url?: string | null;
  edition_label?: string | null;
  edition_type?: string | null;
  is_reprint?: boolean | null;
  is_special_edition?: boolean | null;
  release_year?: string | number | null;
  category?: string | null;
  notes?: string | null;
};

export type LookupCoverResponse = {
  results?: SupabaseLookupRow[];
};

export type UnifiedIssueSearchRow = {
  issue_id: string;
  issue_number: string;
  issue_title?: string | null;
  series_title?: string | null;
  publisher_name?: string | null;
  category?: string | null;
  barcode?: string | null;
  isbn?: string | null;
  is_reprint?: boolean | null;
  is_special_edition?: boolean | null;
  cover_url?: string | null;
};

export type CollectionItemRow = {
  id: string;
  quantity: number;
  condition_grade: string | null;
  notes: string | null;
  is_read?: boolean | null;
  is_wishlist?: boolean | null;
  is_favorite?: boolean | null;
  issue: {
    id: string;
    issue_number: string;
    title: string | null;
    cover_url?: string | null;
    series: {
      title: string;
      category: string | null;
      publisher: { name: string } | null;
    } | null;
  } | null;
};

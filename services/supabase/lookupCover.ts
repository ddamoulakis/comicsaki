import { requireSupabase } from '@/lib/supabase';
import { mapLookupRowsToCoverMatches } from '@/services/supabase/mapLookupResults';
import type { CoverLookupResult } from '@/types/coverLookup';
import type { LookupQueryType, LookupCoverResponse } from '@/types/supabase';

function detectQueryType(query: string): LookupQueryType {
  const digits = query.replace(/\D/g, '');
  if (/^\d{10,14}$/.test(digits)) return 'isbn';
  if (/^\d{8,14}$/.test(query.trim())) return 'barcode';
  return 'text';
}

async function invokeLookupCover(body: Record<string, unknown>) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.functions.invoke<LookupCoverResponse>('lookup-cover', {
    body,
  });

  if (error) throw error;
  return data?.results ?? [];
}

export async function lookupCoverFromQuery(
  query: string,
  photoUri = '',
): Promise<CoverLookupResult> {
  const trimmed = query.trim();
  const queryType = detectQueryType(trimmed);
  const rows = await invokeLookupCover({ query_type: queryType, query: trimmed });

  return {
    photoUri,
    queryHint: trimmed,
    matches: mapLookupRowsToCoverMatches(rows),
    usedDemo: false,
  };
}

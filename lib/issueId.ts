const SUPABASE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Supabase `issues.id` — not Metron, Gemini, or bundled Greek catalog keys. */
export function isSupabaseIssueId(id: string | undefined | null): id is string {
  return !!id && SUPABASE_UUID_RE.test(id.trim());
}

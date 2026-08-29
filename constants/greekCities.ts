/** Major Greek cities / towns for profile city autocomplete. */
export const GREEK_CITIES = [
  'Αθήνα',
  'Θεσσαλονίκη',
  'Πάτρα',
  'Πειραιάς',
  'Ηράκλειο',
  'Λάρισα',
  'Βόλος',
  'Ιωάννινα',
  'Χανιά',
  'Καλαμάτα',
  'Ρόδος',
  'Κέρκυρα',
  'Καβάλα',
  'Σέρρες',
  'Αλεξανδρούπολη',
  'Κατερίνη',
  'Τρίκαλα',
  'Λαμία',
  'Κομοτηνή',
  'Χαλκίδα',
  'Αγρίνιο',
  'Κοζάνη',
  'Καρδίτσα',
  'Βέροια',
  'Δράμα',
  'Ξάνθη',
  'Μυτιλήνη',
  'Τρίπολη',
  'Κόρινθος',
  'Γιάννενα',
  'Ρέθυμνο',
  'Άργος',
  'Πύργος',
  'Έδεσσα',
  'Φλώρινα',
  'Καστοριά',
  'Ναύπλιο',
  'Σπάρτη',
  'Λιβαδειά',
  'Άμφισσα',
  'Πρέβεζα',
  'Άρτα',
  'Ιεράπετρα',
  'Άγιος Νικόλαος',
  'Κως',
  'Μύκονος',
  'Σαντορίνη',
  'Ζάκυνθος',
  'Λευκάδα',
  'Κεφαλονιά',
  'Περιστέρι',
  'Καλλιθέα',
  'Νίκαια',
  'Γλυφάδα',
  'Αχαρνές',
  'Καλαμαριά',
  'Μαρούσι',
  'Χαλάνδρι',
  'Νέα Σμύρνη',
  'Ζωγράφου',
  'Ιλιον',
  'Ηλιούπολη',
  'Κηφισιά',
  'Πτολεμαΐδα',
  'Ορεστιάδα',
  'Γιαννιτσά',
  'Νάουσα',
  'Κιλκίς',
] as const;

function normalizeGreek(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('el')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ς/g, 'σ');
}

/** Ranked suggestions for a typed city query (prefix first, then contains). */
export function suggestGreekCities(query: string, limit = 8): string[] {
  const q = normalizeGreek(query);
  if (q.length < 1) return [];

  const scored: { name: string; score: number }[] = [];
  for (const name of GREEK_CITIES) {
    const n = normalizeGreek(name);
    if (n === q) continue;
    if (n.startsWith(q)) scored.push({ name, score: 0 });
    else if (n.includes(q)) scored.push({ name, score: 1 });
  }

  scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name, 'el'));
  return scored.slice(0, limit).map((s) => s.name);
}

/** If query uniquely matches one city (or exact), return the canonical name. */
export function resolveGreekCity(query: string): string | null {
  const q = normalizeGreek(query);
  if (!q) return null;

  const exact = GREEK_CITIES.find((name) => normalizeGreek(name) === q);
  if (exact) return exact;

  const suggestions = suggestGreekCities(query, 2);
  if (suggestions.length === 1 && normalizeGreek(suggestions[0]).startsWith(q) && q.length >= 3) {
    return suggestions[0];
  }
  return null;
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'comicsaki.savedListingSearches.v1';

export type SavedListingSearch = {
  id: string;
  query: string;
  mineOnly: boolean;
  savedAt: string;
};

export function normalizeSearchQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ');
}

async function readAll(): Promise<SavedListingSearch[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedListingSearch[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(items: SavedListingSearch[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function fetchSavedListingSearches(): Promise<SavedListingSearch[]> {
  const items = await readAll();
  return items.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function isListingSearchSaved(query: string, mineOnly: boolean): Promise<boolean> {
  const q = normalizeSearchQuery(query).toLowerCase();
  if (!q) return false;
  const items = await readAll();
  return items.some((item) => item.query.toLowerCase() === q && item.mineOnly === mineOnly);
}

export async function saveListingSearch(input: {
  query: string;
  mineOnly: boolean;
}): Promise<{ item: SavedListingSearch; created: boolean }> {
  const query = normalizeSearchQuery(input.query);
  if (!query) throw new Error('Γράψε όρο αναζήτησης για αποθήκευση.');

  const items = await readAll();
  const existing = items.find(
    (item) => item.query.toLowerCase() === query.toLowerCase() && item.mineOnly === input.mineOnly,
  );
  if (existing) return { item: existing, created: false };

  const next: SavedListingSearch = {
    id: `${Date.now()}`,
    query,
    mineOnly: input.mineOnly,
    savedAt: new Date().toISOString(),
  };
  await writeAll([next, ...items].slice(0, 40));
  return { item: next, created: true };
}

export async function removeSavedListingSearch(id: string): Promise<void> {
  const items = await readAll();
  await writeAll(items.filter((item) => item.id !== id));
}

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'comicsaki.listingFavorites.v1';

export type ListingFavorite = {
  id: string;
  title: string;
  coverUrl: string | null;
  price: number | null;
  condition: string;
  savedAt: string;
};

async function readAll(): Promise<ListingFavorite[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ListingFavorite[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(items: ListingFavorite[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export async function fetchListingFavorites(): Promise<ListingFavorite[]> {
  const items = await readAll();
  return items.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function fetchListingFavoriteIds(): Promise<Set<string>> {
  const items = await readAll();
  return new Set(items.map((item) => item.id));
}

export async function isListingFavorite(id: string): Promise<boolean> {
  const items = await readAll();
  return items.some((item) => item.id === id);
}

export async function toggleListingFavorite(input: {
  id: string;
  title: string;
  coverUrl: string | null;
  price: number | null;
  condition: string;
}): Promise<{ isFavorite: boolean }> {
  const items = await readAll();
  const index = items.findIndex((item) => item.id === input.id);

  if (index >= 0) {
    items.splice(index, 1);
    await writeAll(items);
    return { isFavorite: false };
  }

  const next: ListingFavorite = {
    id: input.id,
    title: input.title,
    coverUrl: input.coverUrl,
    price: input.price,
    condition: input.condition,
    savedAt: new Date().toISOString(),
  };
  await writeAll([next, ...items]);
  return { isFavorite: true };
}

export async function removeListingFavorite(id: string): Promise<ListingFavorite[]> {
  const items = (await readAll()).filter((item) => item.id !== id);
  await writeAll(items);
  return items;
}

import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '@/contexts/AuthProvider';
import { isSupabaseConfigured } from '@/lib/env';
import { fetchUserCollection, enrichMissingOfficialCovers } from '@/services/supabase/collection';
import type { CollectionItem } from '@/types/collection';

export function useCollectionData() {
  const { user } = useAuth();
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<'empty' | 'cloud'>('empty');
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) {
      setItems([]);
      setSource('empty');
      setLoading(false);
      return;
    }

    if (itemsRef.current.length === 0) setLoading(true);
    try {
      const data = await fetchUserCollection({ enrichCovers: false });
      setItems(data);
      setSource('cloud');
      void enrichMissingOfficialCovers(data, (next) => {
        setItems((prev) => {
          const covers = new Map(next.map((i) => [i.id, i.coverUrl]));
          return prev.map((item) => {
            const cover = covers.get(item.id);
            return cover && cover !== item.coverUrl ? { ...item, coverUrl: cover } : item;
          });
        });
      });
    } catch {
      setSource('empty');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { items, loading, source, reload, count: items.length, latest: items[0] ?? null };
}

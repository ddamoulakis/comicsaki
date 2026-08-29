import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/contexts/AuthProvider';
import { isSupabaseConfigured } from '@/lib/env';
import { fetchIncomingMessageCount } from '@/services/supabase/listings';

function inboxSeenKey(userId: string) {
  return `comicsaki:inbox-seen:${userId}`;
}

export function formatInboxBadge(count: number): string | undefined {
  if (count <= 0) return undefined;
  if (count > 99) return '99+';
  return String(count);
}

type InboxBadgeContextValue = {
  count: number;
  badge: string | undefined;
  refresh: () => Promise<void>;
  markSeen: () => Promise<void>;
};

const InboxBadgeContext = createContext<InboxBadgeContextValue | null>(null);

export function InboxBadgeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured() || !user) {
      setCount(0);
      return;
    }
    try {
      const lastSeen = await AsyncStorage.getItem(inboxSeenKey(user.id));
      const next = await fetchIncomingMessageCount(lastSeen);
      setCount(next);
    } catch {
      // Keep the last known count if the inbox query fails.
    }
  }, [user]);

  const markSeen = useCallback(async () => {
    if (!user) return;
    await AsyncStorage.setItem(inboxSeenKey(user.id), new Date().toISOString());
    setCount(0);
  }, [user]);

  useEffect(() => {
    void refresh();
    if (!user) return undefined;
    const interval = setInterval(() => {
      void refresh();
    }, 30000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [refresh, user]);

  const value = useMemo<InboxBadgeContextValue>(
    () => ({
      count,
      badge: formatInboxBadge(count),
      refresh,
      markSeen,
    }),
    [count, refresh, markSeen],
  );

  return <InboxBadgeContext.Provider value={value}>{children}</InboxBadgeContext.Provider>;
}

export function useInboxBadge() {
  const ctx = useContext(InboxBadgeContext);
  if (!ctx) throw new Error('useInboxBadge must be used within InboxBadgeProvider');
  return ctx;
}

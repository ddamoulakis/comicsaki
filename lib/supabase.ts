import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { env, isSupabaseConfigured } from '@/lib/env';

declare global {
  // eslint-disable-next-line no-var
  var __comicsakiSupabase: SupabaseClient | undefined;
}

function canInitClient() {
  if (!isSupabaseConfigured()) return false;
  if (Platform.OS === 'web' && typeof window === 'undefined') return false;
  return true;
}

function createSupabaseClient() {
  const isWeb = Platform.OS === 'web';
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      ...(isWeb ? {} : { storage: AsyncStorage }),
      autoRefreshToken: true,
      persistSession: true,
      // PKCE code is exchanged once on /auth/callback — don't consume it at client init.
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
}

/** Lazy client — safe for web SSR / static export. */
export function getSupabase(): SupabaseClient | null {
  if (!canInitClient()) return null;
  if (globalThis.__comicsakiSupabase) return globalThis.__comicsakiSupabase;
  const created = createSupabaseClient();
  globalThis.__comicsakiSupabase = created;
  return created;
}

export function requireSupabase(): SupabaseClient {
  const sb = getSupabase();
  if (!sb) {
    throw new Error(
      'Το Supabase δεν είναι ρυθμισμένο. Βάλε EXPO_PUBLIC_SUPABASE_URL και EXPO_PUBLIC_SUPABASE_ANON_KEY στο .env',
    );
  }
  return sb;
}

function isNewSupabaseApiKey(key: string): boolean {
  return key.startsWith('sb_publishable_') || key.startsWith('sb_secret_');
}

/**
 * Headers for Edge Function calls. New `sb_publishable_` keys are not JWTs —
 * they go in `apikey` only. Authorization is the user session JWT when present,
 * or the legacy JWT anon key as Bearer fallback.
 */
export async function supabaseFunctionHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  if (env.supabaseAnonKey) headers.apikey = env.supabaseAnonKey;

  const sb = getSupabase();
  const accessToken = sb ? (await sb.auth.getSession()).data.session?.access_token : null;
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (env.supabaseAnonKey && !isNewSupabaseApiKey(env.supabaseAnonKey)) {
    headers.Authorization = `Bearer ${env.supabaseAnonKey}`;
  }
  return headers;
}

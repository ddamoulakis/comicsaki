import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Platform } from 'react-native';

import { isSupabaseConfigured } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';
import {
  createSessionFromUrl,
  sendPasswordResetEmail,
  signInWithApple,
  signInWithOAuthProvider,
} from '@/services/supabase/auth';

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithFacebook: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      queueMicrotask(() => {
        setSession(nextSession);
        setLoading(false);
      });
    });

    // Web OAuth codes are handled only by /auth/callback so PKCE isn't consumed twice.
    if (Platform.OS !== 'web') {
      Linking.getInitialURL().then((url) => {
        if (!url) return;
        createSessionFromUrl(url).catch(() => undefined);
      });
    }

    const listener = Linking.addEventListener('url', ({ url }) => {
      if (Platform.OS === 'web') return;
      createSessionFromUrl(url).catch(() => undefined);
    });

    return () => {
      subscription.subscription.unsubscribe();
      listener.remove();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    await signInWithOAuthProvider('google');
  }, []);

  const signInWithFacebook = useCallback(async () => {
    await signInWithOAuthProvider('facebook');
  }, []);

  const signInWithAppleAction = useCallback(async () => {
    await signInWithApple();
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await sendPasswordResetEmail(email);
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    setSession(null);
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      await supabase.auth.signOut({ scope: 'global' }).catch(() => undefined);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: isSupabaseConfigured(),
      loading,
      session,
      user: session?.user ?? null,
      signIn,
      signUp,
      signInWithGoogle,
      signInWithFacebook,
      signInWithApple: signInWithAppleAction,
      sendPasswordReset,
      signOut,
    }),
    [loading, session, signIn, signUp, signInWithGoogle, signInWithFacebook, signInWithAppleAction, sendPasswordReset, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

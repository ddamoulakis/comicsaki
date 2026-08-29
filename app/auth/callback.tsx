import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { theme } from '@/constants/Theme';
import { getSupabase } from '@/lib/supabase';
import { createSessionFromUrl } from '@/services/supabase/auth';

const oauthReturnUrl = typeof window !== 'undefined' ? window.location.href : '';

WebBrowser.maybeCompleteAuthSession();

export default function AuthCallbackScreen() {
  const router = useRouter();
  const [status, setStatus] = useState('Σύνδεση…');

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      const popupResult = WebBrowser.maybeCompleteAuthSession();
      if (popupResult.type === 'success') {
        return;
      }

      const goProfile = (authError?: string) => {
        if (cancelled) return;
        if (authError) {
          router.replace({ pathname: '/(tabs)/profile', params: { authError } });
          return;
        }
        // After OAuth signup/sign-in, open profile setup (name, photo, city).
        router.replace({ pathname: '/(tabs)/profile', params: { setup: '1' } });
      };

      try {
        const supabase = getSupabase();
        if (supabase) {
          const existing = await supabase.auth.getSession();
          if (existing.data.session) {
            goProfile();
            return;
          }
        }

        const session = oauthReturnUrl ? await createSessionFromUrl(oauthReturnUrl) : null;
        if (!session) {
          throw new Error('Η σύνδεση δεν ολοκληρώθηκε. Δοκίμασε ξανά.');
        }
        goProfile();
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Αποτυχία σύνδεσης.';
        if (!cancelled) setStatus(msg);
        await new Promise((resolve) => setTimeout(resolve, 900));
        goProfile(msg);
      }
    }

    handleCallback();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.kirbyMagenta} />
      <Text style={styles.text}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
    gap: 16,
    paddingHorizontal: 24,
  },
  text: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.text,
    textAlign: 'center',
  },
});

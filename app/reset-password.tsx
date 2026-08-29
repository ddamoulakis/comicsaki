import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { KirbyScreen } from '@/components/comicsaki/KirbyScreen';
import { KirbyText } from '@/components/comicsaki/KirbyText';
import { theme } from '@/constants/Theme';
import { useAuth } from '@/contexts/AuthProvider';
import { getSupabase } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { configured, session } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleReset = async () => {
    if (!password.trim()) {
      setMessage('Γράψε νέο κωδικό.');
      return;
    }

    if (password !== confirmPassword) {
      setMessage('Οι δύο κωδικοί δεν ταιριάζουν.');
      return;
    }

    const supabase = getSupabase();
    if (!configured || !supabase || !session) {
      setMessage('Άνοιξε πρώτα το link από το email επαναφοράς.');
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setMessage('Ο κωδικός άλλαξε. Μπορείς τώρα να συνδεθείς.');
      setTimeout(() => router.replace('/(tabs)/profile'), 900);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Αποτυχία αλλαγής κωδικού.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KirbyScreen showDecor={false} style={styles.container}>
      <View style={styles.panel}>
        <Text style={styles.title}>ΝΕΟΣ ΚΩΔΙΚΟΣ</Text>
        <KirbyText variant="body" color={theme.textMuted} style={styles.subtitle}>
          Άνοιξε πρώτα το link από το email και μετά βάλε τον νέο κωδικό σου εδώ.
        </KirbyText>

        <TextInput
          style={styles.input}
          placeholder="Νέος κωδικός"
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Επανάληψη νέου κωδικού"
          placeholderTextColor={theme.textMuted}
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <Pressable style={styles.primaryBtn} disabled={busy} onPress={handleReset}>
          <Text style={styles.primaryBtnText}>Αλλαγή κωδικού</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} disabled={busy} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Πίσω</Text>
        </Pressable>

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </KirbyScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  panel: {
    width: '100%',
    maxWidth: 360,
    gap: 14,
    backgroundColor: theme.surface,
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
    padding: 24,
    shadowColor: theme.border,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.text,
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
  },
  input: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.background,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  primaryBtn: {
    backgroundColor: theme.kirbyMagenta,
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
    paddingVertical: 11,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: theme.surface,
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryBtn: {
    backgroundColor: theme.surface,
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '800',
  },
  message: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.kirbyBlue,
    textAlign: 'center',
  },
});

import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Mode = 'join' | 'signin';

type JoinAuthScreenProps = {
  configured: boolean;
  loading: boolean;
  busy: boolean;
  message: string | null;
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onClose: () => void;
  onGoogle: () => void;
  onApple: () => void;
  onFacebook: () => void;
  onEmailSignIn: () => void;
  onEmailSignUp: () => void;
  onForgotPassword: () => void;
};

function GoogleMark() {
  return (
    <View style={styles.googleMark}>
      <Text style={styles.googleG}>G</Text>
    </View>
  );
}

function PillButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: ReactNode;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.pill, pressed && styles.pillPressed, disabled && styles.pillDisabled]}
      disabled={disabled}
      onPress={onPress}>
      <View style={styles.pillIcon}>{icon}</View>
      <Text style={styles.pillLabel}>{label}</Text>
    </Pressable>
  );
}

export function JoinAuthScreen({
  configured,
  loading,
  busy,
  message,
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onClose,
  onGoogle,
  onApple,
  onFacebook,
  onEmailSignIn,
  onEmailSignUp,
  onForgotPassword,
}: JoinAuthScreenProps) {
  const [mode, setMode] = useState<Mode>('signin');
  const [emailOpen, setEmailOpen] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const joining = mode === 'join';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
        <Ionicons name="close" size={22} color="#6B6B6B" />
      </Pressable>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{joining ? 'Γίνε μέλος στο Comicsάκι.' : 'Καλώς ήρθες πίσω.'}</Text>

        {!configured ? (
          <Text style={styles.hint}>Το Supabase δεν είναι ρυθμισμένο. Βάλε τα keys στο .env</Text>
        ) : loading ? (
          <ActivityIndicator color="#000" style={{ marginTop: 24 }} />
        ) : (
          <View style={styles.actions}>
            <PillButton
              disabled={busy}
              onPress={onGoogle}
              icon={<GoogleMark />}
              label={joining ? 'Εγγραφή με Google' : 'Σύνδεση με Google'}
            />
            <PillButton
              disabled={busy}
              onPress={onApple}
              icon={<Ionicons name="logo-apple" size={22} color="#111" />}
              label={joining ? 'Εγγραφή με Apple' : 'Σύνδεση με Apple'}
            />
            <PillButton
              disabled={busy}
              onPress={onFacebook}
              icon={<Ionicons name="logo-facebook" size={22} color="#1877F2" />}
              label={joining ? 'Εγγραφή με Facebook' : 'Σύνδεση με Facebook'}
            />
            <PillButton
              disabled={busy}
              onPress={() => setEmailOpen((open) => !open)}
              icon={<Ionicons name="mail-outline" size={20} color="#111" />}
              label={joining ? 'Εγγραφή με email' : 'Σύνδεση με email'}
            />

            {emailOpen ? (
              <View style={styles.emailForm}>
                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  placeholderTextColor="#8A8A8A"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={onEmailChange}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Κωδικός"
                  placeholderTextColor="#8A8A8A"
                  secureTextEntry
                  value={password}
                  onChangeText={onPasswordChange}
                />
                {!joining ? (
                  <Pressable disabled={busy} onPress={onForgotPassword}>
                    <Text style={styles.forgot}>Ξέχασες τον κωδικό;</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[styles.continueBtn, busy && styles.pillDisabled]}
                  disabled={busy}
                  onPress={joining ? onEmailSignUp : onEmailSignIn}>
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.continueText}>{joining ? 'Εγγραφή' : 'Σύνδεση'}</Text>
                  )}
                </Pressable>
              </View>
            ) : null}

            {message ? <Text style={styles.message}>{message}</Text> : null}

            <Pressable style={styles.rememberRow} onPress={() => setRememberMe((v) => !v)}>
              <View style={[styles.checkbox, rememberMe && styles.checkboxOn]}>
                {rememberMe ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
              </View>
              <Text style={styles.rememberText}>Να με θυμάσαι για πιο γρήγορη σύνδεση</Text>
            </Pressable>

            {joining ? (
              <Text style={styles.switchText}>
                Έχεις ήδη λογαριασμό;{' '}
                <Text
                  style={styles.switchLink}
                  onPress={() => {
                    setMode('signin');
                    setEmailOpen(false);
                  }}>
                  Σύνδεση
                </Text>
              </Text>
            ) : (
              <Text style={styles.switchText}>
                Δεν έχεις λογαριασμό;{' '}
                <Text
                  style={styles.switchLink}
                  onPress={() => {
                    setMode('join');
                    setEmailOpen(false);
                  }}>
                  Εγγραφή
                </Text>
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      <Text style={styles.legal}>
        Πατώντας «Εγγραφή», αποδέχεσαι τους Όρους Χρήσης και την Πολιτική Απορρήτου του Comicsάκι.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 18 : 8,
    right: 18,
    zIndex: 2,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 72,
  },
  title: {
    fontFamily: Platform.OS === 'web' ? 'Georgia, "Times New Roman", serif' : 'serif',
    fontSize: 32,
    color: '#111',
    textAlign: 'center',
    marginBottom: 36,
  },
  hint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  actions: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    gap: 14,
  },
  pill: {
    width: '100%',
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#111',
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  pillPressed: {
    backgroundColor: '#F6F6F6',
  },
  pillDisabled: {
    opacity: 0.55,
  },
  pillIcon: {
    width: 22,
    alignItems: 'center',
  },
  pillLabel: {
    fontSize: 15,
    color: '#111',
    fontWeight: '500',
  },
  googleMark: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4285F4',
  },
  emailForm: {
    width: '100%',
    gap: 10,
    marginTop: 4,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111',
    backgroundColor: '#fff',
  },
  forgot: {
    fontSize: 13,
    color: '#111',
    textDecorationLine: 'underline',
    textAlign: 'right',
  },
  continueBtn: {
    width: '100%',
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  message: {
    fontSize: 13,
    color: '#C62828',
    textAlign: 'center',
    lineHeight: 18,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: '#111',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: '#111',
  },
  rememberText: {
    fontSize: 13,
    color: '#111',
  },
  switchText: {
    fontSize: 14,
    color: '#111',
    marginTop: 6,
    textAlign: 'center',
  },
  switchLink: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  legal: {
    paddingHorizontal: 28,
    paddingBottom: 18,
    fontSize: 11,
    lineHeight: 16,
    color: '#8A8A8A',
    textAlign: 'center',
  },
});

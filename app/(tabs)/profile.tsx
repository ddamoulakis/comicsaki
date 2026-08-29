import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { JoinAuthScreen } from '@/components/auth/JoinAuthScreen';
import { ComicsakiLogo } from '@/components/comicsaki/ComicsakiLogo';
import { KirbyBurst } from '@/components/comicsaki/KirbyBurst';
import { KirbyDots } from '@/components/comicsaki/KirbyDots';
import { KirbyScreen } from '@/components/comicsaki/KirbyScreen';
import { KirbyText } from '@/components/comicsaki/KirbyText';
import { resolveGreekCity, suggestGreekCities } from '@/constants/greekCities';
import { theme } from '@/constants/Theme';
import { useAuth } from '@/contexts/AuthProvider';
import { useInboxBadge } from '@/contexts/InboxBadgeProvider';
import {
  fetchOwnProfile,
  fetchSellerRatingStats,
  formatProfileArea,
  isProfileComplete,
  updateOwnAvatarUrl,
  uploadAvatarImage,
  upsertOwnProfile,
  type SellerRatingStats,
  type UserProfile,
} from '@/services/supabase/profile';

export default function ProfileScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const {
    configured,
    loading,
    user,
    signIn,
    signUp,
    signOut,
    signInWithGoogle,
    signInWithApple,
    signInWithFacebook,
    sendPasswordReset,
  } = useAuth();
  const { badge: inboxBadge, refresh: refreshInboxBadge } = useInboxBadge();
  const { authError, setup } = useLocalSearchParams<{ authError?: string; setup?: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [city, setCity] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [ratingStats, setRatingStats] = useState<SellerRatingStats | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const forceSetup = setup === '1';

  useEffect(() => {
    if (typeof authError === 'string' && authError.trim()) {
      setMessage(authError);
    }
  }, [authError]);

  useEffect(() => {
    if (forceSetup) {
      setEditingProfile(true);
    }
  }, [forceSetup]);

  useEffect(() => {
    navigation.setOptions({
      title: user
        ? editingProfile && !isProfileComplete(profile)
          ? 'Το προφίλ σου'
          : 'Λογαριασμός'
        : 'Προφίλ',
    });
  }, [navigation, user, editingProfile, profile]);

  const loadProfile = useCallback(() => {
    if (!user) {
      setProfile(null);
      setRatingStats(null);
      return;
    }
    setProfileLoading(true);
    setMessage(null);

    const meta = user.user_metadata ?? {};
    const metaName = String(
      meta.full_name ||
        meta.name ||
        [meta.given_name, meta.family_name].filter(Boolean).join(' ') ||
        '',
    ).trim();
    const metaAvatar = String(meta.avatar_url || meta.picture || '').trim() || null;

    fetchOwnProfile()
      .then((nextProfile) => {
        setProfile(nextProfile);
        const nextName = nextProfile?.display_name?.trim() || metaName;
        const nextAvatar = nextProfile?.avatar_url || metaAvatar;
        setDisplayName(nextName);
        setCity(nextProfile?.city ?? '');
        setAvatarUri(nextAvatar);
        const incomplete = !isProfileComplete(nextProfile);
        setEditingProfile(incomplete);
        if (forceSetup && !incomplete) {
          router.replace('/(tabs)/profile');
        }
      })
      .catch((error) => {
        setMessage(error instanceof Error ? error.message : 'Αποτυχία φόρτωσης προφίλ.');
        setEditingProfile(true);
        if (metaName) setDisplayName(metaName);
        if (metaAvatar) setAvatarUri(metaAvatar);
      })
      .finally(() => setProfileLoading(false));

    fetchSellerRatingStats(user.id)
      .then(setRatingStats)
      .catch(() => setRatingStats(null));
  }, [user, forceSetup, router]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      void refreshInboxBadge();
    }, [loadProfile, refreshInboxBadge]),
  );

  const handleSignIn = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await signIn(email.trim(), password);
      setMessage('Συνδέθηκες επιτυχώς.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Αποτυχία σύνδεσης.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignUp = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await signUp(email.trim(), password);
      // Session may already exist (no email confirm) → profile editor opens via loadProfile.
      setEditingProfile(true);
      setMessage('Ο λογαριασμός δημιουργήθηκε. Συμπλήρωσε το προφίλ σου.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Αποτυχία εγγραφής.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await signOut();
      setProfile(null);
      setRatingStats(null);
      setDisplayName('');
      setCity('');
      setAvatarUri(null);
      setEditingProfile(false);
      setMessage('Αποσυνδέθηκες.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Αποτυχία αποσύνδεσης.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Αποτυχία σύνδεσης με Google.');
    } finally {
      setBusy(false);
    }
  };

  const handleAppleSignIn = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await signInWithApple();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Αποτυχία σύνδεσης με Apple.');
    } finally {
      setBusy(false);
    }
  };

  const handleFacebookSignIn = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await signInWithFacebook();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Αποτυχία σύνδεσης με Facebook.');
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setMessage('Γράψε πρώτα το email σου.');
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      await sendPasswordReset(email.trim());
      setMessage('Στείλαμε email για αλλαγή κωδικού.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Αποτυχία αποστολής email επαναφοράς.');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      setMessage('Βάλε ένα όνομα εμφάνισης.');
      return;
    }
    if (!city.trim()) {
      setMessage('Βάλε την πόλη/περιοχή σου (όχι ακριβή διεύθυνση).');
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const resolvedCity = resolveGreekCity(city) ?? city.trim();
      setCity(resolvedCity);
      const saved = await upsertOwnProfile({
        displayName: displayName.trim(),
        city: resolvedCity,
        country: 'Ελλάδα',
        ...(avatarUri && !avatarUri.startsWith('file:') && !avatarUri.startsWith('blob:')
          ? { avatarUrl: avatarUri }
          : {}),
      });
      setProfile(saved);
      setEditingProfile(false);
      setMessage('Το προφίλ αποθηκεύτηκε.');
      if (forceSetup) {
        router.replace('/(tabs)/profile');
      }
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error && 'message' in error
            ? String((error as { message: unknown }).message)
            : 'Αποτυχία αποθήκευσης προφίλ.';
      setMessage(msg);
    } finally {
      setBusy(false);
    }
  };

  const profileComplete = isProfileComplete(profile);
  const needsProfileSetup = Boolean(user) && !profileComplete;
  const citySuggestions = useMemo(() => suggestGreekCities(city, 6), [city]);

  const handleCityChange = (value: string) => {
    setCity(value);
  };

  const pickCity = (name: string) => {
    setCity(name);
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setMessage('Χρειάζεται πρόσβαση στη βιβλιοθήκη φωτογραφιών.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]?.uri) return;

    const localUri = result.assets[0].uri;
    setAvatarUri(localUri);
    setAvatarUploading(true);
    setMessage(null);
    try {
      const publicUrl = await uploadAvatarImage(localUri);
      const saved = await updateOwnAvatarUrl(publicUrl);
      setProfile(saved);
      setAvatarUri(saved.avatar_url);
      setMessage('Η φωτογραφία προφίλ αποθηκεύτηκε.');
    } catch (error) {
      setAvatarUri(profile?.avatar_url ?? null);
      setMessage(error instanceof Error ? error.message : 'Αποτυχία ανεβάσματος φωτογραφίας.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const openHelpCenter = async () => {
    const subject = encodeURIComponent('Comicsάκι — Βοήθεια');
    const body = encodeURIComponent(
      [
        'Γεια σου,',
        '',
        'Χρειάζομαι βοήθεια με το Comicsάκι.',
        '',
        `Ο λογαριασμός μου: ${user?.email ?? '—'}`,
        `Όνομα: ${displayName.trim() || profile?.display_name?.trim() || '—'}`,
        '',
        'Περιγραφή:',
        '',
      ].join('\n'),
    );
    const mailto = `mailto:d.damoulakis@hotmail.com?subject=${subject}&body=${body}`;
    try {
      const canOpen = await Linking.canOpenURL(mailto);
      if (!canOpen) {
        setMessage('Άνοιξε το email σου και γράψε στο d.damoulakis@hotmail.com');
        return;
      }
      await Linking.openURL(mailto);
    } catch {
      setMessage('Άνοιξε το email σου και γράψε στο d.damoulakis@hotmail.com');
    }
  };

  type MenuItem = {
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    badge?: string;
  };

  const menuItems: MenuItem[] = user
    ? [
        {
          key: 'my-listings',
          label: 'Οι αγγελίες μου',
          icon: 'folder-outline',
          onPress: () => router.push({ pathname: '/(tabs)/listings', params: { mine: '1' } }),
        },
        {
          key: 'messages',
          label: 'Μηνύματα',
          icon: 'chatbubble-outline',
          onPress: () => router.push({ pathname: '/(tabs)/listings', params: { inbox: '1' } }),
          badge: inboxBadge,
        },
        {
          key: 'favorites',
          label: 'Αγαπημένα',
          icon: 'heart-outline',
          onPress: () => router.push('/(tabs)/favorites'),
        },
        {
          key: 'saved',
          label: 'Αποθηκευμένες αναζητήσεις',
          icon: 'bookmark-outline',
          onPress: () => router.push({ pathname: '/(tabs)/listings', params: { saved: '1' } }),
        },
        {
          key: 'account',
          label: 'Ο λογαριασμός μου',
          icon: 'person-outline',
          onPress: () => setEditingProfile(true),
        },
        {
          key: 'help',
          label: 'Κέντρο Βοήθειας',
          icon: 'help-circle-outline',
          onPress: () => {
            void openHelpCenter();
          },
        },
      ]
    : [];

  if (!user) {
    return (
      <JoinAuthScreen
        configured={configured}
        loading={loading}
        busy={busy}
        message={message}
        email={email}
        password={password}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onClose={() => router.replace('/(tabs)')}
        onGoogle={handleGoogleSignIn}
        onApple={handleAppleSignIn}
        onFacebook={handleFacebookSignIn}
        onEmailSignIn={handleSignIn}
        onEmailSignUp={handleSignUp}
        onForgotPassword={handleForgotPassword}
      />
    );
  }

  const closeProfileEditor = () => {
    if (needsProfileSetup) {
      router.replace('/(tabs)');
      return;
    }
    setEditingProfile(false);
    setDisplayName(profile?.display_name ?? '');
    setCity(profile?.city ?? '');
    setAvatarUri(profile?.avatar_url ?? null);
    setMessage(null);
  };

  const isEditing = editingProfile || needsProfileSetup;

  return (
    <KirbyScreen showDecor={false} variant="plasma" style={styles.container}>
      <KirbyBurst size={32} color={theme.kirbyOrange} style={styles.burstTop} />
      <KirbyDots style={styles.dotsBottom} color={theme.kirbyBlue} />
      {isEditing ? (
        <View style={styles.editScreen}>
          <View style={styles.editPanel}>
            <View style={styles.editTopRow}>
              <Text style={styles.formTitle}>
                {needsProfileSetup ? 'Ολοκλήρωσε το προφίλ σου' : 'Επεξεργασία προφίλ'}
              </Text>
              <Pressable
                style={styles.editCloseBtn}
                onPress={closeProfileEditor}
                hitSlop={10}
                accessibilityLabel="Κλείσιμο">
                <Ionicons name="close" size={22} color={theme.text} />
              </Pressable>
            </View>

            <Text style={styles.helperTextCompact}>
              {needsProfileSetup
                ? 'Όνομα, φωτογραφία και πόλη για να ξεκινήσεις.'
                : 'Εμφανίζεται μόνο η περιοχή σου, όχι η διεύθυνση.'}
            </Text>

            {profileLoading ? (
              <ActivityIndicator color={theme.kirbyMagenta} />
            ) : (
              <View style={styles.editForm}>
                <Text style={styles.fieldLabel}>Φωτογραφία προφίλ</Text>
                <Pressable
                  style={styles.avatarPickerCompact}
                  onPress={pickAvatar}
                  disabled={busy || avatarUploading}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatarPickerImageCompact} />
                  ) : (
                    <View style={styles.avatarPickerEmptyCompact}>
                      <Ionicons name="person-outline" size={22} color={theme.textMuted} />
                    </View>
                  )}
                  <View style={styles.avatarPickerMeta}>
                    <Text style={styles.avatarPickerTitle}>
                      {avatarUri ? 'Αλλαγή φωτογραφίας' : 'Επίλεξε φωτογραφία'}
                    </Text>
                  </View>
                  {avatarUploading ? (
                    <ActivityIndicator color={theme.kirbyMagenta} />
                  ) : (
                    <Ionicons name="camera-outline" size={18} color={theme.kirbyMagenta} />
                  )}
                </Pressable>

                <Text style={styles.fieldLabel}>Όνομα εμφάνισης *</Text>
                <TextInput
                  style={styles.inputCompact}
                  placeholder="π.χ. Dennis"
                  placeholderTextColor={theme.textMuted}
                  value={displayName}
                  onChangeText={setDisplayName}
                />

                <Text style={styles.fieldLabel}>Πόλη / Περιοχή *</Text>
                <TextInput
                  style={styles.inputCompact}
                  placeholder="π.χ. Αθήνα"
                  placeholderTextColor={theme.textMuted}
                  value={city}
                  onChangeText={handleCityChange}
                  autoCorrect={false}
                  autoComplete="off"
                />
                {citySuggestions.length > 0 ? (
                  <View style={styles.citySuggestBoxCompact}>
                    {citySuggestions.slice(0, 3).map((name) => (
                      <Pressable key={name} style={styles.citySuggestRow} onPress={() => pickCity(name)}>
                        <Ionicons name="location-outline" size={14} color={theme.kirbyMagenta} />
                        <Text style={styles.citySuggestText}>{name}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {message ? <Text style={styles.messageText}>{message}</Text> : null}

                <Pressable
                  style={[styles.primaryBtn, styles.primaryBtnFlex]}
                  disabled={busy}
                  onPress={handleSaveProfile}>
                  <Text style={styles.primaryBtnText}>Αποθήκευση προφίλ</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      ) : (
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.panel}>
          <ComicsakiLogo compact />
          <View style={styles.divider} />

          {!configured ? (
            <KirbyText variant="body" color={theme.textMuted} style={styles.subtitle}>
              Το Supabase δεν είναι ρυθμισμένο. Αντέγραψε `.env.example` σε `.env` και βάλε τα keys σου.
            </KirbyText>
          ) : loading ? (
            <KirbyText variant="body" color={theme.textMuted} style={styles.subtitle}>
              Φόρτωση λογαριασμού…
            </KirbyText>
          ) : (
            <View style={styles.authBlock}>
              <View style={styles.loggedInCard}>
                <View style={styles.loggedInHeader}>
                  <Pressable
                    style={styles.loggedInAvatar}
                    onPress={pickAvatar}
                    disabled={busy || avatarUploading}
                    accessibilityLabel="Αλλαγή φωτογραφίας προφίλ">
                    {avatarUri ? (
                      <Image source={{ uri: avatarUri }} style={styles.loggedInAvatarImage} />
                    ) : (
                      <Ionicons name="person" size={22} color={theme.surface} />
                    )}
                    <View style={styles.avatarCamBadge}>
                      {avatarUploading ? (
                        <ActivityIndicator size="small" color={theme.surface} />
                      ) : (
                        <Ionicons name="camera" size={12} color={theme.surface} />
                      )}
                    </View>
                  </Pressable>
                  <View style={styles.loggedInTextWrap}>
                    <View style={styles.loggedInBadgeRow}>
                      <View style={styles.loggedInDot} />
                      <Text style={styles.loggedInBadge}>Συνδεδεμένος</Text>
                    </View>
                    <Text style={styles.loggedInName}>
                      {displayName.trim() || profile?.display_name?.trim() || 'Χρήστης'}
                    </Text>
                    <Text style={styles.userEmail}>{user.email}</Text>
                    {formatProfileArea(profile) ? (
                      <Text style={styles.loggedInArea}>📍 {formatProfileArea(profile)}</Text>
                    ) : null}
                  </View>
                </View>
              </View>

              {profileLoading ? (
                <ActivityIndicator color={theme.kirbyMagenta} />
              ) : (
                <>
                  {ratingStats && ratingStats.review_count > 0 ? (
                    <View style={styles.statsBox}>
                      <Text style={styles.statsTitle}>Βαθμολογία ως πωλητής</Text>
                      <Text style={styles.statsValue}>
                        ★ {ratingStats.avg_score.toFixed(1)} · {ratingStats.review_count} αξιολογήσεις
                      </Text>
                    </View>
                  ) : null}

                  <View style={styles.menuCard}>
                    {menuItems.map((item, index) => (
                      <Pressable
                        key={item.key}
                        style={[styles.menuRow, index < menuItems.length - 1 && styles.menuRowBorder]}
                        onPress={item.onPress}>
                        <Ionicons name={item.icon} size={20} color={theme.text} />
                        <Text style={styles.menuLabel}>{item.label}</Text>
                        {item.badge ? (
                          <View style={styles.menuBadge}>
                            <Text style={styles.menuBadgeText}>{item.badge}</Text>
                          </View>
                        ) : null}
                        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                      </Pressable>
                    ))}
                    <View style={styles.menuDivider} />
                    <Pressable style={styles.menuRow} onPress={handleSignOut}>
                      <Ionicons name="log-out-outline" size={20} color={theme.kirbyRed} />
                      <Text style={[styles.menuLabel, styles.menuLabelDanger]}>Αποσύνδεση</Text>
                    </Pressable>
                  </View>
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>
      )}
    </KirbyScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 16,
    width: '100%',
  },
  burstTop: {
    position: 'absolute',
    top: '20%',
    left: '8%',
    pointerEvents: 'none',
  },
  dotsBottom: {
    position: 'absolute',
    bottom: '24%',
    right: '10%',
    opacity: 0.55,
    pointerEvents: 'none',
  },
  panel: {
    backgroundColor: theme.surface,
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
    padding: 16,
    width: '100%',
    gap: 14,
    alignItems: 'center',
    shadowColor: theme.border,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  divider: {
    width: '100%',
    height: 4,
    backgroundColor: theme.kirbyRed,
    borderWidth: 2,
    borderColor: theme.border,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
  },
  authBlock: {
    width: '100%',
    gap: 10,
  },
  formTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: theme.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    flex: 1,
  },
  editScreen: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  editPanel: {
    backgroundColor: theme.surface,
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
    padding: 14,
    width: '100%',
    gap: 10,
    shadowColor: theme.border,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  editTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editCloseBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.background,
  },
  helperTextCompact: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
    lineHeight: 15,
  },
  editForm: {
    width: '100%',
    gap: 8,
  },
  avatarPickerCompact: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.background,
    padding: 8,
  },
  avatarPickerImageCompact: {
    width: 48,
    height: 48,
    borderWidth: 2,
    borderColor: theme.border,
  },
  avatarPickerEmptyCompact: {
    width: 48,
    height: 48,
    borderWidth: 2,
    borderColor: theme.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
  },
  inputCompact: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.background,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  citySuggestBoxCompact: {
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.background,
    maxHeight: 90,
  },
  messageText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.kirbyRed,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  loggedInCard: {
    width: '100%',
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.background,
    padding: 12,
    gap: 12,
  },
  loggedInHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loggedInAvatar: {
    width: 56,
    height: 56,
    backgroundColor: theme.kirbyMagenta,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  loggedInAvatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarCamBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.cosmicInk,
    borderWidth: 1.5,
    borderColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPicker: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.background,
    padding: 10,
  },
  avatarPickerImage: {
    width: 64,
    height: 64,
    borderWidth: 2,
    borderColor: theme.border,
  },
  avatarPickerEmpty: {
    width: 64,
    height: 64,
    borderWidth: 2,
    borderColor: theme.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
  },
  avatarPickerMeta: {
    flex: 1,
    gap: 2,
  },
  avatarPickerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: theme.text,
  },
  avatarPickerHint: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textMuted,
  },
  loggedInTextWrap: {
    flex: 1,
    gap: 2,
  },
  loggedInBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  loggedInDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22a06b',
  },
  loggedInBadge: {
    fontSize: 11,
    fontWeight: '900',
    color: '#22a06b',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  loggedInName: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.text,
  },
  userEmail: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textMuted,
  },
  loggedInArea: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.kirbyBlue,
    marginTop: 2,
  },
  menuCard: {
    width: '100%',
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: theme.surface,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#e6e6e6',
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: theme.text,
  },
  menuLabelDanger: {
    color: theme.kirbyRed,
  },
  menuBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.kirbyRed,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  menuBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.surface,
  },
  menuDivider: {
    height: 8,
    backgroundColor: theme.background,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e6e6e6',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: theme.kirbyRed,
    backgroundColor: theme.surface,
    paddingVertical: 12,
    width: '100%',
  },
  signOutBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: theme.text,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.kirbyYellow,
    paddingVertical: 10,
  },
  editProfileBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: theme.text,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  primaryBtnFlex: {
    flex: 1,
  },
  input: {
    width: '100%',
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.background,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  citySuggestBox: {
    width: '100%',
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    overflow: 'hidden',
  },
  citySuggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  citySuggestText: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.text,
  },
  warningBox: {
    borderWidth: 2,
    borderColor: theme.kirbyOrange,
    backgroundColor: '#fff8ef',
    padding: 10,
  },
  warningText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.text,
    textAlign: 'center',
  },
  statsBox: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.background,
    padding: 10,
    gap: 4,
  },
  statsTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.textMuted,
    textTransform: 'uppercase',
  },
  statsValue: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.text,
  },
  areaPreview: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.kirbyBlue,
    textAlign: 'center',
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
  socialDividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  socialDivider: {
    flex: 1,
    height: 2,
    backgroundColor: theme.border,
  },
  socialDividerText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.textMuted,
  },
  googleBtn: {
    backgroundColor: '#ffffff',
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  googleBtnText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '900',
  },
  appleBtn: {
    backgroundColor: theme.border,
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  appleBtnText: {
    color: theme.surface,
    fontSize: 13,
    fontWeight: '900',
  },
  linkText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.kirbyBlue,
    textAlign: 'right',
  },
  helperText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
  message: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.kirbyBlue,
    textAlign: 'center',
  },
});

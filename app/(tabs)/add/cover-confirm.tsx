import { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { AddScreenHeader } from '@/components/add/AddScreenHeader';
import { ComicBorderCard } from '@/components/comicsaki/ComicBorderCard';
import { CosmicBackground } from '@/components/comicsaki/CosmicBackground';
import { ZoomableCover } from '@/components/comicsaki/ZoomableCover';
import { theme } from '@/constants/Theme';
import {
  getCoverConfirm,
  clearCoverConfirm,
  setCoverLookupResult,
} from '@/lib/coverScanSession';
import { detectComicMarket } from '@/lib/comicLanguage';
import { enrichGeminiWithCatalog } from '@/services/coverLookup';
import type { ComicRecognitionResult } from '@/services/geminiVision';

export default function CoverConfirmScreen() {
  const router = useRouter();
  const confirm = getCoverConfirm();

  const [title, setTitle] = useState(confirm?.title ?? '');
  const [issue, setIssue] = useState(confirm?.issue ?? '');
  const [publisher, setPublisher] = useState(confirm?.publisher ?? '');
  const [year, setYear] = useState(confirm?.year ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const market = detectComicMarket(title, publisher, confirm?.notes);
  const isGreek = market === 'greek';

  useEffect(() => {
    if (!confirm) {
      router.replace('/(tabs)/add/cover');
    }
  }, []);

  const search = async () => {
    const q = title.trim();
    if (!q) {
      setError('Γράψε τουλάχιστον τον τίτλο.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const greek = detectComicMarket(q, publisher, confirm?.notes) === 'greek';
      const gemini: ComicRecognitionResult = {
        series: q,
        issue: issue.trim(),
        publisher: publisher.trim(),
        year: year.trim(),
        category: '',
        confidence: 'high',
        language: greek ? 'el' : 'en',
        notes: confirm?.notes,
        raw: [q, issue.trim(), publisher.trim(), year.trim()].filter(Boolean).join(' '),
      };
      const result = await enrichGeminiWithCatalog(gemini, confirm?.photoUri ?? '');
      setCoverLookupResult(result);
      clearCoverConfirm();
      router.replace('/(tabs)/add/cover-results');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Αποτυχία αναζήτησης.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <CosmicBackground variant="flare">
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <AddScreenHeader
            title="ΔΙΟΡΘΩΣΗ ΤΙΤΛΟΥ"
            subtitle={
              isGreek
                ? 'Ελληνικό κόμικ → κατάλογος Comicsάκι.'
                : 'Ξενόγλωσσο → αναζήτηση στο Metron.'
            }
          />

          {confirm?.photoUri ? (
            <View style={styles.photoRow}>
              <ZoomableCover uri={confirm.photoUri} style={styles.photo} resizeMode="cover" caption={title} />
              {confirm.notes ? (
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>Σημείωση Gemini</Text>
                  <Text style={styles.noteText} numberOfLines={6}>
                    {confirm.notes}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <ComicBorderCard style={styles.card}>
            <Text style={styles.cardTitle}>ΤΙ ΔΙΑΒΑΣΕ ΤΟ GEMINI</Text>

            <View style={styles.field}>
              <Text style={styles.label}>Τίτλος / Σειρά</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="π.χ. Iron Man, Amazing Spider-Man, Μπλεκ"
                placeholderTextColor={theme.textMuted}
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Τεύχος #</Text>
              <TextInput
                style={styles.input}
                value={issue}
                onChangeText={setIssue}
                placeholder="π.χ. 128"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Εκδότης (προαιρετικό)</Text>
              <TextInput
                style={styles.input}
                value={publisher}
                onChangeText={setPublisher}
                placeholder="π.χ. Marvel, DC, Μαμούθ"
                placeholderTextColor={theme.textMuted}
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Έτος (προαιρετικό)</Text>
              <TextInput
                style={styles.input}
                value={year}
                onChangeText={setYear}
                placeholder="π.χ. 1980"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
                returnKeyType="search"
                onSubmitEditing={search}
              />
            </View>
          </ComicBorderCard>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.primaryBtn, (busy || !title.trim()) && styles.btnDisabled]}
            disabled={busy || !title.trim()}
            onPress={search}>
            {busy ? (
              <ActivityIndicator color={theme.surface} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {isGreek ? 'Αναζήτηση στον κατάλογο' : 'Αναζήτηση στο Metron'}
              </Text>
            )}
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            disabled={busy}
            onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>← Νέο scan</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    paddingHorizontal: 12,
    width: '100%',
    paddingTop: 8,
    paddingBottom: 28,
    gap: 12,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  photo: {
    width: 72,
    height: 100,
    borderWidth: 2,
    borderColor: theme.border,
  },
  noteBox: {
    flex: 1,
    backgroundColor: theme.background,
    borderWidth: 2,
    borderColor: theme.border,
    padding: 8,
    gap: 4,
  },
  noteLabel: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
    color: theme.textMuted,
    textTransform: 'uppercase',
  },
  noteText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.text,
    lineHeight: 14,
  },
  card: {
    padding: 14,
    gap: 10,
  },
  cardTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    color: theme.textMuted,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  field: {
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.text,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  input: {
    borderWidth: 2,
    borderColor: theme.border,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
    backgroundColor: theme.background,
  },
  error: {
    color: theme.kirbyRed,
    fontSize: 12,
    fontWeight: '800',
  },
  primaryBtn: {
    backgroundColor: theme.kirbyMagenta,
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryBtnText: {
    color: theme.surface,
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryBtn: {
    backgroundColor: theme.surface,
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '800',
  },
  btnDisabled: { opacity: 0.5 },
});

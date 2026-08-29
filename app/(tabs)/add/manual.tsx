import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { useAuth } from '@/contexts/AuthProvider';
import { theme } from '@/constants/Theme';
import { consumeManualAddPrefill } from '@/lib/collectionSession';
import { consumeSelectedCoverPick } from '@/lib/coverScanSession';
import { isOfficialCoverUrl } from '@/lib/coverUrl';
import { isSupabaseIssueId } from '@/lib/issueId';
import { addCollectionItem } from '@/services/supabase/collection';
import {
  fieldsFromCandidate,
  verifyManualEntry,
  type ManualVerifyCandidate,
} from '@/services/verifyManualEntry';

const GRADES = ['NM', 'VF', 'FN', 'GD'];
const SUGGEST_DEBOUNCE_MS = 550;
const MIN_SERIES_LEN = 3;

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
      />
    </View>
  );
}

export default function ManualAddScreen() {
  const router = useRouter();
  const { user, configured } = useAuth();
  const [publisher, setPublisher] = useState('');
  const [series, setSeries] = useState('');
  const [issue, setIssue] = useState('');
  const [category, setCategory] = useState('');
  const [edition, setEdition] = useState('');
  const [year, setYear] = useState('');
  const [notes, setNotes] = useState('');
  const [grade, setGrade] = useState('NM');
  const [issueId, setIssueId] = useState<string | undefined>();
  const [catalogCoverUrl, setCatalogCoverUrl] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [verifySource, setVerifySource] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<ManualVerifyCandidate[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [searching, setSearching] = useState(false);
  const [fromScan, setFromScan] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** After user picks a suggestion, pause auto-search until they edit identity fields. */
  const pickLockRef = useRef(false);
  const searchSeqRef = useRef(0);
  const skipPrefillSearchRef = useRef(false);

  useEffect(() => {
    const pick = consumeSelectedCoverPick();
    if (pick) {
      skipPrefillSearchRef.current = true;
      pickLockRef.current = true;
      setFromScan(true);
      setIssueId(pick.edition.issueId ?? pick.match.issueId);
      setPublisher(pick.edition.publisher || pick.match.publisher || '');
      setSeries(pick.match.series || '');
      setIssue(pick.match.issue || '');
      setCategory(pick.match.category || '');
      setEdition(pick.edition.label || '');
      setYear(pick.edition.year || '');
      const cover = isOfficialCoverUrl(pick.match.coverUrl) ? pick.match.coverUrl : '';
      setCatalogCoverUrl(cover);
      setVerified(Boolean(cover || pick.match.sourceName));
      setVerifySource(pick.match.sourceName || 'Cover scan');
      setNotes(
        [
          pick.match.title ? `Τίτλος: ${pick.match.title}` : null,
          pick.edition.notes,
          pick.edition.sourceUrl ? `Πηγή: ${pick.edition.sourceUrl}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      );
      return;
    }

    const prefill = consumeManualAddPrefill();
    if (!prefill) return;
    skipPrefillSearchRef.current = Boolean(prefill.series?.trim());
    setIssueId(prefill.issueId);
    setPublisher(prefill.publisher ?? '');
    setSeries(prefill.series ?? '');
    setIssue(prefill.issue ?? '');
    setCategory(prefill.category ?? '');
    setEdition(prefill.edition ?? '');
    setNotes(prefill.notes ?? '');
  }, []);

  const clearPickState = useCallback(() => {
    setVerified(false);
    setVerifySource(null);
    setSelectedKey('');
    setCatalogCoverUrl('');
    setIssueId(undefined);
  }, []);

  const applyCandidate = useCallback((c: ManualVerifyCandidate, opts?: { silent?: boolean }) => {
    const fields = fieldsFromCandidate(c);
    pickLockRef.current = true;
    setSelectedKey(`${c.match.id}-${c.edition.id}`);
    setIssueId(fields.issueId);
    setPublisher(fields.publisher);
    setSeries(fields.series);
    setIssue(fields.issue);
    setYear(fields.year);
    setEdition(fields.edition);
    setCategory(fields.category);
    setCatalogCoverUrl(fields.coverUrl);
    setVerified(c.verified || Boolean(fields.coverUrl));
    setVerifySource(fields.sourceName);
    if (!opts?.silent) {
      setMessage(
        c.verified || fields.coverUrl
          ? 'Συμπληρώθηκε από τον κατάλογο. Έλεγξε και αποθήκευσε.'
          : 'Επιλέχθηκε πρόταση — συμπληρώθηκαν τα υπόλοιπα πεδία.',
      );
    }
  }, []);

  const runCatalogSearch = useCallback(
    async (opts?: { force?: boolean; withPhoto?: boolean }) => {
      const seriesQ = series.trim();
      if (seriesQ.length < MIN_SERIES_LEN) {
        setCandidates([]);
        setSearching(false);
        return;
      }
      if (!opts?.force && pickLockRef.current) return;

      const seq = ++searchSeqRef.current;
      setSearching(true);
      try {
        const result = await verifyManualEntry({
          series: seriesQ,
          issue: issue.trim() || undefined,
          publisher: publisher.trim() || undefined,
          year: year.trim() || undefined,
          photoUri: opts?.withPhoto ? photoUri : null,
        });
        if (seq !== searchSeqRef.current) return;

        setCandidates(result.candidates);

        if (result.status === 'not_found') {
          if (opts?.force) {
            setMessage(
              result.market === 'greek'
                ? 'Δεν βρέθηκαν προτάσεις στον ελληνικό κατάλογο.'
                : 'Δεν βρέθηκαν προτάσεις στο Metron.',
            );
          }
          return;
        }

        // Unique strong match with issue → auto-fill the rest
        if (result.status === 'verified' && result.best && !pickLockRef.current) {
          applyCandidate(result.best);
          return;
        }

        if (opts?.force || result.candidates.length > 0) {
          setMessage(
            result.candidates.length === 1
              ? 'Βρέθηκε 1 πρόταση — πάτα την για να συμπληρωθούν τα υπόλοιπα.'
              : `Βρέθηκαν ${result.candidates.length} προτάσεις — διάλεξε ποια ταιριάζει.`,
          );
        }
      } catch (error) {
        if (seq !== searchSeqRef.current) return;
        if (opts?.force) {
          setMessage(error instanceof Error ? error.message : 'Αποτυχία αναζήτησης.');
        }
      } finally {
        if (seq === searchSeqRef.current) setSearching(false);
      }
    },
    [series, issue, publisher, year, photoUri, applyCandidate],
  );

  // Live suggestions while typing series / issue / publisher
  useEffect(() => {
    if (skipPrefillSearchRef.current) {
      skipPrefillSearchRef.current = false;
      return;
    }
    if (pickLockRef.current) return;

    const seriesQ = series.trim();
    if (seriesQ.length < MIN_SERIES_LEN) {
      setCandidates([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timer = setTimeout(() => {
      void runCatalogSearch();
    }, SUGGEST_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [series, issue, publisher, runCatalogSearch]);

  const onIdentityChange =
    (setter: (v: string) => void) =>
    (value: string) => {
      pickLockRef.current = false;
      clearPickState();
      setter(value);
    };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setMessage('Χρειάζεται άδεια για τις φωτογραφίες.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setPhotoUri(result.assets[0].uri);
    pickLockRef.current = false;
    setMessage(null);
  };

  useEffect(() => {
    if (!photoUri || pickLockRef.current) return;
    if (series.trim().length < MIN_SERIES_LEN) return;
    const timer = setTimeout(() => {
      void runCatalogSearch({ withPhoto: true });
    }, 300);
    return () => clearTimeout(timer);
    // Only re-rank when photo changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUri]);

  const save = async () => {
    if (!series.trim()) {
      setMessage('Συμπλήρωσε τη σειρά.');
      return;
    }

    if (!issue.trim() || issue.trim() === '-') {
      setMessage('Συμπλήρωσε τον αριθμό τεύχους (π.χ. 30).');
      return;
    }

    setSaving(true);
    setMessage(null);

    if (!configured || !user) {
      setMessage('Για cloud αποθήκευση, συνδέσου από το Προφίλ.');
      setSaving(false);
      return;
    }

    try {
      const noteBits = [
        edition.trim(),
        notes.trim(),
        verified && verifySource ? `Επαληθευμένο: ${verifySource}` : null,
        !verified ? 'Καταχώρηση χωρίς επαλήθευση καταλόγου' : null,
      ].filter(Boolean);

      await addCollectionItem({
        issueId: isSupabaseIssueId(issueId) ? issueId : undefined,
        series: series.trim(),
        issue: issue.trim(),
        publisher: publisher.trim(),
        category: category.trim(),
        condition: grade,
        year: year.trim() || undefined,
        notes: noteBits.join('\n') || undefined,
        coverUrl: catalogCoverUrl || undefined,
      });
      setMessage(
        verified
          ? 'Αποθηκεύτηκε (επαληθευμένο) στη συλλογή σου.'
          : 'Αποθηκεύτηκε στη συλλογή σου.',
      );
      setTimeout(() => router.replace('/(tabs)/collection'), 700);
    } catch (error) {
      let msg = 'Άγνωστο σφάλμα';
      if (error instanceof Error) {
        msg = error.message;
      } else if (error && typeof error === 'object' && 'message' in error) {
        msg = String((error as { message: unknown }).message);
      } else if (typeof error === 'string') {
        msg = error;
      } else {
        try {
          msg = JSON.stringify(error);
        } catch {
          msg = String(error);
        }
      }
      setMessage(`Αποτυχία: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <CosmicBackground variant="aurora">
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <AddScreenHeader
            title={fromScan ? 'ΕΠΙΒΕΒΑΙΩΣΗ' : 'ΧΕΙΡΟΚΙΝΗΤΑ'}
            subtitle={
              fromScan
                ? 'Έλεγξε τα στοιχεία από το scan πριν την αποθήκευση.'
                : 'Γράψε σειρά (και τεύχος) — εμφανίζονται προτάσεις και συμπληρώνονται τα υπόλοιπα.'
            }
          />

          {fromScan ? (
            <View style={styles.scanBanner}>
              <Text style={styles.scanBannerText}>Προσυμπληρώθηκε από cover scan</Text>
            </View>
          ) : null}

          {verified ? (
            <View style={styles.verifiedBanner}>
              <Ionicons name="checkmark-circle" size={16} color={theme.surface} />
              <Text style={styles.verifiedBannerText}>
                Επαληθευμένο{verifySource ? ` · ${verifySource}` : ''}
              </Text>
            </View>
          ) : null}

          <ComicBorderCard style={styles.form}>
            <View style={styles.row}>
              <View style={styles.half}>
                <FormField
                  label="ΣΕΙΡΑ"
                  value={series}
                  onChangeText={onIdentityChange(setSeries)}
                  placeholder="π.χ. Amazing Spider-Man"
                />
              </View>
              <View style={styles.half}>
                <FormField
                  label="ΤΕΥΧΟΣ"
                  value={issue}
                  onChangeText={onIdentityChange(setIssue)}
                  placeholder="π.χ. 300"
                />
              </View>
            </View>

            <FormField
              label="ΕΚΔΟΤΗΣ (προαιρετικό)"
              value={publisher}
              onChangeText={onIdentityChange(setPublisher)}
              placeholder="βοηθάει την αναζήτηση"
            />

            {(searching || candidates.length > 0) && (
              <View style={styles.candidates}>
                <View style={styles.candidatesHeader}>
                  <Text style={styles.candidatesTitle}>Προτάσεις καταλόγου</Text>
                  {searching ? <ActivityIndicator size="small" color={theme.kirbyMagenta} /> : null}
                </View>
                {candidates.map((c) => {
                  const key = `${c.match.id}-${c.edition.id}`;
                  const selected = selectedKey === key;
                  const cover = c.match.coverUrl;
                  return (
                    <Pressable
                      key={key}
                      style={[styles.candidateRow, selected && styles.candidateSelected]}
                      onPress={() => applyCandidate(c)}>
                      {cover ? (
                        <ZoomableCover
                          uri={cover}
                          style={styles.candidateCover}
                          resizeMode="cover"
                          caption={`${c.match.series}${c.match.issue && c.match.issue !== '-' ? ` #${c.match.issue}` : ''}`}
                        />
                      ) : (
                        <View style={[styles.candidateCover, styles.candidateCoverEmpty]} />
                      )}
                      <View style={styles.candidateInfo}>
                        <Text style={styles.candidateTitle} numberOfLines={2}>
                          {c.match.series}
                          {c.match.issue && c.match.issue !== '-' ? ` #${c.match.issue}` : ''}
                        </Text>
                        <Text style={styles.candidateMeta} numberOfLines={1}>
                          {c.match.publisher && c.match.publisher !== '—'
                            ? c.match.publisher
                            : '—'}
                          {c.edition.year ? ` · ${c.edition.year}` : ''}
                          {c.visualScore > 0
                            ? ` · visual ${Math.round(c.visualScore * 100)}%`
                            : ''}
                        </Text>
                        {c.verified ? (
                          <Text style={styles.candidateVerified}>Καλύτερο match</Text>
                        ) : null}
                      </View>
                      <Ionicons
                        name={selected ? 'checkmark-circle' : 'add-circle-outline'}
                        size={24}
                        color={selected ? theme.kirbyMagenta : theme.textMuted}
                      />
                    </Pressable>
                  );
                })}
                {!searching && candidates.length === 0 ? (
                  <Text style={styles.candidatesEmpty}>Καμία πρόταση ακόμα.</Text>
                ) : null}
              </View>
            )}

            <View style={styles.photoRow}>
              <Pressable style={styles.photoBox} onPress={pickPhoto}>
                {photoUri ? (
                  <Image source={{ uri: photoUri }} style={styles.photoImg} resizeMode="cover" />
                ) : catalogCoverUrl ? (
                  <Image
                    source={{ uri: catalogCoverUrl }}
                    style={styles.photoImg}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.photoEmpty}>
                    <Ionicons name="image-outline" size={28} color={theme.textMuted} />
                    <Text style={styles.photoHint}>Φωτο εξωφύλλου</Text>
                    <Text style={styles.photoSub}>προαιρετικό</Text>
                  </View>
                )}
              </Pressable>
              <View style={styles.photoActions}>
                <Pressable style={styles.secondaryBtn} onPress={pickPhoto}>
                  <Text style={styles.secondaryBtnText}>
                    {photoUri ? 'Αλλαγή φωτο' : 'Προσθήκη φωτο'}
                  </Text>
                </Pressable>
                {photoUri ? (
                  <Pressable style={styles.linkBtn} onPress={() => setPhotoUri(null)}>
                    <Text style={styles.linkBtnText}>Αφαίρεση</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  style={[styles.verifyBtn, searching && styles.btnDisabled]}
                  disabled={searching}
                  onPress={() => {
                    pickLockRef.current = false;
                    void runCatalogSearch({ force: true, withPhoto: Boolean(photoUri) });
                  }}>
                  <Text style={styles.verifyBtnText}>
                    {photoUri ? 'Ταύτιση με εξώφυλλο' : 'Ανανέωση προτάσεων'}
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.half}>
                <FormField
                  label="ΕΤΟΣ"
                  value={year}
                  onChangeText={setYear}
                  placeholder="από κατάλογο"
                />
              </View>
              <View style={styles.half}>
                <FormField
                  label="ΕΚΔΟΣΗ"
                  value={edition}
                  onChangeText={setEdition}
                  placeholder="προαιρετικό"
                />
              </View>
            </View>

            <FormField
              label="ΚΑΤΗΓΟΡΙΑ"
              value={category}
              onChangeText={setCategory}
              placeholder="προαιρετικό"
            />

            <View style={styles.field}>
              <Text style={styles.label}>GRADE</Text>
              <View style={styles.gradeRow}>
                {GRADES.map((g) => (
                  <Text
                    key={g}
                    style={[styles.gradeChip, grade === g && styles.gradeChipActive]}
                    onPress={() => setGrade(g)}>
                    {g}
                  </Text>
                ))}
              </View>
            </View>

            <FormField
              label="ΣΗΜΕΙΩΣΕΙΣ"
              value={notes}
              onChangeText={setNotes}
              placeholder="Πηγή match, ιδιαιτερότητες…"
            />

            <Pressable
              style={[styles.saveBtn, saving && styles.btnDisabled]}
              disabled={saving}
              onPress={save}>
              <Text style={styles.saveBtnText}>
                {saving
                  ? 'Αποθήκευση…'
                  : verified
                    ? '✓ Αποθήκευση (επαληθευμένο)'
                    : '✓ Αποθήκευση'}
              </Text>
            </Pressable>

            {!verified ? (
              <Text style={styles.warnHint}>
                Διάλεξε πρόταση για να συμπληρωθούν εκδότης, έτος και επίσημο εξώφυλλο.
              </Text>
            ) : null}

            {message ? <Text style={styles.message}>{message}</Text> : null}
          </ComicBorderCard>
        </ScrollView>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    paddingHorizontal: 12,
    width: '100%',
    paddingTop: 8,
    paddingBottom: 24,
  },
  scanBanner: {
    alignSelf: 'flex-start',
    backgroundColor: theme.kirbyYellow,
    borderWidth: 2,
    borderColor: theme.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  scanBannerText: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.text,
  },
  verifiedBanner: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.kirbyBlue,
    borderWidth: 2,
    borderColor: theme.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },
  verifiedBannerText: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.surface,
  },
  form: {
    padding: 12,
    gap: 10,
    marginTop: 8,
  },
  photoRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  photoBox: {
    width: 96,
    height: 140,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.background,
    overflow: 'hidden',
  },
  photoImg: { width: '100%', height: '100%' },
  photoEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 6,
  },
  photoHint: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.textMuted,
    textAlign: 'center',
  },
  photoSub: {
    fontSize: 9,
    fontWeight: '600',
    color: theme.textMuted,
    textAlign: 'center',
  },
  photoActions: {
    flex: 1,
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  half: {
    flex: 1,
  },
  field: {
    gap: 4,
  },
  label: {
    fontSize: 9,
    fontWeight: '900',
    color: theme.textMuted,
    letterSpacing: 0.6,
  },
  input: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: '700',
    color: theme.text,
  },
  gradeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  gradeChip: {
    borderWidth: 2,
    borderColor: theme.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: theme.background,
  },
  gradeChipActive: {
    backgroundColor: theme.kirbyBlue,
    color: theme.surface,
  },
  verifyBtn: {
    backgroundColor: theme.kirbyBlue,
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyBtnText: {
    textAlign: 'center',
    color: theme.surface,
    fontSize: 12,
    fontWeight: '900',
  },
  secondaryBtn: {
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  secondaryBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.text,
    textAlign: 'center',
  },
  linkBtn: {
    paddingVertical: 2,
  },
  linkBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.kirbyMagenta,
  },
  candidates: {
    gap: 6,
    marginTop: 2,
  },
  candidatesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  candidatesTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.textMuted,
    letterSpacing: 0.5,
  },
  candidatesEmpty: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textMuted,
  },
  candidateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.background,
    padding: 6,
  },
  candidateSelected: {
    borderColor: theme.kirbyMagenta,
    backgroundColor: theme.surface,
  },
  candidateCover: {
    width: 40,
    height: 58,
    backgroundColor: theme.surface,
  },
  candidateCoverEmpty: {
    borderWidth: 1,
    borderColor: theme.border,
  },
  candidateInfo: {
    flex: 1,
    gap: 2,
  },
  candidateTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.text,
  },
  candidateMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
  },
  candidateVerified: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.kirbyBlue,
  },
  saveBtn: {
    marginTop: 6,
    backgroundColor: theme.kirbyMagenta,
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    textAlign: 'center',
    color: theme.surface,
    fontSize: 15,
    fontWeight: '900',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  warnHint: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textMuted,
    textAlign: 'center',
  },
  message: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.kirbyBlue,
    textAlign: 'center',
  },
});

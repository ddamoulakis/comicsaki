import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
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
import { useAuth } from '@/contexts/AuthProvider';
import { theme } from '@/constants/Theme';
import { getCoverScanSession, requestCoverScanReset, subscribeCoverScanSession } from '@/lib/coverScanSession';
import { isCatalogCoverUrl } from '@/lib/coverUrl';
import { isSupabaseIssueId } from '@/lib/issueId';
import { greekFormatLabel, isGreekVolumeFormat } from '@/lib/greekFormat';
import { addCollectionItem } from '@/services/supabase/collection';
import type { CoverEdition, CoverMatch } from '@/types/coverLookup';

const GRADES = ['NM', 'VF', 'FN', 'GD'];

function startNewCoverScan(router: ReturnType<typeof useRouter>) {
  requestCoverScanReset();
  router.replace('/(tabs)/add/cover');
}

function pickFields(match: CoverMatch, edition: CoverEdition) {
  const catalogCover = isCatalogCoverUrl(match.coverUrl) ? match.coverUrl : '';
  return {
    issueId: edition.issueId ?? match.issueId,
    publisher: edition.publisher || match.publisher || '',
    series: match.series || '',
    issue: match.issue === '-' ? '' : match.issue || '',
    year: edition.year || '',
    edition: edition.label || '',
    category: match.category || '',
    coverUrl: catalogCover,
    notes: [
      match.title && match.title !== match.series ? `Τίτλος: ${match.title}` : null,
      edition.notes,
      match.sourceName ? `Match: ${match.sourceName}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
  };
}

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

function MatchRow({
  match,
  edition,
  isBest,
  selected,
  fallbackPhotoUri,
  onSelect,
}: {
  match: CoverMatch;
  edition: CoverEdition;
  isBest: boolean;
  selected: boolean;
  fallbackPhotoUri?: string | null;
  onSelect: () => void;
}) {
  const confidencePct = Math.round(match.confidence * 100);
  const coverUri = match.coverUrl || fallbackPhotoUri || null;
  const formatLabel = greekFormatLabel(match.releaseFormat);

  return (
    <Pressable
      style={[styles.row, isBest && styles.bestRow, selected && styles.selectedRow]}
      onPress={onSelect}>
      {coverUri ? (
        <Image source={{ uri: coverUri }} style={styles.cover} resizeMode="cover" />
      ) : (
        <View style={[styles.cover, styles.coverPlaceholder]}>
          <Text style={styles.coverText} numberOfLines={2}>
            {match.series}
          </Text>
          <Text style={styles.coverIssue}>
            {match.issue && match.issue !== '-' ? `#${match.issue}` : ''}
          </Text>
        </View>
      )}

      <View style={styles.info}>
        {isBest ? <Text style={styles.bestLabel}>BEST MATCH</Text> : null}
        <Text style={styles.title} numberOfLines={2}>
          {match.issue && match.issue !== '-'
            ? `${match.series} #${match.issue}`
            : match.series}
        </Text>
        <Text style={styles.meta}>
          {[formatLabel, match.publisher, edition.year, edition.label && edition.label !== match.publisher ? edition.label : null]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        <View style={styles.badgeRow}>
          <Text style={styles.badge}>{confidencePct}%</Text>
          <Text style={styles.source}>{match.sourceName}</Text>
        </View>
        {selected ? (
          <Text style={styles.confirmHint}>Πάτα για αποθήκευση στη συλλογή</Text>
        ) : null}
      </View>

      <View style={styles.selectMark}>
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={28}
          color={selected ? theme.kirbyMagenta : theme.textMuted}
        />
      </View>
    </Pressable>
  );
}

export default function CoverResultsScreen() {
  const router = useRouter();
  const { user, configured } = useAuth();
  const [lookup, setLookup] = useState(() => getCoverScanSession().result);
  const photoUri = getCoverScanSession().photoUri || lookup?.photoUri;

  useEffect(() => {
    return subscribeCoverScanSession(() => {
      setLookup(getCoverScanSession().result);
    });
  }, []);

  const result = lookup;

  const allEditions = useMemo(() => {
    if (!result) return [] as { match: CoverMatch; edition: CoverEdition }[];
    const list: { match: CoverMatch; edition: CoverEdition }[] = [];
    for (const match of result.matches) {
      for (const edition of match.editions) {
        list.push({ match, edition });
      }
    }
    return list;
  }, [result]);

  const bestMatch = allEditions[0];
  const otherMatches = allEditions.slice(1);

  const initial = bestMatch ? pickFields(bestMatch.match, bestMatch.edition) : null;
  const [selectedKey, setSelectedKey] = useState(
    bestMatch ? `${bestMatch.match.id}-${bestMatch.edition.id}` : '',
  );
  const selectedMatch =
    allEditions.find(({ match, edition }) => `${match.id}-${edition.id}` === selectedKey)?.match ??
    bestMatch?.match;
  const isVolume = isGreekVolumeFormat(selectedMatch?.releaseFormat);
  const [issueId, setIssueId] = useState<string | undefined>(initial?.issueId);
  const [publisher, setPublisher] = useState(initial?.publisher ?? '');
  const [series, setSeries] = useState(initial?.series ?? '');
  const [issue, setIssue] = useState(initial?.issue ?? '');
  const [year, setYear] = useState(initial?.year ?? '');
  const [editionLabel, setEditionLabel] = useState(initial?.edition ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [catalogCoverUrl, setCatalogCoverUrl] = useState(initial?.coverUrl ?? '');
  const [grade, setGrade] = useState('NM');
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const primary = result?.matches[0];
    if (!primary?.editions[0]) return;
    const official = isCatalogCoverUrl(primary.coverUrl) ? primary.coverUrl : '';
    if (!official) return;
    const primaryKey = `${primary.id}-${primary.editions[0].id}`;
    if (selectedKey && selectedKey !== primaryKey) return;
    setCatalogCoverUrl((prev) => prev || official);
    setIssueId((prev) =>
      isSupabaseIssueId(prev)
        ? prev
        : isSupabaseIssueId(primary.issueId)
          ? primary.issueId
          : isSupabaseIssueId(primary.editions[0]?.issueId)
            ? primary.editions[0]?.issueId
            : undefined,
    );
  }, [result, selectedKey]);

  const applyPick = (match: CoverMatch, edition: CoverEdition) => {
    const fields = pickFields(match, edition);
    setSelectedKey(`${match.id}-${edition.id}`);
    setIssueId(fields.issueId);
    setPublisher(fields.publisher);
    setSeries(fields.series);
    setIssue(fields.issue);
    setYear(fields.year);
    setEditionLabel(fields.edition);
    setCategory(fields.category);
    setCatalogCoverUrl(fields.coverUrl);
    setNotes(fields.notes);
    setMessage(null);
  };

  const save = async () => {
    if (!series.trim()) {
      setMessage('Συμπλήρωσε τη σειρά.');
      return;
    }
    if (!issue.trim() || issue.trim() === '-') {
      setMessage(
        isVolume
          ? 'Συμπλήρωσε τον αριθμό τόμου (π.χ. 7).'
          : 'Συμπλήρωσε τον αριθμό τεύχους (π.χ. 30).',
      );
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
      await addCollectionItem({
        issueId: isSupabaseIssueId(issueId) ? issueId : undefined,
        series: series.trim(),
        issue: issue.trim(),
        publisher: publisher.trim(),
        category: category.trim(),
        condition: grade,
        year: year.trim() || undefined,
        notes: [editionLabel.trim(), notes.trim()].filter(Boolean).join('\n') || undefined,
        coverUrl: catalogCoverUrl || undefined,
        scanUri:
          photoUri && !/^https?:\/\//i.test(photoUri) ? photoUri : undefined,
      });
      setMessage('Αποθηκεύτηκε στη cloud συλλογή σου.');
      setTimeout(() => router.replace('/(tabs)/collection'), 500);
    } catch (error) {
      let msg = 'Άγνωστο σφάλμα';
      if (error instanceof Error) msg = error.message;
      else if (error && typeof error === 'object' && 'message' in error) {
        msg = String((error as { message: unknown }).message);
      } else if (typeof error === 'string') msg = error;
      setMessage(`Αποτυχία: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  if (!result || result.matches.length === 0) {
    return (
      <CosmicBackground variant="plasma">
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <View style={styles.content}>
            <AddScreenHeader title="ΑΠΟΤΕΛΕΣΜΑΤΑ" />
            <ComicBorderCard style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Δεν βρέθηκαν matches</Text>
              <Text style={styles.emptySub}>
                Δοκίμασε καλύτερο φωτισμό ή καταχώρησε χειροκίνητα.
              </Text>
              <Pressable style={styles.primaryBtn} onPress={() => startNewCoverScan(router)}>
                <Text style={styles.primaryBtnText}>Νέο scan</Text>
              </Pressable>
              <Pressable style={styles.secondaryBtn} onPress={() => router.push('/(tabs)/add/manual')}>
                <Text style={styles.secondaryBtnText}>Χειροκίνητα</Text>
              </Pressable>
            </ComicBorderCard>
          </View>
        </SafeAreaView>
      </CosmicBackground>
    );
  }

  return (
    <CosmicBackground variant="plasma">
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <AddScreenHeader
            title="ΑΝΑΓΝΩΡΙΣΗ"
            subtitle="Έλεγξε / διόρθωσε τα στοιχεία και αποθήκευσε."
          />

          <Text style={styles.scanHintOnly}>
            Πάτα το επιλεγμένο match για αποθήκευση στη συλλογή. Άλλο match γεμίζει τα πεδία.
          </Text>

          {bestMatch ? (
            <MatchRow
              match={bestMatch.match}
              edition={bestMatch.edition}
              isBest
              selected={selectedKey === `${bestMatch.match.id}-${bestMatch.edition.id}`}
              fallbackPhotoUri={photoUri}
              onSelect={() => {
                const key = `${bestMatch.match.id}-${bestMatch.edition.id}`;
                if (selectedKey === key) void save();
                else applyPick(bestMatch.match, bestMatch.edition);
              }}
            />
          ) : null}

          {otherMatches.length > 0 ? (
            <View style={styles.otherSection}>
              <Text style={styles.otherLabel}>ΑΛΛΕΣ ΕΠΙΛΟΓΕΣ</Text>
              {otherMatches.map(({ match, edition }) => (
                <MatchRow
                  key={`${match.id}-${edition.id}`}
                  match={match}
                  edition={edition}
                  isBest={false}
                  selected={selectedKey === `${match.id}-${edition.id}`}
                  fallbackPhotoUri={photoUri}
                  onSelect={() => {
                    const key = `${match.id}-${edition.id}`;
                    if (selectedKey === key) void save();
                    else applyPick(match, edition);
                  }}
                />
              ))}
            </View>
          ) : null}

          <View style={styles.formBanner}>
            <Text style={styles.formBannerText}>Στοιχεία — επεξεργάσιμα</Text>
          </View>

          <ComicBorderCard style={styles.form}>
            <View style={styles.formRow}>
              <View style={styles.half}>
                <FormField
                  label="ΕΚΔΟΤΗΣ"
                  value={publisher}
                  onChangeText={setPublisher}
                  placeholder="συμπλήρωσε αν λείπει"
                />
              </View>
              <View style={styles.half}>
                <FormField
                  label="ΣΕΙΡΑ"
                  value={series}
                  onChangeText={setSeries}
                  placeholder="συμπλήρωσε αν λείπει"
                />
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.half}>
                <FormField
                  label={isVolume ? 'ΤΟΜΟΣ' : 'ΤΕΥΧΟΣ'}
                  value={issue}
                  onChangeText={setIssue}
                  placeholder={isVolume ? 'π.χ. 7' : 'κενό αν δεν βρέθηκε'}
                />
              </View>
              <View style={styles.half}>
                <FormField
                  label="ΕΤΟΣ"
                  value={year}
                  onChangeText={setYear}
                  placeholder="κενό αν δεν βρέθηκε"
                />
              </View>
            </View>

            <FormField
              label="ΕΚΔΟΣΗ"
              value={editionLabel}
              onChangeText={setEditionLabel}
              placeholder="προαιρετικό"
            />

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
              style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
              onPress={save}
              disabled={saving}>
              <Text style={styles.saveBtnText}>
                {saving ? 'Αποθήκευση…' : '✓ Αποθήκευση'}
              </Text>
            </Pressable>

            {message ? <Text style={styles.message}>{message}</Text> : null}
          </ComicBorderCard>

          <Pressable
            style={styles.secondaryBtn}
            onPress={() => startNewCoverScan(router)}>
            <Text style={styles.secondaryBtnText}>Νέο scan</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => router.push('/(tabs)/add/manual')}>
            <Text style={styles.secondaryBtnText}>Χειροκίνητα</Text>
          </Pressable>
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
    paddingBottom: 28,
    gap: 12,
  },
  scanHintOnly: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textMuted,
    lineHeight: 17,
  },
  scanBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  scanThumb: {
    width: 48,
    height: 64,
    borderWidth: 2,
    borderColor: theme.border,
  },
  scanInfo: { flex: 1, gap: 3 },
  scanCount: {
    fontSize: 14,
    fontWeight: '900',
    color: theme.text,
  },
  scanHint: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textMuted,
    lineHeight: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.border,
    marginBottom: 8,
  },
  bestRow: {
    borderWidth: 3,
    borderColor: theme.kirbyMagenta,
    shadowColor: theme.border,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  selectedRow: {
    backgroundColor: '#FFF8E7',
  },
  cover: {
    width: 56,
    height: 78,
    borderWidth: 2,
    borderColor: theme.border,
  },
  coverPlaceholder: {
    backgroundColor: theme.kirbyBlue,
    padding: 3,
    justifyContent: 'space-between',
  },
  coverText: {
    fontSize: 7,
    fontWeight: '900',
    color: theme.surface,
    lineHeight: 9,
  },
  coverIssue: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.kirbyYellow,
    alignSelf: 'flex-end',
  },
  info: { flex: 1, gap: 2 },
  bestLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: theme.kirbyMagenta,
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    color: theme.text,
  },
  meta: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textMuted,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  badge: {
    fontSize: 9,
    fontWeight: '900',
    color: theme.surface,
    backgroundColor: theme.kirbyRed,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  source: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.textMuted,
  },
  confirmHint: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.kirbyMagenta,
    marginTop: 2,
  },
  selectMark: {
    padding: 2,
  },
  otherSection: {
    gap: 0,
    marginTop: 4,
  },
  otherLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.kirbyMagenta,
    letterSpacing: 1,
    marginBottom: 8,
  },
  formBanner: {
    alignSelf: 'flex-start',
    backgroundColor: theme.kirbyYellow,
    borderWidth: 2,
    borderColor: theme.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  formBannerText: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.text,
  },
  form: {
    padding: 12,
    gap: 10,
  },
  formRow: {
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
    overflow: 'hidden',
  },
  gradeChipActive: {
    backgroundColor: theme.kirbyBlue,
    color: theme.surface,
  },
  saveBtn: {
    marginTop: 6,
    backgroundColor: theme.kirbyMagenta,
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: theme.surface,
    fontSize: 15,
    fontWeight: '900',
  },
  message: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.kirbyBlue,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: theme.kirbyMagenta,
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
    paddingVertical: 13,
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
    paddingVertical: 11,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '800',
  },
  emptyCard: {
    padding: 16,
    gap: 10,
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.text,
  },
  emptySub: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textMuted,
    lineHeight: 18,
  },
});

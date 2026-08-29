import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CosmicBackground } from '@/components/comicsaki/CosmicBackground';
import { ZoomableCover } from '@/components/comicsaki/ZoomableCover';
import { theme } from '@/constants/Theme';
import { fetchCatalogIssue } from '@/services/catalog';
import { metronProxyFetch } from '@/lib/metronClient';
import { setManualAddPrefill } from '@/lib/collectionSession';
import { addCollectionItem } from '@/services/supabase/collection';

const CHAR_SIZE = 72;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyObj = Record<string, any>;

type Creator = AnyObj;
type Character = AnyObj;
type Variant = AnyObj;

type IssueDetail = {
  id: number;
  series: { id: number; name: string; volume: number; year_began?: number };
  number: string;
  cover_date: string | null;
  store_date: string | null;
  image: string | null;
  publisher?: { id: number; name: string } | null;
  price?: string | null;
  price_currency?: string | null;
  desc?: string | null;
  page_count?: number | null;
  upc?: string | null;
  sku?: string | null;
  isbn?: string | null;
  foc_date?: string | null;
  credits?: Creator[];
  characters?: Character[];
  variants?: Variant[];
  rating?: { name: string } | null;
  imprint?: { id: number; name: string } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
};

async function fetchSeriesIssues(seriesId: number): Promise<IssueDetail[]> {
  const all: IssueDetail[] = [];
  let page = 1;
  while (true) {
    const res = await metronProxyFetch('/issue/', {
      series_id: String(seriesId),
      page: String(page),
      page_size: '100',
    });
    if (!res.ok) break;
    const data = await res.json();
    const results: IssueDetail[] = data.results ?? [];
    all.push(...results);
    if (!data.next) break;
    page++;
    if (page > 8) break;
  }
  return all.sort((a, b) => Number(a.number) - Number(b.number));
}

async function fetchIssueDetail(id: string): Promise<IssueDetail> {
  return fetchCatalogIssue(id) as Promise<IssueDetail>;
}

function strVal(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object' && !Array.isArray(v)) return (v as AnyObj).name ?? '';
  if (Array.isArray(v)) return v.map(strVal).join(', ');
  return String(v);
}

const MONTHS = ['ΙΑΝ','ΦΕΒ','ΜΑΡ','ΑΠΡ','ΜΑΙ','ΙΟΥ','ΙΟΥΛ','ΑΥΓ','ΣΕΠ','ΟΚΤ','ΝΟΕ','ΔΕΚ'];
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function IssueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [issue, setIssue] = useState<IssueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inCollection, setInCollection] = useState(false);
  const [isFav, setIsFav] = useState(false);
  const [seriesIssues, setSeriesIssues] = useState<IssueDetail[]>([]);
  const [seriesModal, setSeriesModal] = useState(false);
  const [seriesLoading, setSeriesLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIssue(null);
    setLoading(true);
    setError(null);
    setSeriesIssues([]);
    fetchIssueDetail(id)
      .then((data) => {
        setIssue(data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Αποτυχία'))
      .finally(() => setLoading(false));
  }, [id]);

  const loadSeries = async (seriesId: number): Promise<IssueDetail[]> => {
    if (seriesLoading) return seriesIssues;
    setSeriesLoading(true);
    try {
      const all = await fetchSeriesIssues(seriesId);
      setSeriesIssues(all);
      return all;
    } catch {
      setSeriesIssues([]);
      return [];
    } finally {
      setSeriesLoading(false);
    }
  };

  const goAdjacent = async (dir: -1 | 1) => {
    let list = seriesIssues;
    if (list.length === 0 && issue?.series?.id) {
      list = await loadSeries(issue.series.id);
    }
    const idx = list.findIndex((s) => String(s.id) === String(id));
    const target = idx >= 0 ? list[idx + dir] : null;
    if (target) {
      router.replace({ pathname: '/(tabs)/issue-detail', params: { id: String(target.id) } });
    }
  };

  const handleAddCollection = async () => {
    if (!issue || inCollection) return;
    try {
      await addCollectionItem({
        series: issue.series.name,
        issue: issue.number,
        publisher: issue.publisher?.name ?? '',
        category: 'comic',
        condition: 'NM',
      });
      setInCollection(true);
    } catch {
      setManualAddPrefill({
        series: issue.series.name,
        issue: issue.number,
        publisher: issue.publisher?.name ?? '',
      });
      router.push('/(tabs)/add/manual');
    }
  };

  const publisherName = issue?.publisher?.name ?? '';

  // Group credits by role
  const creditsByRole: Record<string, { name: string; image?: string }[]> = {};
  issue?.credits?.forEach((c) => {
    const role = strVal(c.role) || 'Άλλο';
    const name = strVal(c.creator);
    const image = c.creator?.image ?? c.image ?? null;
    if (!creditsByRole[role]) creditsByRole[role] = [];
    if (name) creditsByRole[role].push({ name, image });
  });

  const characters: { id?: number; name: string; role: string; image?: string; alias?: string }[] =
    (issue?.characters ?? []).map((c) => ({
      id: c.character?.id ?? c.id ?? undefined,
      name: strVal(c.character ?? c.name),
      role: strVal(c.role ?? c.type ?? ''),
      image: c.character?.image ?? c.image ?? null,
      alias: strVal(c.character?.alias ?? c.alias ?? ''),
    }));

  const variants: { name: string; image?: string }[] =
    (issue?.variants ?? []).map((v) => ({
      name: strVal(v.name),
      image: v.image ?? v.cover ?? null,
    }));

  const currentIndex = seriesIssues.findIndex((s) => String(s.id) === String(id));
  const prevIssue = currentIndex > 0 ? seriesIssues[currentIndex - 1] : null;
  const nextIssue = currentIndex >= 0 && currentIndex < seriesIssues.length - 1 ? seriesIssues[currentIndex + 1] : null;

  const openSeries = () => {
    setSeriesModal(true);
    if (issue?.series?.id && seriesIssues.length === 0) {
      void loadSeries(issue.series.id);
    }
  };

  return (
    <CosmicBackground variant="void">
      {/* Series modal */}
      <Modal visible={seriesModal} transparent animationType="slide" onRequestClose={() => setSeriesModal(false)}>
        <Pressable style={styles.zoomOverlay} onPress={() => setSeriesModal(false)}>
          <View style={styles.seriesModal}>
            <View style={styles.seriesModalHeader}>
              <Text style={styles.seriesModalTitle} numberOfLines={1}>
                {issue?.series.name}
              </Text>
              <Pressable onPress={() => setSeriesModal(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={theme.text} />
              </Pressable>
            </View>
            {seriesLoading && seriesIssues.length === 0 ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={theme.kirbyMagenta} />
              </View>
            ) : seriesIssues.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.errorText}>Δεν βρέθηκαν τεύχη της σειράς.</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.seriesGrid}>
                  {seriesIssues.map((si) => {
                    const isCurrent = String(si.id) === String(id);
                    return (
                      <Pressable
                        key={si.id}
                        style={[styles.seriesCard, isCurrent && styles.seriesCardActive]}
                        onPress={() => {
                          setSeriesModal(false);
                          if (!isCurrent) router.replace({ pathname: '/(tabs)/issue-detail', params: { id: String(si.id) } });
                        }}>
                        {si.image ? (
                          <Image source={{ uri: si.image }} style={styles.seriesCardImg} resizeMode="cover" />
                        ) : (
                          <View style={[styles.seriesCardImg, styles.variantThumbPlaceholder]}>
                            <Text style={{ fontSize: 8, color: '#fff', fontWeight: '900', textAlign: 'center' }}>#{si.number}</Text>
                          </View>
                        )}
                        <Text style={[styles.seriesCardNum, isCurrent && styles.seriesCardNumActive]} numberOfLines={1}>
                          #{si.number}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Modal>

      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {issue ? `${issue.series.name} #${issue.number}` : 'Φόρτωση…'}
          </Text>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.kirbyMagenta} />
            <Text style={styles.loadingText}>Φόρτωση στοιχείων…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={40} color={theme.kirbyRed} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : issue ? (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

            {/* HERO */}
            <View style={styles.hero}>
              {/* Αριστερή στήλη: εξώφυλλο + nav */}
              <View style={styles.coverCol}>
                {issue.image ? (
                  <ZoomableCover
                    uri={issue.image}
                    style={styles.cover}
                    resizeMode="cover"
                    caption={`${issue.series.name} #${issue.number}`}
                  />
                ) : (
                  <View style={[styles.cover, styles.coverPlaceholder]}>
                    <Text style={styles.coverPlaceholderText}>{issue.series.name}</Text>
                  </View>
                )}
                {/* Nav bar */}
                <View style={styles.navBar}>
                  <Pressable
                    style={[styles.navBtn, seriesIssues.length > 0 && !prevIssue && styles.navBtnDisabled]}
                    onPress={() => void goAdjacent(-1)}
                    disabled={seriesIssues.length > 0 && !prevIssue}>
                    <Ionicons
                      name="chevron-back"
                      size={14}
                      color={seriesIssues.length > 0 && !prevIssue ? theme.textMuted : theme.text}
                    />
                    <Text style={[styles.navBtnText, seriesIssues.length > 0 && !prevIssue && styles.navBtnTextMuted]}>
                      ΠΡΟΗΓ.
                    </Text>
                  </Pressable>
                  <Pressable style={styles.navBtnSeries} onPress={openSeries}>
                    <Text style={styles.navBtnSeriesText}>ΣΕΙΡΑ</Text>
                    <Ionicons name="chevron-up" size={12} color={theme.kirbyMagenta} />
                  </Pressable>
                  <Pressable
                    style={[styles.navBtn, seriesIssues.length > 0 && !nextIssue && styles.navBtnDisabled]}
                    onPress={() => void goAdjacent(1)}
                    disabled={seriesIssues.length > 0 && !nextIssue}>
                    <Text style={[styles.navBtnText, seriesIssues.length > 0 && !nextIssue && styles.navBtnTextMuted]}>
                      ΕΠΟΜ.
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={seriesIssues.length > 0 && !nextIssue ? theme.textMuted : theme.text}
                    />
                  </Pressable>
                </View>
              </View>
              <View style={styles.heroInfo}>
                {publisherName ? (
                  <Text style={styles.publisher}>
                    {publisherName.toUpperCase()}
                    {issue.imprint?.name ? ` · ${issue.imprint.name.toUpperCase()}` : ''}
                  </Text>
                ) : null}
                <Text style={styles.issueTitle}>{issue.series.name}</Text>
                <Text style={styles.issueNumber}>#{issue.number}</Text>
                <View style={styles.divider} />
                <Text style={styles.metaText}>
                  Comic
                  {issue.page_count ? ` · ${issue.page_count} σελίδες` : ''}
                  {issue.price
                    ? ` · ${issue.price_currency === 'EUR' || issue.currency === 'EUR' ? '€' : issue.price_currency && issue.price_currency !== 'USD' ? '' : '$'}${issue.price}`
                    : ''}
                </Text>
                <View style={styles.metaRow}>
                  <Ionicons name="calendar-outline" size={12} color={theme.textMuted} />
                  <Text style={styles.metaText}>{fmtDate(issue.store_date ?? issue.cover_date)}</Text>
                </View>
                {issue.foc_date ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="flag-outline" size={12} color={theme.textMuted} />
                    <Text style={styles.metaText}>FOC {fmtDate(issue.foc_date)}</Text>
                  </View>
                ) : null}
                {issue.upc ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="barcode-outline" size={12} color={theme.textMuted} />
                    <Text style={styles.metaText}>{issue.upc}</Text>
                  </View>
                ) : null}
                {issue.sku ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="pricetag-outline" size={12} color={theme.textMuted} />
                    <Text style={styles.metaText}>{issue.sku}</Text>
                  </View>
                ) : null}
                {issue.isbn ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="book-outline" size={12} color={theme.textMuted} />
                    <Text style={styles.metaText}>{issue.isbn}</Text>
                  </View>
                ) : null}
                {issue.rating?.name ? (
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingText}>{issue.rating.name}</Text>
                  </View>
                ) : null}

                {/* VARIANTS inline */}
                {variants.length > 0 && (
                  <>
                    <View style={styles.divider} />
                    <Text style={styles.variantLabel}>VARIANTS ({variants.length})</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View style={styles.variantRow}>
                        {variants.map((v, i) =>
                          v.image ? (
                            <ZoomableCover
                              key={i}
                              uri={v.image}
                              style={styles.variantThumb}
                              imageStyle={styles.variantThumbImg}
                              resizeMode="cover"
                              caption={v.name}
                            />
                          ) : (
                            <View key={i} style={styles.variantThumb}>
                              <View style={[styles.variantThumbImg, styles.variantThumbPlaceholder]}>
                                <Text style={styles.variantThumbText} numberOfLines={3}>{v.name}</Text>
                              </View>
                            </View>
                          ),
                        )}
                      </View>
                    </ScrollView>
                  </>
                )}
              </View>{/* /heroInfo */}
            </View>{/* /hero */}

            {/* ACTIONS */}

            <View style={styles.actions}>
              <Pressable
                style={[styles.actionBtn, isFav && styles.actionBtnFavActive]}
                onPress={() => setIsFav(!isFav)}>
                <Ionicons name={isFav ? 'heart' : 'heart-outline'} size={16} color={isFav ? theme.kirbyRed : theme.text} />
                <Text style={[styles.actionBtnText, isFav && { color: theme.kirbyRed }]}>
                  {isFav ? 'Αγαπημένο' : 'Αγαπημένα'}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.actionBtn, styles.actionBtnAdd, inCollection && styles.actionBtnInCol]}
                onPress={handleAddCollection}>
                <Ionicons
                  name={inCollection ? 'checkmark-circle' : 'add-circle-outline'}
                  size={16}
                  color={inCollection ? theme.kirbyMagenta : theme.surface}
                />
                <Text style={[styles.actionBtnText, { color: inCollection ? theme.kirbyMagenta : theme.surface }]}>
                  {inCollection ? 'Στη Συλλογή' : 'Προσθήκη'}
                </Text>
              </Pressable>
            </View>

            {/* ΠΕΡΙΛΗΨΗ */}
            {issue.desc ? (
              <Section title="ΠΕΡΙΛΗΨΗ">
                <Text style={styles.desc}>{issue.desc}</Text>
              </Section>
            ) : null}

            {/* ΔΗΜΙΟΥΡΓΟΙ */}
            {Object.keys(creditsByRole).length > 0 ? (
              <Section title="ΔΗΜΙΟΥΡΓΟΙ">
                {Object.entries(creditsByRole).map(([role, people]) => (
                  <View key={role} style={styles.creditRow}>
                    <Text style={styles.creditRole}>{role}</Text>
                    <Text style={styles.creditNames}>{people.map((p) => p.name).join(', ')}</Text>
                  </View>
                ))}
              </Section>
            ) : null}

            {/* ΧΑΡΑΚΤΗΡΕΣ */}
            {characters.length > 0 ? (
              <Section title="ΧΑΡΑΚΤΗΡΕΣ">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.charRow}>
                    {characters.map((c, i) => {
                      const img = c.image;
                      return (
                      <View key={i} style={styles.charCard}>
                        {img ? (
                          <Image source={{ uri: img }} style={styles.charAvatar} resizeMode="cover" />
                        ) : (
                          <View style={[styles.charAvatar, styles.charAvatarPlaceholder]}>
                            <Text style={styles.charInitial}>{c.name.charAt(0)}</Text>
                          </View>
                        )}
                        <Text style={styles.charName} numberOfLines={2}>{c.name}</Text>
                        {c.alias ? (
                          <Text style={styles.charAlias} numberOfLines={1}>{c.alias}</Text>
                        ) : null}
                      </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </Section>
            ) : null}


          </ScrollView>
        ) : null}
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 2, borderBottomColor: theme.border,
    backgroundColor: 'rgba(244,239,224,0.92)',
    width: '100%',
  },
  backBtn: {
    padding: 4, borderWidth: 2, borderColor: theme.border, backgroundColor: theme.surface,
  },
  topBarTitle: { flex: 1, fontSize: 14, fontWeight: '900', color: theme.text, letterSpacing: 0.3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.8)' },
  errorText: { fontSize: 13, fontWeight: '800', color: theme.kirbyYellow, textAlign: 'center' },
  content: {
    paddingBottom: 40,
    width: '100%',
  },

  // Hero
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderBottomWidth: 2,
    borderBottomColor: theme.border,
  },
  cover: {
    width: '100%',
    aspectRatio: 2 / 3,
    borderWidth: 2,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  coverPlaceholder: { backgroundColor: theme.kirbyBlue, padding: 10, justifyContent: 'center', alignItems: 'center' },
  coverPlaceholderText: { fontSize: 12, fontWeight: '900', color: theme.surface, textAlign: 'center' },
  heroInfo: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    paddingTop: 2,
    paddingHorizontal: 8,
    paddingBottom: 6,
    backgroundColor: 'rgba(255,253,245,0.92)',
  },
  publisher: { fontSize: 10, fontWeight: '900', color: theme.kirbyMagenta, letterSpacing: 0.5 },
  issueTitle: { fontSize: 16, fontWeight: '900', color: theme.text, lineHeight: 20 },
  issueNumber: { fontSize: 14, fontWeight: '900', color: theme.kirbyRed },
  divider: { height: 2, backgroundColor: theme.border, marginVertical: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 11, fontWeight: '700', color: theme.textMuted },
  ratingBadge: {
    alignSelf: 'flex-start', backgroundColor: theme.kirbyYellow,
    borderWidth: 2, borderColor: theme.border, paddingHorizontal: 6, paddingVertical: 2, marginTop: 4,
  },
  ratingText: { fontSize: 10, fontWeight: '900', color: theme.text },

  // Actions
  actions: {
    flexDirection: 'row', gap: 8, padding: 12,
    borderBottomWidth: 2, borderBottomColor: theme.border,
    backgroundColor: 'rgba(255,253,245,0.92)',
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderWidth: 2, borderColor: theme.border, backgroundColor: theme.surface,
  },
  actionBtnFavActive: { borderColor: theme.kirbyRed, backgroundColor: '#fff0f0' },
  actionBtnAdd: { backgroundColor: theme.kirbyMagenta, borderColor: theme.kirbyMagenta },
  actionBtnInCol: { backgroundColor: theme.surface, borderColor: theme.kirbyMagenta },
  actionBtnText: { fontSize: 12, fontWeight: '900', color: theme.text },

  // Sections
  section: {
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: 2, borderBottomColor: theme.border, gap: 12,
    backgroundColor: 'rgba(255,253,245,0.92)',
  },
  sectionTitle: { fontSize: 11, fontWeight: '900', color: theme.kirbyMagenta, letterSpacing: 1 },
  desc: { fontSize: 13, fontWeight: '500', color: theme.text, lineHeight: 20 },

  // Creators
  creditRow: {
    flexDirection: 'row', gap: 8, alignItems: 'flex-start',
    paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: theme.border,
  },
  creditRole: {
    minWidth: 88, maxWidth: '38%', fontSize: 10, fontWeight: '900',
    color: theme.kirbyMagenta, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  creditNames: { flex: 1, fontSize: 13, fontWeight: '700', color: theme.text },

  // Characters
  charRow: { flexDirection: 'row', gap: 10, paddingBottom: 4 },
  charCard: { width: CHAR_SIZE, alignItems: 'center', gap: 4 },
  charAvatar: { width: CHAR_SIZE, height: CHAR_SIZE, borderWidth: 2, borderColor: theme.border },
  charAvatarPlaceholder: { backgroundColor: theme.kirbyBlue, justifyContent: 'center', alignItems: 'center' },
  charInitial: { fontSize: 26, fontWeight: '900', color: theme.surface },
  charName: {
    fontSize: 10,
    fontWeight: '800',
    color: theme.text,
    textAlign: 'center',
    lineHeight: 13,
    backgroundColor: 'rgba(255,253,245,0.92)',
  },
  charAlias: {
    fontSize: 9,
    fontWeight: '600',
    color: theme.textMuted,
    textAlign: 'center',
    backgroundColor: 'rgba(255,253,245,0.92)',
  },

  // Cover col — fixed width so it never forces heroInfo onto the next row
  coverCol: {
    width: 148,
    flexShrink: 0,
    alignItems: 'stretch',
  },

  // Nav bar below cover
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 2,
    borderTopColor: theme.border,
    width: '100%',
    backgroundColor: 'rgba(255,253,245,0.92)',
  },
  navBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 2, paddingVertical: 7,
    borderRightWidth: 1, borderRightColor: theme.border,
  },
  navBtnDisabled: { opacity: 0.35 },
  navBtnText: { fontSize: 9, fontWeight: '900', color: theme.text },
  navBtnTextMuted: { color: theme.textMuted },
  navBtnSeries: {
    flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 3, paddingVertical: 7,
    borderRightWidth: 1, borderRightColor: theme.border,
  },
  navBtnSeriesText: { fontSize: 10, fontWeight: '900', color: theme.kirbyMagenta },

  // Series modal
  seriesModal: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    borderWidth: 2, borderColor: theme.border,
    maxHeight: '78%',
    marginTop: 'auto',
  },
  seriesModalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14, borderBottomWidth: 2, borderBottomColor: theme.border,
  },
  seriesModalTitle: { fontSize: 15, fontWeight: '900', color: theme.text, flex: 1, marginRight: 12 },
  seriesGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 10, gap: 8 },
  seriesCard: { alignItems: 'center', gap: 4, borderWidth: 2, borderColor: theme.border, padding: 2 },
  seriesCardActive: { borderColor: theme.kirbyMagenta, backgroundColor: '#f0f0ff' },
  seriesCardImg: { width: 72, height: 108 },
  seriesCardNum: { fontSize: 10, fontWeight: '800', color: theme.textMuted },
  seriesCardNumActive: { color: theme.kirbyMagenta },

  // Variants inline in heroInfo
  variantLabel: { fontSize: 10, fontWeight: '900', color: theme.kirbyMagenta, letterSpacing: 0.5 },
  variantRow: { flexDirection: 'row', gap: 6, paddingBottom: 2 },
  variantThumb: { width: 56, height: 84, borderWidth: 2, borderColor: theme.border, overflow: 'hidden' },
  variantThumbImg: { width: '100%', height: '100%' },
  variantThumbPlaceholder: { backgroundColor: theme.kirbyBlue, justifyContent: 'center', alignItems: 'center', padding: 2 },
  variantThumbText: { fontSize: 7, fontWeight: '900', color: theme.surface, textAlign: 'center', lineHeight: 9 },

  // Series overlay
  zoomOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center', alignItems: 'center',
  },
});

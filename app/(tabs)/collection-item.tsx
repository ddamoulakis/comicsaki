import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import {
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
import { useAppViewport } from '@/hooks/useAppViewport';

export default function CollectionItemScreen() {
  const router = useRouter();
  const { width } = useAppViewport();
  const params = useLocalSearchParams<{
    series?: string;
    issue?: string;
    publisher?: string;
    category?: string;
    condition?: string;
    qty?: string;
    coverUrl?: string;
    year?: string;
    isRead?: string;
    isFavorite?: string;
    isWishlist?: string;
  }>();

  const series = params.series?.trim() || 'Άγνωστη σειρά';
  const issue = params.issue?.trim() || '-';
  const publisher = params.publisher?.trim() || '—';
  const category = params.category?.trim() || '';
  const condition = params.condition?.trim() || '—';
  const qty = params.qty?.trim() || '1';
  const coverUrl = params.coverUrl?.trim() || '';
  const year = params.year?.trim() || '';
  const flags = useMemo(
    () =>
      [
        params.isRead === '1' ? 'Διαβασμένο' : null,
        params.isFavorite === '1' ? 'Αγαπημένο' : null,
        params.isWishlist === '1' ? 'Ψάχνω' : null,
      ].filter(Boolean) as string[],
    [params.isRead, params.isFavorite, params.isWishlist],
  );

  const coverW = Math.min(width - 48, 320);
  const coverH = Math.round(coverW * 1.5);

  return (
    <CosmicBackground variant="aurora">
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {series} #{issue}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {coverUrl ? (
            <ZoomableCover
              uri={coverUrl}
              style={[styles.cover, { width: coverW, height: coverH }]}
              resizeMode="cover"
              caption={`${series} #${issue}`}
            />
          ) : (
            <View style={[styles.cover, styles.coverPlaceholder, { width: coverW, height: coverH }]}>
              <Text style={styles.coverPlaceholderText}>{series}</Text>
              <Text style={styles.coverPlaceholderNum}>#{issue}</Text>
            </View>
          )}
          {coverUrl ? (
            <Text style={styles.tapHint}>Πάτα την εικόνα για μεγέθυνση</Text>
          ) : null}

          <View style={styles.infoCard}>
            {publisher && publisher !== '—' ? (
              <Text style={styles.publisher}>{publisher.toUpperCase()}</Text>
            ) : null}
            <Text style={styles.title}>{series}</Text>
            <Text style={styles.issueNum}>#{issue}</Text>

            <View style={styles.divider} />

            <View style={styles.metaRow}>
              <Ionicons name="pricetag-outline" size={14} color={theme.textMuted} />
              <Text style={styles.metaText}>Κατάσταση: {condition}</Text>
            </View>
            {year ? (
              <View style={styles.metaRow}>
                <Ionicons name="calendar-outline" size={14} color={theme.textMuted} />
                <Text style={styles.metaText}>Έτος έκδοσης: {year}</Text>
              </View>
            ) : null}
            <View style={styles.metaRow}>
              <Ionicons name="layers-outline" size={14} color={theme.textMuted} />
              <Text style={styles.metaText}>Ποσότητα: ×{qty}</Text>
            </View>
            {category ? (
              <View style={styles.metaRow}>
                <Ionicons name="grid-outline" size={14} color={theme.textMuted} />
                <Text style={styles.metaText}>Κατηγορία: {category}</Text>
              </View>
            ) : null}

            {flags.length > 0 ? (
              <View style={styles.flagRow}>
                {flags.map((f) => (
                  <View key={f} style={styles.flagChip}>
                    <Text style={styles.flagChipText}>{f}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>

      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '900',
    color: theme.text,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    alignItems: 'center',
    gap: 12,
  },
  cover: {
    borderWidth: 3,
    borderColor: theme.border,
    backgroundColor: theme.kirbyBlue,
  },
  coverPlaceholder: {
    padding: 16,
    justifyContent: 'space-between',
  },
  coverPlaceholderText: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.surface,
  },
  coverPlaceholderNum: {
    fontSize: 28,
    fontWeight: '900',
    color: theme.kirbyYellow,
    alignSelf: 'flex-end',
  },
  tapHint: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textMuted,
  },
  infoCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.surface,
    borderWidth: 3,
    borderColor: theme.border,
    padding: 14,
    gap: 6,
  },
  publisher: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.kirbyMagenta,
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.text,
    lineHeight: 26,
  },
  issueNum: {
    fontSize: 18,
    fontWeight: '900',
    color: theme.kirbyBlue,
  },
  divider: {
    height: 2,
    backgroundColor: theme.border,
    marginVertical: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textMuted,
  },
  flagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  flagChip: {
    backgroundColor: theme.kirbyYellow,
    borderWidth: 2,
    borderColor: theme.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  flagChipText: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.text,
  },
});

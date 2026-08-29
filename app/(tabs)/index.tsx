import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { CosmicBackground } from '@/components/comicsaki/CosmicBackground';
import { CoverHScroll } from '@/components/comicsaki/CoverHScroll';
import { MenuCard } from '@/components/comicsaki/MenuCard';
import { SpeechBubble } from '@/components/comicsaki/SpeechBubble';
import { fontFamily } from '@/constants/fonts';
import { theme } from '@/constants/Theme';
import { fetchCatalogWeek, getStoreWeekRange } from '@/services/catalog';
import { useAppViewport } from '@/hooks/useAppViewport';
import { fetchRecentListings, type Listing } from '@/services/supabase/listings';
import { useCollectionData } from '@/hooks/useCollectionData';
import { collectionItemCoverUrl } from '@/lib/collectionCover';
import { isCatalogCoverUrl } from '@/lib/coverUrl';

type WeekCover = { id: number; image: string | null; name: string; storeDate: string | null };

async function fetchWeekCovers(): Promise<WeekCover[]> {
  const { after, before } = getStoreWeekRange();
  const results = await fetchCatalogWeek({ after, before, dateField: 'store' });
  const covers: WeekCover[] = results.map((i) => ({
    id: i.id,
    image: i.image ?? null,
    name: i.series?.name ?? '',
    storeDate: i.store_date ?? null,
  }));
  return covers.sort(
    (a, b) => (b.storeDate ?? '').localeCompare(a.storeDate ?? '') || a.name.localeCompare(b.name),
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { width } = useAppViewport();
  const pad = 10;
  const gap = 6;
  const coverRatio = 3 / 2;
  const thumbW = Math.max(52, Math.floor((width - pad * 2 - gap * 3) / 4));
  const thumbH = Math.floor(thumbW * coverRatio);
  const priceBarH = 40;
  const listingCardBorder = 4;
  const listingScrollH = thumbH + priceBarH + listingCardBorder;
  const compact = true;

  const { items, loading: collectionLoading } = useCollectionData();
  const [weekCovers, setWeekCovers] = useState<WeekCover[]>([]);
  const [weekCoversLoading, setWeekCoversLoading] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);

  useEffect(() => {
    fetchWeekCovers()
      .then(setWeekCovers)
      .catch(() => setWeekCovers([]))
      .finally(() => setWeekCoversLoading(false));
    fetchRecentListings(24)
      .then(setListings)
      .catch(() => setListings([]))
      .finally(() => setListingsLoading(false));
  }, []);

  const collectionThumbs = useMemo(() => items.slice(0, 24), [items]);
  const listingThumbs = useMemo(() => listings.slice(0, 24), [listings]);
  const weekThumbs = useMemo(() => weekCovers.slice(0, 24), [weekCovers]);

  return (
    <CosmicBackground>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.screen}>
          <View style={styles.logoBlock}>
            <View style={styles.logoRow}>
              <Image
                source={require('../../assets/images/logo-burst.png')}
                style={styles.logoBurst}
                resizeMode="contain"
                fadeDuration={0}
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no"
              />
              <Image
                source={require('../../assets/images/logo.png')}
                style={styles.logo}
                resizeMode="contain"
                fadeDuration={0}
                accessibilityLabel="Comicsάκι"
              />
            </View>
            <View style={styles.taglineBanner}>
              <Text style={styles.tagline}>Η συλλογή σου, οργανωμένη.</Text>
            </View>
          </View>
          <View style={[styles.menuRow, compact && styles.menuRowCompact]}>
            <View style={styles.menuHalf}>
              <MenuCard
                title="Η συλλογή μου"
                subtitle=""
                iconColor={theme.surface}
                icon="collection"
                compact
                filled
                bubbleKind="speech"
                mirror
                onPress={() => router.push('/(tabs)/collection')}
              />
            </View>
            <View style={styles.menuHalf}>
              <MenuCard
                title="Προσθήκη"
                subtitle=""
                iconColor={theme.surface}
                icon="add"
                compact
                filled
                onPress={() => router.push('/(tabs)/add')}
              />
            </View>
          </View>

          {collectionLoading || collectionThumbs.length > 0 ? (
            <View style={styles.block}>
              {collectionLoading && collectionThumbs.length === 0 ? (
                <ActivityIndicator color={theme.kirbyYellow} />
              ) : (
                <CoverHScroll height={thumbH} gap={gap}>
                  {collectionThumbs.map((item) => {
                    const cover = collectionItemCoverUrl(item);
                    return (
                    <Pressable
                      key={item.id}
                      style={[styles.thumbCard, { width: thumbW, height: thumbH }]}
                      onPress={() => router.push('/(tabs)/collection')}>
                      {isCatalogCoverUrl(cover) ? (
                        <Image
                          source={{ uri: cover }}
                          style={styles.thumbFill}
                          resizeMode="contain"
                          fadeDuration={0}
                        />
                      ) : (
                        <View style={[styles.thumbFill, styles.speedPlaceholder]}>
                          <Text style={styles.thumbLabel} numberOfLines={3}>
                            {item.series} {item.issue}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                    );
                  })}
                </CoverHScroll>
              )}
            </View>
          ) : null}

          <Pressable onPress={() => router.push('/(tabs)/listings')}>
            <SpeechBubble
              fill={theme.surface}
              ink={theme.cosmicInk}
              kind="speech"
              compact
              style={[styles.sectionBubble, compact && styles.sectionBubbleCompact]}>
              <View style={styles.sectionBubbleInner}>
                <Text style={[styles.sectionTitle, styles.sectionTitleCentered]}>Αγγελίες</Text>
                {!compact ? (
                  <Text style={[styles.sectionSub, styles.sectionTitleCentered]}>Marketplace χρηστών</Text>
                ) : null}
              </View>
            </SpeechBubble>
          </Pressable>

          <View style={[styles.block, styles.listingsBlock, { minHeight: listingScrollH }]}>
            {listingsLoading ? (
              <ActivityIndicator color={theme.kirbyOrange} />
            ) : listingThumbs.length === 0 ? (
              <Text style={styles.emptyText}>Δεν υπάρχουν ακόμα αγγελίες.</Text>
            ) : (
              <CoverHScroll height={listingScrollH} gap={gap}>
                {listingThumbs.map((item) => (
                  <Pressable
                    key={item.id}
                    style={[styles.listingCard, { width: thumbW }]}
                    onPress={() =>
                      router.push({ pathname: '/(tabs)/listings', params: { listingId: item.id } })
                    }>
                    <View style={[styles.listingCover, { height: thumbH }]}>
                      {item.cover_url ? (
                        <Image
                          source={{ uri: item.cover_url }}
                          style={styles.thumbFill}
                          resizeMode="contain"
                          fadeDuration={0}
                        />
                      ) : (
                        <View style={[styles.thumbFill, styles.listingPlaceholder]}>
                          <Text style={styles.thumbLabel} numberOfLines={3}>
                            {item.title}
                          </Text>
                        </View>
                      )}
                    </View>
                    {item.price != null ? (
                      <View style={styles.priceBar}>
                        <Text style={styles.priceText} numberOfLines={1}>
                          €{Number(item.price).toFixed(2)}
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.priceBar, styles.priceBarEmpty]} />
                    )}
                  </Pressable>
                ))}
              </CoverHScroll>
            )}
          </View>

          <Pressable onPress={() => router.push('/(tabs)/market')}>
            <SpeechBubble
              fill={theme.surface}
              ink={theme.cosmicInk}
              kind="speech"
              compact
              style={[styles.sectionBubble, compact && styles.sectionBubbleCompact]}>
              <View style={styles.sectionBubbleInner}>
                <Text style={[styles.sectionTitle, styles.sectionTitleCentered]}>Νέες Κυκλοφορίες</Text>
                {!compact ? (
                  <Text style={[styles.sectionSub, styles.sectionTitleCentered]}>Τεύχη εβδομάδας</Text>
                ) : null}
              </View>
            </SpeechBubble>
          </Pressable>

          <View style={styles.block}>
            {weekCoversLoading ? (
              <ActivityIndicator color={theme.kirbyRed} />
            ) : weekThumbs.length === 0 ? (
              <Text style={styles.emptyText}>Δεν βρέθηκαν νέες κυκλοφορίες.</Text>
            ) : (
              <CoverHScroll height={thumbH} gap={gap}>
                {weekThumbs.map((item) => (
                  <Pressable
                    key={item.id}
                    style={[styles.thumbCard, { width: thumbW, height: thumbH }]}
                    onPress={() =>
                      router.push({ pathname: '/(tabs)/issue-detail', params: { id: String(item.id) } })
                    }>
                    {item.image ? (
                      <Image
                        source={{ uri: item.image }}
                        style={styles.thumbFill}
                        resizeMode="contain"
                        fadeDuration={0}
                      />
                    ) : (
                      <View style={[styles.thumbFill, styles.coverPlaceholder]}>
                        <Text style={styles.thumbLabel} numberOfLines={3}>
                          {item.name}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </CoverHScroll>
            )}
          </View>
        </View>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  screen: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 10,
    paddingTop: 0,
    paddingBottom: 4,
    gap: 6,
    justifyContent: 'flex-start',
    overflow: 'hidden',
    minWidth: 0,
  },
  logoBlock: {
    alignSelf: 'flex-start',
    flexShrink: 0,
    gap: 2,
    marginTop: 0,
    overflow: 'visible',
  },
  logoRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    width: 154,
    height: 70,
    overflow: 'visible',
  },
  logoBurst: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 154,
    height: 70,
    zIndex: 0,
  },
  logo: {
    width: 125,
    height: 52,
    zIndex: 1,
  },
  taglineBanner: {
    alignSelf: 'flex-start',
    backgroundColor: theme.kirbyYellow,
    borderWidth: 3,
    borderColor: theme.cosmicInk,
    paddingHorizontal: 8,
    paddingVertical: 3,
    transform: [{ rotate: '-1deg' }],
  },
  tagline: {
    ...fontFamily('extrabold'),
    fontSize: 11,
    color: theme.cosmicInk,
    letterSpacing: 0.2,
  },
  menuRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'stretch',
    flexShrink: 0,
  },
  menuRowCompact: {
    maxHeight: 56,
  },
  menuHalf: { flex: 1, minWidth: 0 },
  block: {
    flexShrink: 0,
    flexGrow: 0,
    minWidth: 0,
    width: '100%',
  },
  listingsBlock: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    overflow: 'visible',
  },
  thumbCard: {
    borderWidth: 2,
    borderColor: theme.cosmicInk,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    flexShrink: 0,
    position: 'relative',
  },
  listingCard: {
    borderWidth: 2,
    borderColor: theme.cosmicInk,
    backgroundColor: theme.kirbyRed,
    flexShrink: 0,
    overflow: 'visible',
  },
  listingCover: {
    overflow: 'hidden',
    backgroundColor: theme.kirbyOrange,
  },
  thumbFill: { width: '100%', height: '100%', flexShrink: 0, pointerEvents: 'none' },
  speedPlaceholder: {
    backgroundColor: theme.kirbyRed,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  listingPlaceholder: {
    backgroundColor: theme.kirbyOrange,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  coverPlaceholder: {
    backgroundColor: theme.kirbyBlue,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  thumbLabel: {
    ...fontFamily('bold'),
    fontSize: 8,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 10,
  },
  priceBar: {
    width: '100%',
    minHeight: 32,
    backgroundColor: theme.cosmicInk,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    paddingTop: 5,
    paddingBottom: 8,
    flexShrink: 0,
    overflow: 'visible',
  },
  priceBarEmpty: {
    backgroundColor: theme.kirbyOrange,
    minHeight: 32,
  },
  priceText: {
    ...fontFamily('extrabold'),
    fontSize: 11,
    lineHeight: 18,
    color: theme.surface,
    includeFontPadding: false,
    textAlign: 'center',
  },
  sectionBubble: {
    minHeight: 44,
    width: '100%',
    flexShrink: 0,
  },
  sectionBubbleCompact: {
    minHeight: 36,
  },
  sectionBubbleInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    width: '100%',
  },
  sectionTitleCentered: {
    textAlign: 'center',
  },
  sectionTitle: {
    ...fontFamily('extrabold'),
    fontSize: 14,
    color: theme.cosmicInk,
  },
  sectionSub: {
    ...fontFamily('semibold'),
    fontSize: 10,
    color: theme.textMuted,
  },
  emptyText: {
    ...fontFamily('bold'),
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 4,
  },
});

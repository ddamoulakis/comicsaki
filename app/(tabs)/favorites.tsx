import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollectionIssueRow } from '@/components/collection/CollectionIssueRow';
import { CosmicBackground } from '@/components/comicsaki/CosmicBackground';
import { ZoomableCover } from '@/components/comicsaki/ZoomableCover';
import { ReleaseIssueCard } from '@/components/favorites/ReleaseIssueCard';
import { theme } from '@/constants/Theme';
import { useAuth } from '@/contexts/AuthProvider';
import { fetchUserCollection, updateCollectionItemFlags } from '@/services/supabase/collection';
import {
  fetchListingFavorites,
  removeListingFavorite,
  type ListingFavorite,
} from '@/services/listingFavorites';
import {
  fetchReleaseFavorites,
  groupReleaseFavorites,
  removeReleaseFavorite,
  type ReleaseFavorite,
} from '@/services/releaseFavorites';
import type { CollectionItem } from '@/types/collection';

type FavTab = 'listings' | 'releases';

export default function FavoritesScreen() {
  const router = useRouter();
  const { user, configured } = useAuth();
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [listingFavs, setListingFavs] = useState<ListingFavorite[]>([]);
  const [releaseFavs, setReleaseFavs] = useState<ReleaseFavorite[]>([]);
  const [tab, setTab] = useState<FavTab>('listings');
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'empty' | 'cloud'>('empty');

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        setLoading(true);
        try {
          const [releases, listings] = await Promise.all([
            fetchReleaseFavorites(),
            fetchListingFavorites(),
          ]);
          if (!active) return;
          setReleaseFavs(releases);
          setListingFavs(listings);
          if (listings.length === 0 && releases.length > 0) setTab('releases');
          setLoading(false);

          if (!configured || !user) {
            setItems([]);
            setSource('empty');
            return;
          }

          const data = await fetchUserCollection({ enrichCovers: false });
          if (!active) return;
          const collectionFavs = data.filter((i) => i.isFavorite);
          setItems(collectionFavs);
          setSource('cloud');
          if (listings.length + collectionFavs.length === 0 && releases.length > 0) {
            setTab('releases');
          }
        } catch {
          if (!active) return;
          setItems([]);
          setSource('empty');
          const [releases, listings] = await Promise.all([
            fetchReleaseFavorites().catch(() => []),
            fetchListingFavorites().catch(() => []),
          ]);
          setReleaseFavs(releases);
          setListingFavs(listings);
          if (listings.length === 0 && releases.length > 0) setTab('releases');
        } finally {
          if (active) setLoading(false);
        }
      }

      load();
      return () => {
        active = false;
      };
    }, [configured, user]),
  );

  const handleToggleFlag = async (
    id: string,
    flag: 'isRead' | 'isWishlist' | 'isFavorite',
    value: boolean,
  ) => {
    setItems((prev) => {
      const next = prev.map((item) => (item.id === id ? { ...item, [flag]: value } : item));
      return flag === 'isFavorite' && !value ? next.filter((item) => item.id !== id) : next;
    });

    if (source === 'cloud') {
      try {
        await updateCollectionItemFlags(id, { [flag]: value });
      } catch {
        const data = await fetchUserCollection({ enrichCovers: false }).catch(() => null);
        if (data) setItems(data.filter((i) => i.isFavorite));
      }
    }
  };

  const handleRemoveReleaseFav = async (id: number) => {
    setReleaseFavs((prev) => prev.filter((item) => item.id !== id));
    try {
      await removeReleaseFavorite(id);
    } catch {
      const releases = await fetchReleaseFavorites().catch(() => []);
      setReleaseFavs(releases);
    }
  };

  const handleRemoveListingFav = async (id: string) => {
    setListingFavs((prev) => prev.filter((item) => item.id !== id));
    try {
      await removeListingFavorite(id);
    } catch {
      const listings = await fetchListingFavorites().catch(() => []);
      setListingFavs(listings);
    }
  };

  const listingsCount = listingFavs.length + items.length;
  const tabCount = tab === 'listings' ? listingsCount : releaseFavs.length;
  const tabEmpty = tab === 'listings' ? listingsCount === 0 : releaseFavs.length === 0;
  const releaseGroups = useMemo(() => groupReleaseFavorites(releaseFavs), [releaseFavs]);

  const openIssue = (id: number) => {
    router.push({ pathname: '/(tabs)/issue-detail', params: { id: String(id) } });
  };

  const openSeries = (key: string, name: string) => {
    router.push({
      pathname: '/(tabs)/favorite-series',
      params: { seriesKey: key, name },
    });
  };

  return (
    <CosmicBackground variant="ion">
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Αγαπημένα</Text>
            <Text style={styles.sub}>{tabCount} τεύχη</Text>
          </View>
          <Ionicons name="heart" size={22} color={theme.kirbyRed} />
        </View>

        <View style={styles.segmentWrap}>
          <View style={styles.langSegment}>
            <Pressable
              style={[styles.langSegBtn, tab === 'listings' && styles.langSegBtnActive]}
              onPress={() => setTab('listings')}>
              <View style={[styles.langLamp, tab === 'listings' && styles.langLampOn]} />
              <Text style={[styles.langSegText, tab === 'listings' && styles.langSegTextActive]}>
                Αγγελίες
              </Text>
            </Pressable>
            <View style={styles.langSegDivider} />
            <Pressable
              style={[styles.langSegBtn, tab === 'releases' && styles.langSegBtnActive]}
              onPress={() => setTab('releases')}>
              <View style={[styles.langLamp, tab === 'releases' && styles.langLampOn]} />
              <Text style={[styles.langSegText, tab === 'releases' && styles.langSegTextActive]}>
                Κυκλοφορίες
              </Text>
            </Pressable>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.kirbyMagenta} />
          </View>
        ) : tabEmpty ? (
          <View style={styles.center}>
            <Ionicons name="heart-outline" size={48} color={theme.textMuted} />
            <Text style={styles.emptyTitle}>
              {tab === 'listings' ? 'Δεν έχεις αγαπημένες αγγελίες' : 'Δεν έχεις αγαπημένες κυκλοφορίες'}
            </Text>
            <Text style={styles.emptyText}>
              {tab === 'listings'
                ? 'Πάτα την καρδιά σε μια αγγελία για να εμφανιστεί εδώ.'
                : 'Πάτα την καρδιά στις νέες κυκλοφορίες για να εμφανιστούν εδώ.'}
            </Text>
            <Pressable
              style={styles.goCollectionBtn}
              onPress={() => router.push(tab === 'listings' ? '/(tabs)/listings' : '/(tabs)/market')}>
              <Text style={styles.goCollectionText}>
                {tab === 'listings' ? 'Αγγελίες' : 'Κυκλοφορίες'}
              </Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {tab === 'releases' ? (
              <>
                <Text style={styles.sectionTitle}>Κυκλοφορίες ({releaseFavs.length})</Text>
                {releaseGroups.map((group) => {
                  if (group.issues.length === 1) {
                    const item = group.issues[0];
                    return (
                      <ReleaseIssueCard
                        key={`release-${item.id}`}
                        item={item}
                        onOpen={() => openIssue(item.id)}
                        onUnfav={() => handleRemoveReleaseFav(item.id)}
                      />
                    );
                  }
                  const cover = group.issues.find((i) => i.coverUrl)?.coverUrl ?? null;
                  const latest = group.issues[0];
                  return (
                    <View key={`series-${group.key}`} style={styles.releaseCard}>
                      {cover ? (
                        <ZoomableCover
                          uri={cover}
                          style={styles.releaseCover}
                          resizeMode="cover"
                          caption={`${group.name} (${group.issues.length})`}
                        />
                      ) : (
                        <Pressable onPress={() => openSeries(group.key, group.name)}>
                          <View style={[styles.releaseCover, styles.releaseCoverPlaceholder]}>
                            <Ionicons name="library-outline" size={22} color={theme.textMuted} />
                          </View>
                        </Pressable>
                      )}
                      <Pressable
                        style={styles.releaseBody}
                        onPress={() => openSeries(group.key, group.name)}>
                        <Text style={styles.releaseTitle} numberOfLines={2}>
                          {group.name}
                        </Text>
                        <Text style={styles.releaseMeta}>
                          {group.issues.length} τεύχη
                          {latest?.number ? ` · #${latest.number}` : ''}
                        </Text>
                      </Pressable>
                      <Pressable
                        style={styles.releaseHeart}
                        onPress={() => openSeries(group.key, group.name)}
                        hitSlop={8}
                        accessibilityLabel={`Άνοιγμα ${group.name}`}>
                        <Ionicons name="chevron-forward" size={20} color={theme.text} />
                      </Pressable>
                    </View>
                  );
                })}
              </>
            ) : (
              <>
                {listingFavs.length > 0 ? (
                  <>
                    <Text style={styles.sectionTitle}>Αγγελίες ({listingFavs.length})</Text>
                    {listingFavs.map((item) => (
                      <View key={`listing-${item.id}`} style={styles.releaseCard}>
                        {item.coverUrl ? (
                          <ZoomableCover
                            uri={item.coverUrl}
                            style={styles.releaseCover}
                            resizeMode="cover"
                            caption={item.title}
                          />
                        ) : (
                          <Pressable
                            onPress={() =>
                              router.push({
                                pathname: '/(tabs)/listings',
                                params: { listingId: item.id },
                              })
                            }>
                            <View style={[styles.releaseCover, styles.releaseCoverPlaceholder]}>
                              <Ionicons name="image-outline" size={22} color={theme.textMuted} />
                            </View>
                          </Pressable>
                        )}
                        <Pressable
                          style={styles.releaseBody}
                          onPress={() =>
                            router.push({
                              pathname: '/(tabs)/listings',
                              params: { listingId: item.id },
                            })
                          }>
                          <Text style={styles.releaseTitle} numberOfLines={2}>
                            {item.title}
                          </Text>
                          <Text style={styles.releaseMeta}>{item.condition}</Text>
                          {item.price != null ? (
                            <Text style={styles.releaseMeta}>€{item.price.toFixed(2)}</Text>
                          ) : null}
                        </Pressable>
                        <Pressable
                          style={styles.releaseHeart}
                          onPress={() => handleRemoveListingFav(item.id)}
                          hitSlop={8}>
                          <Ionicons name="heart" size={20} color={theme.kirbyRed} />
                        </Pressable>
                      </View>
                    ))}
                  </>
                ) : null}

                {items.length > 0 ? (
                  <>
                    <Text style={styles.sectionTitle}>Συλλογή ({items.length})</Text>
                    {source === 'empty' && configured && !user ? (
                      <Text style={styles.banner}>Συνδέσου για αγαπημένα συλλογής.</Text>
                    ) : null}
                    {items.map((item) => (
                      <CollectionIssueRow key={item.id} item={item} onToggleFlag={handleToggleFlag} />
                    ))}
                  </>
                ) : null}
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: theme.border,
    backgroundColor: 'rgba(244,239,224,0.92)',
    width: '100%',
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.background,
  },
  headerText: { flex: 1 },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: theme.text,
  },
  sub: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textMuted,
  },
  segmentWrap: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: '100%',
  },
  langSegment: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'flex-start',
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  langSegBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.surface,
  },
  langSegBtnActive: {
    backgroundColor: '#fff8e0',
  },
  langSegDivider: {
    width: 2,
    backgroundColor: theme.border,
  },
  langLamp: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#c8c4b8',
    borderWidth: 1,
    borderColor: theme.border,
  },
  langLampOn: {
    backgroundColor: '#3DDC84',
    borderColor: '#1a9a4a',
  },
  langSegText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textMuted,
  },
  langSegTextActive: {
    color: theme.text,
    fontWeight: '900',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: theme.kirbyYellow,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 18,
  },
  goCollectionBtn: {
    marginTop: 8,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.kirbyMagenta,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  goCollectionText: {
    fontSize: 13,
    fontWeight: '900',
    color: theme.surface,
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 24,
    gap: 10,
    width: '100%',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: theme.kirbyYellow,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  banner: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.kirbyBlue,
  },
  releaseCard: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: 10,
    alignItems: 'center',
  },
  releaseCover: {
    width: 56,
    height: 84,
    borderWidth: 1,
    borderColor: theme.border,
  },
  releaseCoverPlaceholder: {
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  releaseBody: {
    flex: 1,
    gap: 2,
  },
  releaseTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: theme.text,
  },
  releaseMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textMuted,
  },
  releaseHeart: {
    padding: 6,
  },
});

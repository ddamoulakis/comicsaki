import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollectionBrowseTabs } from '@/components/collection/CollectionBrowseTabs';
import { CollectionGroupRow } from '@/components/collection/CollectionGroupRow';
import { CollectionIssueRow } from '@/components/collection/CollectionIssueRow';
import { CollectionSeriesRow } from '@/components/collection/CollectionSeriesRow';
import { CollectionStats } from '@/components/collection/CollectionStats';
import { CosmicBackground } from '@/components/comicsaki/CosmicBackground';
import { CoverHScroll } from '@/components/comicsaki/CoverHScroll';
import { KirbyText } from '@/components/comicsaki/KirbyText';
import { useAuth } from '@/contexts/AuthProvider';
import { openCollectionItem } from '@/lib/openCollectionItem';
import { fetchUserCollection, deleteCollectionItem, updateCollectionItemFlags, enrichMissingOfficialCovers } from '@/services/supabase/collection';
import { theme } from '@/constants/Theme';
import {
  filterCollection,
  groupCollection,
  groupCollectionItemsByTitle,
  type CollectionBrowseTab,
  type CollectionItem,
  type CollectionTitleGroup,
} from '@/types/collection';

type CollectionListRow =
  | { type: 'issue'; key: string; item: CollectionItem }
  | { type: 'series'; key: string; group: CollectionTitleGroup };

export default function CollectionScreen() {
  const router = useRouter();
  const { user, configured } = useAuth();
  const [browseTab, setBrowseTab] = useState<CollectionBrowseTab>('publisher');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'empty' | 'cloud' | 'error'>('empty');
  const [loadError, setLoadError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        if (!configured || !user) {
          if (active) {
            setItems([]);
            setSource('empty');
            setLoadError(null);
            setLoading(false);
          }
          return;
        }

        if (itemsRef.current.length === 0) setLoading(true);
        setLoadError(null);
        try {
          const data = await fetchUserCollection({ enrichCovers: false });
          if (active) {
            setItems(data);
            setSource('cloud');
          }
          void enrichMissingOfficialCovers(data, (next) => {
            if (!active) return;
            setItems((prev) => {
              const covers = new Map(next.map((i) => [i.id, i.coverUrl]));
              return prev.map((item) => {
                const cover = covers.get(item.id);
                return cover && cover !== item.coverUrl ? { ...item, coverUrl: cover } : item;
              });
            });
          });
        } catch (e) {
          if (active) {
            setSource('error');
            const msg =
              e instanceof Error
                ? e.message
                : e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string'
                  ? (e as { message: string }).message
                  : 'Αποτυχία φόρτωσης συλλογής';
            setLoadError(msg);
          }
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

  const groups = groupCollection(items, browseTab);
  const visibleItems = filterCollection(items, browseTab, selectedGroup);
  const listRows = useMemo((): CollectionListRow[] => {
    const showUngrouped = browseTab === 'title' && selectedGroup != null;
    if (showUngrouped) {
      return visibleItems.map((item) => ({ type: 'issue' as const, key: item.id, item }));
    }
    return groupCollectionItemsByTitle(visibleItems).flatMap((group) =>
      group.issues.length === 1
        ? [{ type: 'issue' as const, key: group.issues[0].id, item: group.issues[0] }]
        : [{ type: 'series' as const, key: group.key, group }],
    );
  }, [browseTab, selectedGroup, visibleItems]);

  const handleTabChange = (tab: CollectionBrowseTab) => {
    setBrowseTab(tab);
    setSelectedGroup(null);
  };

  const handleToggleFlag = async (id: string, flag: 'isRead' | 'isWishlist' | 'isFavorite', value: boolean) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [flag]: value } : item)));
    if (source === 'cloud') {
      try {
        await updateCollectionItemFlags(id, { [flag]: value });
      } catch {
        setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [flag]: !value } : item)));
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCollectionItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Άγνωστο σφάλμα.';
      if (Platform.OS === 'web') {
        window.alert(`Αποτυχία διαγραφής: ${msg}`);
      } else {
        const { Alert } = await import('react-native');
        Alert.alert('Αποτυχία διαγραφής', msg);
      }
    }
  };

  const openItem = (item: CollectionItem) => {
    void openCollectionItem(router, item);
  };

  const openSeries = (group: CollectionTitleGroup) => {
    router.push({
      pathname: '/(tabs)/collection-series',
      params: { seriesKey: group.key, name: group.name },
    });
  };

  const statusBanner =
    source === 'empty' && (!configured || !user)
      ? configured && !user
        ? 'Συνδέσου για να δεις τη συλλογή σου.'
        : 'Ρύθμισε Supabase (.env) για cloud συλλογή.'
      : source === 'error'
        ? `Σφάλμα: ${loadError || 'άγνωστο'}`
        : items.length === 0
          ? 'Η συλλογή είναι άδεια.'
          : null;

  return (
    <CosmicBackground variant="aurora">
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.screen}>
          <View style={styles.headingRow}>
            <KirbyText variant="title" style={styles.heading} color={theme.kirbyYellow}>
              Η ΣΥΛΛΟΓΗ ΜΟΥ
            </KirbyText>
            <View style={styles.headingActions}>
              {loading ? <ActivityIndicator color={theme.kirbyRed} /> : null}
              <Pressable style={styles.addBtn} onPress={() => router.push('/(tabs)/add')}>
                <Ionicons name="add" size={20} color={theme.surface} />
              </Pressable>
            </View>
          </View>

          {statusBanner ? <Text style={styles.banner}>{statusBanner}</Text> : null}
          {!statusBanner && items.length > 0 ? (
            <Text style={styles.cloudBanner}>{items.length} τεύχη</Text>
          ) : null}

          <CollectionStats items={items} />

          <CollectionBrowseTabs activeTab={browseTab} onChange={handleTabChange} />

          <View style={styles.split}>
            <View style={styles.groupsRow}>
              <CoverHScroll height={48} gap={6}>
                <CollectionGroupRow
                  name="Όλα"
                  count={items.length}
                  countLabel="σύνολο"
                  selected={selectedGroup === null}
                  onPress={() => setSelectedGroup(null)}
                />
                {groups.map((group) => (
                  <CollectionGroupRow
                    key={group.name}
                    name={group.name}
                    count={group.count}
                    selected={selectedGroup === group.name}
                    onPress={() => setSelectedGroup(group.name)}
                  />
                ))}
              </CoverHScroll>
            </View>
            <View style={styles.issuesPane}>
              <FlatList
                data={listRows}
                keyExtractor={(row) => row.key}
                showsVerticalScrollIndicator={false}
                style={styles.flex}
                ListEmptyComponent={<Text style={styles.empty}>Κανένα τεύχος.</Text>}
                renderItem={({ item: row }) =>
                  row.type === 'series' ? (
                    <CollectionSeriesRow group={row.group} onPress={() => openSeries(row.group)} />
                  ) : (
                    <CollectionIssueRow
                      item={row.item}
                      onPress={openItem}
                      onDelete={source === 'cloud' ? handleDelete : undefined}
                      onToggleFlag={handleToggleFlag}
                    />
                  )
                }
                ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
              />
            </View>
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
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 4,
    gap: 6,
    width: '100%',
    overflow: 'hidden',
  },
  flex: { flex: 1 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  headingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addBtn: {
    width: 36,
    height: 36,
    backgroundColor: theme.kirbyMagenta,
    borderWidth: 2,
    borderColor: theme.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heading: {
    marginBottom: 0,
    fontSize: 18,
  },
  banner: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textMuted,
    backgroundColor: theme.kirbyYellow,
    borderWidth: 2,
    borderColor: theme.border,
    padding: 6,
    flexShrink: 0,
  },
  cloudBanner: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.surface,
    backgroundColor: theme.kirbyBlue,
    borderWidth: 2,
    borderColor: theme.border,
    padding: 6,
    flexShrink: 0,
  },
  split: {
    flex: 1,
    flexDirection: 'column',
    gap: 8,
    minHeight: 0,
    minWidth: 0,
  },
  groupsRow: {
    flexShrink: 0,
    width: '100%',
    minWidth: 0,
  },
  issuesPane: {
    flex: 1,
    minWidth: 0,
    minHeight: 0,
  },
  empty: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: theme.textMuted,
    paddingVertical: 12,
  },
});

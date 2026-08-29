import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollectionIssueRow } from '@/components/collection/CollectionIssueRow';
import { CosmicBackground } from '@/components/comicsaki/CosmicBackground';
import { theme } from '@/constants/Theme';
import { openCollectionItem } from '@/lib/openCollectionItem';
import {
  deleteCollectionItem,
  fetchUserCollection,
  updateCollectionItemFlags,
} from '@/services/supabase/collection';
import {
  groupCollectionItemsByTitle,
  type CollectionItem,
} from '@/types/collection';

export default function CollectionSeriesScreen() {
  const router = useRouter();
  const { seriesKey, name } = useLocalSearchParams<{ seriesKey?: string; name?: string }>();
  const key = (Array.isArray(seriesKey) ? seriesKey[0] : seriesKey)?.trim() ?? '';
  const titleHint = (Array.isArray(name) ? name[0] : name)?.trim() ?? '';

  const [issues, setIssues] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cloud, setCloud] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      void fetchUserCollection({ enrichCovers: false })
        .then((all) => {
          if (!active) return;
          const group = groupCollectionItemsByTitle(all).find((g) => g.key === key);
          setIssues(group?.issues ?? []);
          setCloud(true);
          setLoading(false);
        })
        .catch(() => {
          if (!active) return;
          setIssues([]);
          setCloud(false);
          setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [key]),
  );

  const seriesName = useMemo(() => titleHint || issues[0]?.series || 'Σειρά', [titleHint, issues]);

  const handleToggleFlag = async (
    id: string,
    flag: 'isRead' | 'isWishlist' | 'isFavorite',
    value: boolean,
  ) => {
    setIssues((prev) => prev.map((item) => (item.id === id ? { ...item, [flag]: value } : item)));
    if (!cloud) return;
    try {
      await updateCollectionItemFlags(id, { [flag]: value });
    } catch {
      setIssues((prev) => prev.map((item) => (item.id === id ? { ...item, [flag]: !value } : item)));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCollectionItem(id);
      const next = issues.filter((item) => item.id !== id);
      setIssues(next);
      if (next.length === 0) router.back();
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

  return (
    <CosmicBackground variant="aurora">
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>
              {seriesName}
            </Text>
            <Text style={styles.sub}>
              {issues.length} {issues.length === 1 ? 'τεύχος' : 'τεύχη'}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.kirbyMagenta} />
          </View>
        ) : issues.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.empty}>Δεν υπάρχουν τεύχη γι’ αυτή τη σειρά.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {issues.map((item) => (
              <CollectionIssueRow
                key={item.id}
                item={item}
                onPress={(row) => void openCollectionItem(router, row)}
                onDelete={cloud ? handleDelete : undefined}
                onToggleFlag={handleToggleFlag}
              />
            ))}
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
  headerText: { flex: 1, minWidth: 0 },
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  empty: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.kirbyYellow,
    textAlign: 'center',
  },
  list: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 6,
    width: '100%',
  },
});

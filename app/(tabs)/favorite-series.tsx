import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CosmicBackground } from '@/components/comicsaki/CosmicBackground';
import { ReleaseIssueCard } from '@/components/favorites/ReleaseIssueCard';
import { theme } from '@/constants/Theme';
import {
  fetchReleaseFavorites,
  groupReleaseFavorites,
  removeReleaseFavorite,
  type ReleaseFavorite,
} from '@/services/releaseFavorites';

export default function FavoriteSeriesScreen() {
  const router = useRouter();
  const { seriesKey, name } = useLocalSearchParams<{ seriesKey?: string; name?: string }>();
  const key = (Array.isArray(seriesKey) ? seriesKey[0] : seriesKey)?.trim() ?? '';
  const titleHint = (Array.isArray(name) ? name[0] : name)?.trim() ?? '';

  const [issues, setIssues] = useState<ReleaseFavorite[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      void fetchReleaseFavorites()
        .catch(() => [] as ReleaseFavorite[])
        .then((all) => {
          if (!active) return;
          const group = groupReleaseFavorites(all).find((g) => g.key === key);
          setIssues(group?.issues ?? []);
          setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [key]),
  );

  const seriesName = useMemo(() => {
    return titleHint || issues[0]?.seriesName || 'Σειρά';
  }, [titleHint, issues]);

  const handleRemove = async (id: number) => {
    const next = issues.filter((item) => item.id !== id);
    setIssues(next);
    try {
      await removeReleaseFavorite(id);
    } catch {
      const all = await fetchReleaseFavorites().catch(() => []);
      const group = groupReleaseFavorites(all).find((g) => g.key === key);
      setIssues(group?.issues ?? []);
      return;
    }
    if (next.length === 0) router.back();
  };

  return (
    <CosmicBackground variant="ion">
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
            <Text style={styles.empty}>Δεν υπάρχουν αγαπημένα τεύχη γι’ αυτή τη σειρά.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {issues.map((item) => (
              <ReleaseIssueCard
                key={item.id}
                item={item}
                onOpen={() =>
                  router.push({ pathname: '/(tabs)/issue-detail', params: { id: String(item.id) } })
                }
                onUnfav={() => handleRemove(item.id)}
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
    gap: 10,
    width: '100%',
  },
});

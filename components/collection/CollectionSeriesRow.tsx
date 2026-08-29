import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';

import { ComicBorderCard } from '@/components/comicsaki/ComicBorderCard';
import { ZoomableCover } from '@/components/comicsaki/ZoomableCover';
import { collectionItemCoverUrl } from '@/lib/collectionCover';
import type { CollectionTitleGroup } from '@/types/collection';
import { theme } from '@/constants/Theme';

export function CollectionSeriesRow({
  group,
  onPress,
}: {
  group: CollectionTitleGroup;
  onPress: () => void;
}) {
  const [coverFailed, setCoverFailed] = useState(false);
  const cover = group.issues.map(collectionItemCoverUrl).find(Boolean);
  const latest = group.issues[0];

  useEffect(() => {
    setCoverFailed(false);
  }, [cover]);

  return (
    <ComicBorderCard style={styles.card}>
      <View style={styles.row}>
        {cover && !coverFailed ? (
          <ZoomableCover
            uri={cover}
            style={styles.cover}
            imageStyle={styles.coverImage}
            resizeMode="cover"
            caption={`${group.name} (${group.issues.length})`}
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <Pressable style={styles.cover} onPress={onPress}>
            <Text style={styles.coverSeries} numberOfLines={3}>
              {group.name}
            </Text>
            <Text style={styles.coverIssue}>{group.issues.length}</Text>
          </Pressable>
        )}
        <Pressable style={styles.right} onPress={onPress}>
          <View style={styles.details}>
            <Text style={styles.title} numberOfLines={2}>
              {group.name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {group.issues.length} τεύχη
              {latest?.issue ? ` · #${latest.issue}` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.text} />
        </Pressable>
      </View>
    </ComicBorderCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 0,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 96,
  },
  cover: {
    width: 68,
    alignSelf: 'stretch',
    backgroundColor: theme.kirbyBlue,
    borderRightWidth: 2,
    borderRightColor: theme.border,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  coverImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  coverSeries: {
    fontSize: 7,
    fontWeight: '900',
    color: theme.surface,
    lineHeight: 9,
    padding: 4,
  },
  coverIssue: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.kirbyYellow,
    alignSelf: 'flex-end',
    padding: 4,
  },
  right: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  details: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '900',
    color: theme.text,
    lineHeight: 16,
  },
  meta: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textMuted,
  },
});

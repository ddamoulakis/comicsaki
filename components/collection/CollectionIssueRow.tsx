import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ComicBorderCard } from '@/components/comicsaki/ComicBorderCard';
import { ZoomableCover } from '@/components/comicsaki/ZoomableCover';
import { collectionItemCoverUrl } from '@/lib/collectionCover';
import type { CollectionItem } from '@/types/collection';
import { theme } from '@/constants/Theme';

type CollectionIssueRowProps = {
  item: CollectionItem;
  onPress?: (item: CollectionItem) => void;
  onDelete?: (id: string) => Promise<void>;
  onToggleFlag?: (id: string, flag: 'isRead' | 'isWishlist' | 'isFavorite', value: boolean) => Promise<void>;
};

export function CollectionIssueRow({ item, onPress, onDelete, onToggleFlag }: CollectionIssueRowProps) {
  const [deleting, setDeleting] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const coverUrl = collectionItemCoverUrl(item);

  useEffect(() => {
    setCoverFailed(false);
  }, [coverUrl]);

  const handleDelete = async () => {
    if (!onDelete) return;

    const msg = `Διαγραφή "${item.series} #${item.issue}" από τη συλλογή σου;`;

    if (Platform.OS === 'web') {
      if (!window.confirm(msg)) return;
    } else {
      const { Alert } = await import('react-native');
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert('Διαγραφή τεύχους', msg, [
          { text: 'Άκυρο', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Διαγραφή', style: 'destructive', onPress: () => resolve(true) },
        ]);
      });
      if (!confirmed) return;
    }

    setDeleting(true);
    try {
      await onDelete(item.id);
    } finally {
      setDeleting(false);
    }
  };

  const showActions = Boolean(onToggleFlag || onDelete);

  return (
    <ComicBorderCard style={styles.card}>
      <View style={styles.row}>
        {coverUrl && !coverFailed ? (
          <ZoomableCover
            uri={coverUrl}
            style={styles.cover}
            imageStyle={styles.coverImage}
            resizeMode="cover"
            caption={`${item.series} #${item.issue}`}
            onError={() => setCoverFailed(true)}
          />
        ) : (
          <Pressable style={styles.cover} onPress={() => onPress?.(item)} disabled={!onPress}>
            <Text style={styles.coverSeries} numberOfLines={3}>
              {item.series}
            </Text>
            <Text style={styles.coverIssue}>#{item.issue}</Text>
          </Pressable>
        )}

        <View style={styles.right}>
          <Pressable style={styles.details} onPress={() => onPress?.(item)} disabled={!onPress}>
            <Text style={styles.title} numberOfLines={2}>
              {item.series}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {item.publisher} · #{item.issue}
              {item.year ? ` · ${item.year}` : ''}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {item.condition} · ×{item.qty}
            </Text>
          </Pressable>

          {showActions ? (
            <View style={styles.actions}>
              {onToggleFlag ? (
                <>
                  <Pressable
                    style={[styles.iconBtn, item.isFavorite && styles.iconBtnFav]}
                    onPress={() => onToggleFlag(item.id, 'isFavorite', !item.isFavorite)}
                    hitSlop={6}
                    accessibilityLabel="Αγαπημένα">
                    <Ionicons
                      name={item.isFavorite ? 'heart' : 'heart-outline'}
                      size={15}
                      color={item.isFavorite ? theme.kirbyRed : theme.cosmicInk}
                    />
                  </Pressable>
                  <Pressable
                    style={[styles.iconBtn, item.isWishlist && styles.iconBtnWant]}
                    onPress={() => onToggleFlag(item.id, 'isWishlist', !item.isWishlist)}
                    hitSlop={6}
                    accessibilityLabel="Ψάχνω">
                    <Ionicons
                      name={item.isWishlist ? 'search' : 'search-outline'}
                      size={15}
                      color={item.isWishlist ? theme.kirbyOrange : theme.cosmicInk}
                    />
                  </Pressable>
                  <Pressable
                    style={[styles.iconBtn, item.isRead && styles.iconBtnRead]}
                    onPress={() => onToggleFlag(item.id, 'isRead', !item.isRead)}
                    hitSlop={6}
                    accessibilityLabel="Διαβασμένο">
                    <Ionicons
                      name={item.isRead ? 'book' : 'book-outline'}
                      size={15}
                      color={item.isRead ? theme.kirbyMagenta : theme.cosmicInk}
                    />
                  </Pressable>
                </>
              ) : null}
              {onDelete ? (
                <Pressable
                  style={styles.iconBtn}
                  onPress={handleDelete}
                  disabled={deleting}
                  hitSlop={6}
                  accessibilityLabel="Διαγραφή">
                  {deleting ? (
                    <ActivityIndicator size="small" color={theme.kirbyRed} />
                  ) : (
                    <Ionicons name="trash-outline" size={15} color={theme.kirbyRed} />
                  )}
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
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
    justifyContent: 'space-between',
    gap: 6,
  },
  details: {
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
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  iconBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  iconBtnFav: {
    borderColor: theme.kirbyRed,
    backgroundColor: '#ffe8ec',
  },
  iconBtnWant: {
    borderColor: theme.kirbyOrange,
    backgroundColor: '#fff0e0',
  },
  iconBtnRead: {
    borderColor: theme.kirbyMagenta,
    backgroundColor: theme.kirbyYellow,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ZoomableCover } from '@/components/comicsaki/ZoomableCover';
import { theme } from '@/constants/Theme';
import type { ReleaseFavorite } from '@/services/releaseFavorites';

export function ReleaseIssueCard({
  item,
  onOpen,
  onUnfav,
}: {
  item: ReleaseFavorite;
  onOpen: () => void;
  onUnfav: () => void;
}) {
  return (
    <View style={styles.card}>
      {item.coverUrl ? (
        <ZoomableCover
          uri={item.coverUrl}
          style={styles.cover}
          resizeMode="cover"
          caption={`${item.seriesName} #${item.number}`}
        />
      ) : (
        <Pressable onPress={onOpen}>
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Ionicons name="image-outline" size={22} color={theme.textMuted} />
          </View>
        </Pressable>
      )}
      <Pressable style={styles.body} onPress={onOpen}>
        <Text style={styles.title} numberOfLines={2}>
          {item.seriesName} #{item.number}
        </Text>
        <Text style={styles.meta}>{item.publisher}</Text>
        {item.storeDate ? (
          <Text style={styles.meta}>{new Date(item.storeDate).toLocaleDateString('el-GR')}</Text>
        ) : null}
      </Pressable>
      <Pressable style={styles.heart} onPress={onUnfav} hitSlop={8} accessibilityLabel="Αφαίρεση από αγαπημένα">
        <Ionicons name="heart" size={20} color={theme.kirbyRed} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 12,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: theme.surface,
    padding: 10,
    alignItems: 'center',
  },
  cover: {
    width: 56,
    height: 84,
    borderWidth: 1,
    borderColor: theme.border,
  },
  coverPlaceholder: {
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    fontWeight: '900',
    color: theme.text,
  },
  meta: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textMuted,
  },
  heart: {
    padding: 6,
  },
});

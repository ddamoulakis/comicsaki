import { StyleSheet, Text, View, Pressable } from 'react-native';
import { theme } from '@/constants/Theme';
import { useAppViewport } from '@/hooks/useAppViewport';
import type { CollectionItem } from '@/types/collection';

type StatCardProps = {
  label: string;
  count: number;
  accent: string;
  active?: boolean;
  onPress?: () => void;
  compact?: boolean;
};

function StatCard({ label, count, accent, active, onPress, compact }: StatCardProps) {
  return (
    <Pressable
      style={[styles.card, compact && styles.cardCompact, active && { borderColor: accent, borderWidth: 3 }]}
      onPress={onPress}>
      <View style={[styles.bar, { backgroundColor: accent }]} />
      <Text style={[styles.count, compact && styles.countCompact, active && { color: accent }]}>{count}</Text>
      <Text style={[styles.label, compact && styles.labelCompact]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

type CollectionStatsProps = {
  items: CollectionItem[];
};

export function CollectionStats({ items }: CollectionStatsProps) {
  const { width } = useAppViewport();
  const compact = width < 380;
  const total = items.length;
  const read = items.filter((i) => i.isRead).length;
  const wishlist = items.filter((i) => i.isWishlist).length;
  const favorites = items.filter((i) => i.isFavorite).length;

  return (
    <View style={[styles.row, compact && styles.rowWrap]}>
      <StatCard label="Κόμικ" count={total} accent={theme.kirbyBlue} compact={compact} />
      <StatCard label="Διαβασμένα" count={read} accent={theme.kirbyMagenta} compact={compact} />
      <StatCard label="Ψάχνω" count={wishlist} accent={theme.kirbyOrange} compact={compact} />
      <StatCard label="Αγαπημένα" count={favorites} accent={theme.kirbyRed} compact={compact} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  rowWrap: {
    flexWrap: 'wrap',
  },
  card: {
    flex: 1,
    minWidth: 0,
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.border,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 2,
  },
  cardCompact: {
    width: '47%',
    flexGrow: 1,
    flexBasis: '47%',
    paddingVertical: 8,
  },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  count: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.text,
    marginTop: 4,
  },
  countCompact: {
    fontSize: 18,
  },
  label: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  labelCompact: {
    fontSize: 8,
  },
});

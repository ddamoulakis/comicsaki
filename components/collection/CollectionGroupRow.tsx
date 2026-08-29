import { Pressable, StyleSheet, Text } from 'react-native';

import { theme } from '@/constants/Theme';

type CollectionGroupRowProps = {
  name: string;
  count: number;
  countLabel?: string;
  selected?: boolean;
  onPress: () => void;
};

export function CollectionGroupRow({
  name,
  count,
  countLabel = 'τεύχη',
  selected = false,
  onPress,
}: CollectionGroupRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.count} numberOfLines={1}>
        {count} {countLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: theme.border,
    backgroundColor: '#0B142A',
    gap: 2,
    minWidth: 88,
    maxWidth: 140,
    flexShrink: 0,
  },
  chipSelected: {
    backgroundColor: theme.kirbyBlue,
  },
  name: {
    fontSize: 11,
    fontWeight: '900',
    color: theme.surface,
    textTransform: 'uppercase',
  },
  count: {
    fontSize: 9,
    fontWeight: '800',
    color: theme.kirbyYellow,
  },
});

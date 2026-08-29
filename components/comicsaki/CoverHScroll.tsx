import { type ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

export function CoverHScroll({
  height,
  gap,
  children,
}: {
  height: number | `${number}%`;
  gap: number;
  children: ReactNode;
}) {
  return (
    <ScrollView
      horizontal
      nestedScrollEnabled
      directionalLockEnabled
      showsHorizontalScrollIndicator={false}
      style={[styles.scroll, { height }, height === '100%' ? styles.fill : null]}
      contentContainerStyle={[styles.row, { gap, minHeight: height }]}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    flexGrow: 0,
  },
  fill: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'flex-start',
    flexGrow: 0,
    flexShrink: 0,
  },
});

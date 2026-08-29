import { StyleSheet, View, type ViewStyle } from 'react-native';

import { theme } from '@/constants/Theme';

const DOTS = [
  { top: 2, left: 4, size: 5 },
  { top: 10, left: 14, size: 4 },
  { top: 4, left: 22, size: 6 },
  { top: 16, left: 6, size: 3 },
  { top: 14, left: 26, size: 4 },
  { top: 22, left: 16, size: 5 },
  { top: 8, left: 34, size: 3 },
  { top: 20, left: 32, size: 4 },
];

type KirbyDotsProps = {
  style?: ViewStyle;
  color?: string;
  size?: 'sm' | 'md';
};

export function KirbyDots({ style, color = theme.border, size = 'md' }: KirbyDotsProps) {
  const scale = size === 'sm' ? 0.65 : 1;

  return (
    <View style={[styles.wrap, { transform: [{ scale }] }, style]}>
      {DOTS.map((dot, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              top: dot.top,
              left: dot.left,
              width: dot.size,
              height: dot.size,
              backgroundColor: color,
              borderRadius: dot.size / 2,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 44,
    height: 28,
    position: 'relative',
  },
  dot: {
    position: 'absolute',
  },
});

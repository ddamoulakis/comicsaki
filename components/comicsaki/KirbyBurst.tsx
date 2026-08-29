import { StyleSheet, View, type ViewStyle } from 'react-native';

import { theme } from '@/constants/Theme';

type KirbyBurstProps = {
  size?: number;
  color?: string;
  style?: ViewStyle;
};

/** Four-point Kirby energy burst. */
export function KirbyBurst({ size = 28, color = theme.kirbyYellow, style }: KirbyBurstProps) {
  const arm = size * 0.38;

  return (
    <View style={[styles.wrap, { width: size, height: size }, style]}>
      <View style={[styles.arm, styles.armH, { width: size, height: arm, backgroundColor: color }]} />
      <View style={[styles.arm, styles.armV, { width: arm, height: size, backgroundColor: color }]} />
      <View style={[styles.core, { width: arm * 1.1, height: arm * 1.1, backgroundColor: theme.border }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  arm: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: theme.border,
  },
  armH: {},
  armV: {},
  core: {
    borderWidth: 2,
    borderColor: theme.border,
    transform: [{ rotate: '45deg' }],
  },
});

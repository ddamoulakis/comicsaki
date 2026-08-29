import { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getTabBarHeight } from '@/constants/phoneShell';

type ShellModalProps = {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
  animationType?: 'none' | 'slide' | 'fade';
  contentStyle?: StyleProp<ViewStyle>;
};

/**
 * In-tree sheet overlay (not RN Modal) so:
 * - stays inside the phone shell on web
 * - leaves the bottom tab bar free — tabs always navigate without needing ✕
 */
export function ShellModal({ visible, children, contentStyle }: ShellModalProps) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = getTabBarHeight(insets.bottom);

  if (!visible) return null;

  return (
    <View style={[styles.root, { bottom: tabBarHeight }, contentStyle]} pointerEvents="box-none">
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 40,
  },
});

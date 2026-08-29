import { StyleSheet, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CosmicBackground, type CosmicVariant } from '@/components/comicsaki/CosmicBackground';

type KirbyScreenProps = ViewProps & {
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  showDecor?: boolean;
  padded?: boolean;
  variant?: CosmicVariant;
};

export function KirbyScreen({
  children,
  style,
  edges = ['top'],
  showDecor: _showDecor = true,
  padded = false,
  variant = 'plasma',
  ...rest
}: KirbyScreenProps) {
  return (
    <CosmicBackground variant={variant} style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={edges}>
        <View style={[padded && styles.padded, styles.mobileCol, style]} {...rest}>
          {children}
        </View>
      </SafeAreaView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  padded: {
    padding: 12,
  },
  mobileCol: {
    width: '100%',
    flex: 1,
  },
});

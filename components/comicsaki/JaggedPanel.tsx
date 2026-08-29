import { Platform, StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

type JaggedVariant = 'panel' | 'pill' | 'tab' | 'search';

type JaggedPanelProps = ViewProps & {
  fill?: string;
  ink?: string;
  variant?: JaggedVariant;
  shadow?: boolean;
};

export function JaggedPanel({
  children,
  style,
  fill = '#FFFDF5',
  ink = '#0D0D0D',
  variant = 'panel',
  shadow = true,
  ...rest
}: JaggedPanelProps) {
  const radius = variant === 'pill' || variant === 'search' ? 22 : 10;
  const webShape: ViewStyle = Platform.OS === 'web' ? { borderRadius: radius, overflow: 'hidden' } : {};

  return (
    <View style={[shadow && styles.shadowWrap, style]} {...rest}>
      {shadow ? <View style={[styles.shadowBlob, { backgroundColor: ink }, webShape]} /> : null}
      <View style={[styles.face, { backgroundColor: fill, borderColor: ink }, webShape]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    position: 'relative',
    alignSelf: 'stretch',
  },
  shadowBlob: {
    ...StyleSheet.absoluteFillObject,
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    opacity: 0.95,
  },
  face: {
    borderWidth: 3,
    overflow: 'hidden',
    position: 'relative',
    zIndex: 1,
  },
});

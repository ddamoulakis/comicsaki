import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { theme } from '@/constants/Theme';

type ComicBorderCardProps = ViewProps & {
  onPress?: () => void;
  withShadow?: boolean;
  accentColor?: string;
};

export function ComicBorderCard({
  children,
  style,
  onPress,
  withShadow = false,
  accentColor,
  ...rest
}: ComicBorderCardProps) {
  const card = (
    <View style={[withShadow && styles.shadowLayer, style]}>
      <View
        style={[
          styles.card,
        ]}
        {...rest}>
        {accentColor && <View style={[styles.accentStripe, { backgroundColor: accentColor }]} />}
        {children}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [pressed && styles.pressed, withShadow && styles.shadowPressable]}>
        {card}
      </Pressable>
    );
  }

  return card;
}

const styles = StyleSheet.create({
  shadowPressable: {
    marginBottom: theme.shadowOffset,
    marginRight: theme.shadowOffset,
  },
  shadowLayer: {
    shadowColor: theme.border,
    shadowOffset: { width: theme.shadowOffset, height: theme.shadowOffset },
    shadowOpacity: 1,
    shadowRadius: 0,
    marginBottom: theme.shadowOffset,
    marginRight: theme.shadowOffset,
  },
  card: {
    backgroundColor: theme.surface,
    borderWidth: theme.borderWidthThin,
    borderColor: theme.border,
    overflow: 'hidden',
    position: 'relative',
  },
  accentStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
  },
  pressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
});

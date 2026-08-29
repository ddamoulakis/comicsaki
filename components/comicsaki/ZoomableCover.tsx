import { type ReactNode } from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  type ImageErrorEventData,
  type ImageStyle,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useCoverZoom } from '@/contexts/CoverZoomProvider';

type ZoomableCoverProps = {
  uri?: string | null;
  caption?: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center' | 'repeat';
  children?: ReactNode;
  disabled?: boolean;
  fadeDuration?: number;
  onError?: (e: NativeSyntheticEvent<ImageErrorEventData>) => void;
  accessibilityLabel?: string;
};

export function ZoomableCover({
  uri,
  caption,
  style,
  imageStyle,
  resizeMode = 'cover',
  children,
  disabled,
  fadeDuration,
  onError,
  accessibilityLabel = 'Μεγέθυνση εξωφύλλου',
}: ZoomableCoverProps) {
  const { openCover } = useCoverZoom();
  const src = uri?.trim() || '';

  if (!src) {
    return <>{children}</>;
  }

  return (
    <Pressable
      style={[styles.press, style, Platform.OS === 'web' ? ({ cursor: 'zoom-in' } as ViewStyle) : null]}
      onPress={(e) => {
        e.stopPropagation();
        openCover(src, caption);
      }}
      disabled={disabled}
      accessibilityRole="imagebutton"
      accessibilityLabel={accessibilityLabel}>
      <Image
        source={{ uri: src }}
        style={[styles.image, imageStyle]}
        resizeMode={resizeMode}
        fadeDuration={fadeDuration}
        onError={onError}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: {
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});

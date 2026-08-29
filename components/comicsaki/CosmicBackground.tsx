import { Asset } from 'expo-asset';
import { memo } from 'react';
import { Image, Platform, StyleSheet, View, type ViewProps } from 'react-native';

export type CosmicVariant = 'nebula' | 'aurora' | 'plasma' | 'void' | 'flare' | 'ion';

type CosmicBackgroundProps = ViewProps & {
  variant?: CosmicVariant;
};

const MODULES = {
  nebula: require('../../assets/images/cosmic-bg.png'),
  aurora: require('../../assets/images/cosmic-bg-green.png'),
  plasma: require('../../assets/images/cosmic-bg-purple.png'),
  void: require('../../assets/images/cosmic-bg-blue.png'),
  flare: require('../../assets/images/cosmic-bg.png'),
  ion: require('../../assets/images/cosmic-bg-blue.png'),
} as const;

const OVERLAY: Record<CosmicVariant, string> = {
  nebula: 'rgba(2, 4, 12, 0.08)',
  aurora: 'rgba(0, 40, 20, 0.18)',
  plasma: 'rgba(40, 0, 50, 0.22)',
  void: 'rgba(0, 20, 50, 0.2)',
  flare: 'rgba(60, 10, 0, 0.28)',
  ion: 'rgba(0, 50, 60, 0.22)',
};

const POSITION: Record<CosmicVariant, string> = {
  nebula: 'center',
  aurora: 'top',
  plasma: 'bottom',
  void: 'center left',
  flare: 'top right',
  ion: 'center right',
};

const uriCache: Partial<Record<CosmicVariant, string | undefined>> = {};

function getUri(variant: CosmicVariant): string | undefined {
  if (uriCache[variant] !== undefined) return uriCache[variant];
  const asset = Asset.fromModule(MODULES[variant]);
  uriCache[variant] = asset.uri;
  return asset.uri;
}

const CosmicBgLayer = memo(function CosmicBgLayer({ variant }: { variant: CosmicVariant }) {
  const module = MODULES[variant];
  const uri = getUri(variant);
  const overlay = OVERLAY[variant];
  const position = POSITION[variant];

  return (
    <>
      {Platform.OS === 'web' && uri ? (
        // Real <img> avoids RN-web rewriting background-image on every parent render.
        <img
          src={uri}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: position,
            pointerEvents: 'none',
            zIndex: 0,
            display: 'block',
          }}
        />
      ) : (
        <View style={styles.bgLayer} pointerEvents="none">
          <Image source={module} style={styles.bgImage} resizeMode="cover" fadeDuration={0} />
        </View>
      )}
      <View pointerEvents="none" style={[styles.overlay, { backgroundColor: overlay }]} />
    </>
  );
});

export const CosmicBackground = memo(function CosmicBackground({
  children,
  style,
  variant = 'nebula',
  ...rest
}: CosmicBackgroundProps) {
  return (
    <View style={[styles.root, style]} {...rest}>
      <CosmicBgLayer variant={variant} />
      <View style={styles.content}>{children}</View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
    overflow: 'hidden',
    position: 'relative',
  },
  bgLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 0,
    backgroundColor: '#02040c',
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  content: {
    flex: 1,
    zIndex: 1,
    position: 'relative',
    backgroundColor: 'transparent',
  },
});

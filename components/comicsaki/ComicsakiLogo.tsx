import { Image, StyleSheet, Text, View } from 'react-native';

import { fontFamily } from '@/constants/fonts';
import { theme } from '@/constants/Theme';

const logoSource = require('../../assets/images/logo.png');

export function ComicsakiLogo({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.container, compact && styles.compact]}>
      <View style={[styles.logoWrap, compact && styles.logoWrapCompact]}>
        <Image
          source={logoSource}
          style={[styles.logo, compact && styles.logoCompact]}
          resizeMode="contain"
          accessibilityLabel="Comicsάκι"
        />
      </View>
      <View style={[styles.taglineBanner, compact && styles.taglineBannerCompact]}>
        <Text style={[styles.tagline, compact && styles.taglineCompact]}>
          Η συλλογή σου, οργανωμένη.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    gap: 6,
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
  },
  compact: {
    gap: 4,
  },
  logoWrap: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  logoWrapCompact: {
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  logo: {
    width: 188,
    height: 80,
    backgroundColor: 'transparent',
  },
  logoCompact: {
    width: 148,
    height: 62,
  },
  taglineBanner: {
    alignSelf: 'flex-start',
    backgroundColor: theme.kirbyYellow,
    borderWidth: 3,
    borderColor: theme.cosmicInk,
    paddingHorizontal: 10,
    paddingVertical: 4,
    transform: [{ rotate: '-1deg' }],
  },
  taglineBannerCompact: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tagline: {
    ...fontFamily('extrabold'),
    fontSize: 13,
    color: theme.cosmicInk,
    letterSpacing: 0.2,
  },
  taglineCompact: {
    fontSize: 11,
  },
});

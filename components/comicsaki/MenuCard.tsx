import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { JaggedPanel } from '@/components/comicsaki/JaggedPanel';
import { SpeechBubble } from '@/components/comicsaki/SpeechBubble';
import { fontFamily } from '@/constants/fonts';
import { theme } from '@/constants/Theme';

type MenuCardProps = {
  title: string;
  subtitle: string;
  iconColor: string;
  icon: 'collection' | 'add' | 'market' | 'newspaper';
  onPress?: () => void;
  compact?: boolean;
  /** Solid filled comic panel (home mockup). */
  filled?: boolean;
  /** speech | thought bubble shape for filled cards. */
  bubbleKind?: 'speech' | 'thought';
  /** Flip bubble silhouette (text stays centered & readable). */
  mirror?: boolean;
};

function MenuIcon({
  color,
  variant,
  compact,
  onFilled,
}: {
  color: string;
  variant: MenuCardProps['icon'];
  compact?: boolean;
  onFilled?: boolean;
}) {
  const boxStyle = [
    styles.iconBox,
    compact && styles.iconBoxCompact,
    onFilled ? styles.iconBoxOnFilled : { backgroundColor: color },
  ];

  if (variant === 'add') {
    return null;
  }

  if (variant === 'newspaper') {
    return (
      <View style={boxStyle}>
        <Ionicons
          name="newspaper-outline"
          size={compact ? 18 : 22}
          color={onFilled ? theme.cosmicInk : theme.surface}
        />
      </View>
    );
  }

  if (variant === 'market') {
    return (
      <View style={boxStyle}>
        <View style={[styles.marketInner, compact && styles.marketInnerCompact, onFilled && styles.marketOnFilled]} />
      </View>
    );
  }

  // collection: no decorative inner glyph
  return null;
}

export function MenuCard({
  title,
  subtitle,
  iconColor,
  icon,
  onPress,
  compact = false,
  filled = false,
  bubbleKind = 'thought',
  mirror = false,
}: MenuCardProps) {
  const lightFill =
    filled &&
    (iconColor === theme.surface ||
      iconColor === '#FFFDF5' ||
      iconColor === '#FFFFFF' ||
      iconColor === '#fff' ||
      iconColor.toLowerCase() === '#ffffff');

  const content = (
    <View
      style={[
        styles.content,
        compact && styles.contentCompact,
        filled && styles.contentFilled,
        filled && compact && styles.contentFilledCompact,
        filled && styles.contentCentered,
      ]}>
      <MenuIcon color={iconColor} variant={icon} compact={compact} onFilled={filled && !lightFill} />
      <View style={[styles.textWrap, filled && styles.textWrapCentered]}>
        <Text
          style={[
            styles.title,
            compact && styles.titleCompact,
            filled && !lightFill && styles.titleFilled,
            lightFill && styles.titleOnLight,
            filled && styles.titleCentered,
          ]}
          numberOfLines={2}>
          {title}
        </Text>
        {subtitle.trim() ? (
          <Text
            style={[
              styles.subtitle,
              compact && styles.subtitleCompact,
              filled && !lightFill && styles.subtitleFilled,
              lightFill && styles.subtitleOnLight,
              filled && styles.titleCentered,
            ]}
            numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );

  if (filled) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.flexFill, pressed && styles.pressed]}>
        <SpeechBubble
          fill={iconColor}
          ink={theme.cosmicInk}
          compact={compact}
          kind={bubbleKind}
          mirror={mirror}>
          {content}
        </SpeechBubble>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.flexFill, pressed && styles.pressed]}>
      <JaggedPanel fill={theme.cosmicPanel} variant="pill" style={styles.flexFill} shadow>
        {content}
      </JaggedPanel>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flexFill: {
    flex: 1,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
  },
  contentCompact: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 8,
  },
  contentFilled: {
    minHeight: 52,
  },
  contentFilledCompact: {
    minHeight: 44,
  },
  contentCentered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  textWrapCentered: {
    flex: 1,
    width: '100%',
    minWidth: 0,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCentered: {
    textAlign: 'center',
    width: '100%',
    flexShrink: 0,
  },
  subtitleSpacer: {
    height: 16,
  },
  subtitleSpacerCompact: {
    height: 14,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderWidth: 3,
    borderColor: theme.cosmicInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxCompact: {
    width: 34,
    height: 34,
  },
  iconBoxOnFilled: {
    backgroundColor: theme.surface,
  },
  marketInner: {
    width: 14,
    height: 14,
    borderWidth: 3,
    borderColor: theme.surface,
    transform: [{ rotate: '45deg' }],
  },
  marketInnerCompact: {
    width: 12,
    height: 12,
    borderWidth: 2,
  },
  marketOnFilled: {
    borderColor: theme.cosmicGreen,
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    ...fontFamily('extrabold'),
    fontSize: 15,
    color: theme.text,
    letterSpacing: 0.2,
    zIndex: 2,
  },
  titleCompact: {
    fontSize: 13,
  },
  titleFilled: {
    color: theme.surface,
  },
  titleOnLight: {
    color: theme.cosmicInk,
  },
  subtitle: {
    ...fontFamily('semibold'),
    fontSize: 11,
    color: theme.textMuted,
  },
  subtitleCompact: {
    fontSize: 10,
  },
  subtitleFilled: {
    color: 'rgba(255,255,255,0.9)',
  },
  subtitleOnLight: {
    color: theme.textMuted,
  },
  pressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
});

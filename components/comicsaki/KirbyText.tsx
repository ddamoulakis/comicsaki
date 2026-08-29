import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { fontFamily } from '@/constants/fonts';
import { theme } from '@/constants/Theme';

type KirbyTextProps = TextProps & {
  variant?: 'hero' | 'title' | 'body' | 'caption';
  color?: string;
  outline?: boolean;
};

const VARIANTS: Record<NonNullable<KirbyTextProps['variant']>, TextStyle> = {
  hero: {
    ...fontFamily('extrabold'),
    fontSize: 32,
    letterSpacing: 1,
  },
  title: {
    ...fontFamily('extrabold'),
    fontSize: 22,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  body: {
    ...fontFamily('bold'),
    fontSize: 15,
  },
  caption: {
    ...fontFamily('extrabold'),
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
};

export function KirbyText({
  children,
  variant = 'body',
  color = theme.text,
  outline = false,
  style,
  ...rest
}: KirbyTextProps) {
  if (outline) {
    return (
      <Text style={styles.outlineWrap} {...rest}>
        <Text style={[VARIANTS[variant], styles.outline, style]}>{children}</Text>
        <Text style={[VARIANTS[variant], styles.fill, { color }, style]}>{children}</Text>
      </Text>
    );
  }

  return (
    <Text style={[VARIANTS[variant], { color }, style]} {...rest}>
      {children}
    </Text>
  );
}

const OUTLINE_OFFSET = 2;

const styles = StyleSheet.create({
  outlineWrap: {
    position: 'relative',
  },
  outline: {
    position: 'absolute',
    left: OUTLINE_OFFSET,
    top: OUTLINE_OFFSET,
    color: theme.border,
  },
  fill: {
    color: theme.kirbyYellow,
  },
});

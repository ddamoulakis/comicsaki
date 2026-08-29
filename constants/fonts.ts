import type { TextStyle } from 'react-native';

/**
 * Playpen Sans — handwritten comic style with Greek + Latin (English).
 * One family covers both languages across the app.
 */
export const fonts = {
  regular: 'PlaypenSans',
  medium: 'PlaypenSans-Medium',
  semibold: 'PlaypenSans-SemiBold',
  bold: 'PlaypenSans-Bold',
  extrabold: 'PlaypenSans-ExtraBold',
} as const;

export type AppFontWeight = keyof typeof fonts;

/** Use named weight files; keep fontWeight normal so RN doesn't fake weights. */
export function fontFamily(weight: AppFontWeight = 'regular'): TextStyle {
  return {
    fontFamily: fonts[weight],
    fontWeight: 'normal',
  };
}

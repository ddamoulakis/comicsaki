/** Jack Kirby Silver Age palette — bold primaries, cosmic accents, heavy ink. */
import { fonts } from '@/constants/fonts';

export const theme = {
  // Newsprint & ink
  background: '#F2E8C9',
  backgroundDark: '#E8DDB0',
  surface: '#FFFDF5',
  surfaceAlt: '#FFE566',
  text: '#0D0D0D',
  textMuted: '#3D3D3D',
  textSection: '#0D0D0D',
  border: '#0D0D0D',

  // Kirby primaries
  kirbyRed: '#E31B23',
  kirbyBlue: '#0057B8',
  kirbyYellow: '#FFD100',
  kirbyMagenta: '#C800FF',
  kirbyOrange: '#FF6600',
  kirbyCyan: '#00B4D8',

  // Cosmic home palette
  cosmicBg: '#050814',
  cosmicGreen: '#1DB954',
  cosmicPanel: '#F4EFE0',
  cosmicInk: '#0A0A0A',

  // Legacy aliases used by components
  accentRed: '#E31B23',
  accentYellow: '#FFD100',
  accentBlue: '#0057B8',
  accentPurple: '#C800FF',
  accentGreen: '#00A651',
  comicBlue: '#0057B8',

  // Typography — Playpen Sans (Greek + Latin comic handwriting)
  fontRegular: fonts.regular,
  fontMedium: fonts.medium,
  fontSemibold: fonts.semibold,
  fontBold: fonts.bold,
  fontExtraBold: fonts.extrabold,

  // Structure
  borderWidth: 4,
  borderWidthThin: 3,
  shadowOffset: 6,
  radius: 0,
  radiusSoft: 2,
  radiusPill: 0,
} as const;

export const kirbyText = {
  hero: {
    fontFamily: fonts.extrabold,
    fontWeight: 'normal' as const,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  caption: {
    fontFamily: fonts.extrabold,
    fontWeight: 'normal' as const,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
  body: {
    fontFamily: fonts.bold,
    fontWeight: 'normal' as const,
  },
} as const;

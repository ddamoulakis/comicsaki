import { Platform, Text, TextInput } from 'react-native';

import { fonts } from '@/constants/fonts';

type Styleable = { defaultProps?: { style?: unknown } };

/**
 * Apply Playpen Sans as the default for Text / TextInput app-wide
 * (Greek + English share the same family).
 */
export function applyAppFontDefaults() {
  const text = Text as unknown as Styleable;
  const input = TextInput as unknown as Styleable;

  text.defaultProps = text.defaultProps ?? {};
  input.defaultProps = input.defaultProps ?? {};

  text.defaultProps.style = [{ fontFamily: fonts.regular }, text.defaultProps.style];
  input.defaultProps.style = [{ fontFamily: fonts.regular }, input.defaultProps.style];

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const id = 'comicsaki-playpen-font';
    if (!document.getElementById(id)) {
      const style = document.createElement('style');
      style.id = id;
      // Prefer Playpen for UI text; leave icon fonts alone
      style.textContent = `
        body, input, textarea, button, select {
          font-family: '${fonts.regular}', 'Playpen Sans', system-ui, sans-serif;
        }
      `;
      document.head.appendChild(style);
    }
  }
}

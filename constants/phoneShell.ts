/** Logical iPhone 14 size used by the desktop web phone frame. */
export const PHONE_SHELL_WIDTH = 390;
export const PHONE_SHELL_HEIGHT = 844;
/** Below this viewport width, web is full-bleed (real phones). */
export const PHONE_SHELL_MIN_VIEWPORT = 480;
/** Typical iPhone portrait safe areas (notch + home indicator). */
export const PHONE_SHELL_INSETS = {
  top: 47,
  left: 0,
  right: 0,
  bottom: 34,
} as const;

/** Tab chip row height (matches app/(tabs)/_layout.tsx). */
export const TAB_BAR_BASE_HEIGHT = 56;

export function getTabBarHeight(bottomInset: number): number {
  return TAB_BAR_BASE_HEIGHT + Math.max(bottomInset, 8);
}

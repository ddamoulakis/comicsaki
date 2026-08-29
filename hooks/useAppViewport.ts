import { useWindowDimensions } from 'react-native';

export function usePhoneShellActive(): boolean {
  return false;
}

/** Web-only: snap the desktop phone frame to whole pixels. */
export function usePixelSnappedPhoneShell() {}

/** Viewport of the app chrome (window on native). */
export function useAppViewport(): { width: number; height: number } {
  const windowDims = useWindowDimensions();
  return { width: windowDims.width, height: windowDims.height };
}

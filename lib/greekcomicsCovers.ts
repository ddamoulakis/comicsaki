import { env } from '@/lib/env';

const GREEK_COVERS_BUCKET = 'greek-covers';

function hostedCoversBase(): string {
  const explicit = env.greekcomicsCoversBase.replace(/\/+$/, '');
  if (explicit) return explicit;
  const supabase = env.supabaseUrl.replace(/\/+$/, '');
  if (supabase) {
    return `${supabase}/storage/v1/object/public/${GREEK_COVERS_BUCKET}`;
  }
  return '';
}

function isReactNative(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    (navigator as { product?: string }).product === 'ReactNative'
  );
}

function nativeHostOrigin(): string {
  try {
    // Lazy require so Node catalog tests don't load react-native.
    const Constants = require('expo-constants').default as {
      expoConfig?: { hostUri?: string };
    };
    const host = Constants.expoConfig?.hostUri?.replace(/\/+$/, '');
    if (!host) return '';
    if (/^https?:\/\//i.test(host)) return host;
    return `http://${host}`;
  } catch {
    return '';
  }
}

function localApiOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  if (isReactNative()) return nativeHostOrigin();
  return '';
}

/** Public URL for a scraped cover file named `{covId}_{filename}`. */
export function greekcomicsCoverUrl(covId: string, file: string): string | undefined {
  if (!covId || !file) return undefined;
  const name = `${covId}_${file}`;
  const hosted = hostedCoversBase();
  if (hosted) return `${hosted}/${name}`;

  const origin = localApiOrigin();
  const path = `/api/greek-covers?file=${encodeURIComponent(name)}`;
  return origin ? `${origin}${path}` : path;
}

/**
 * Load catalog cover bytes for visual matching.
 * Tries direct CORS fetch first, then Supabase metron-proxy /_image.
 */

import { env } from '@/lib/env';
import { supabaseFunctionHeaders } from '@/lib/supabase';

function proxyCoverUrl(src: string): string | null {
  const supabaseUrl = env.supabaseUrl;
  if (!supabaseUrl) return null;
  const url = new URL(`${supabaseUrl}/functions/v1/metron-proxy`);
  url.searchParams.set('path', '/_image');
  url.searchParams.set('src', src);
  return url.toString();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch(() => {
        clearTimeout(t);
        resolve(null);
      });
  });
}

export async function fetchCoverBlob(
  coverUrl: string,
  timeoutMs = 4000,
): Promise<Blob | null> {
  if (!coverUrl) return null;

  const attempt = async (): Promise<Blob | null> => {
    const local =
      coverUrl.startsWith('/') ||
      /\/api\/greek-covers\b/i.test(coverUrl) ||
      /localhost|127\.0\.0\.1/i.test(coverUrl);
    try {
      const direct = await fetch(coverUrl, local ? undefined : { mode: 'cors' });
      if (direct.ok) return await direct.blob();
    } catch {
      // CORS / network — try proxy
    }

    if (local) return null;

    const proxied = proxyCoverUrl(coverUrl);
    if (!proxied) return null;

    try {
      const res = await fetch(proxied, { headers: await supabaseFunctionHeaders() });
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
  };

  return withTimeout(attempt(), timeoutMs);
}

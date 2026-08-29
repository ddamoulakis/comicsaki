/** Public HTTP(S) URL (not blob:/data:). */
export function isHttpUrl(url: string | undefined | null): url is string {
  return !!url && /^https?:\/\//i.test(url);
}

/**
 * Covers the user photographed and we uploaded to Storage.
 * These must never be treated as official catalog / shop covers.
 */
export function isUserUploadedCover(url: string | undefined | null): boolean {
  if (!url) return false;
  return /\/storage\/v1\/object\/public\/listing-images\//i.test(url);
}

/** Shop / Metron / greekcomics / Anubis — not a personal scan. */
export function isOfficialCoverUrl(url: string | undefined | null): url is string {
  return isHttpUrl(url) && !isUserUploadedCover(url);
}

/** Bundled greekcomics archive or Supabase greek-covers CDN. */
export function isGreekCatalogCoverUrl(url: string | undefined | null): url is string {
  if (!url) return false;
  if (url.startsWith('/api/greek-covers')) return true;
  return (
    isHttpUrl(url) &&
    /\/api\/greek-covers\b|greekcomics|\/storage\/v1\/object\/public\/greek-covers\//i.test(
      url,
    )
  );
}

/** Catalog / shop cover suitable for scan UI (excludes blob: and user uploads). */
export function isCatalogCoverUrl(url: string | undefined | null): url is string {
  return isOfficialCoverUrl(url) || isGreekCatalogCoverUrl(url);
}

export function isMetronCoverUrl(url: string | undefined | null): url is string {
  return isHttpUrl(url) && /static\.metron\.cloud/i.test(url);
}

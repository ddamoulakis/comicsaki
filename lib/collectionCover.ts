import { lookupExactGreekCatalogCover } from '@/lib/greekCatalogMatch';
import {
  isCatalogCoverUrl,
  isOfficialCoverUrl,
  isUserUploadedCover,
} from '@/lib/coverUrl';
import { resolveGreekCoverUrl } from '@/services/greekReleases';

function cleanPublisher(publisher?: string): string {
  const value = publisher?.trim() ?? '';
  if (!value || value === '—' || value === '-') return '';
  return value;
}

/** Official Greek edition cover from bundled catalog or shop URLs. */
export function resolveGreekEditionCoverUrl(
  series?: string,
  issue?: string,
  publisher?: string,
): string | undefined {
  const name = series?.trim() ?? '';
  if (!name) return undefined;

  const pub = cleanPublisher(publisher);
  const exact = lookupExactGreekCatalogCover(name, issue, pub || undefined);
  if (isCatalogCoverUrl(exact)) return exact;

  if (pub) {
    const anyPublisher = lookupExactGreekCatalogCover(name, issue);
    if (isCatalogCoverUrl(anyPublisher)) return anyPublisher;
  }

  const shop = resolveGreekCoverUrl(name, issue, pub || undefined);
  if (isCatalogCoverUrl(shop)) return shop;
  return undefined;
}

/** Best cover URL to show for a collection row (Greek catalog beats user scans). */
export function collectionItemCoverUrl(item: {
  series: string;
  issue: string;
  publisher?: string;
  coverUrl?: string;
}): string | undefined {
  const greek = resolveGreekEditionCoverUrl(item.series, item.issue, item.publisher);
  const stored = item.coverUrl?.trim();

  if (isCatalogCoverUrl(greek)) return greek;
  if (isCatalogCoverUrl(stored)) return stored;
  if (isUserUploadedCover(stored)) return greek ?? stored;
  if (isOfficialCoverUrl(stored)) return stored;
  return greek ?? stored;
}

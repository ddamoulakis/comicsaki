import catalogJson from '@/data/greekcomicsCatalog.json';
import {
  greekFormatFromCode,
  inferGreekSeriesFormat,
  type GreekReleaseFormat,
} from '@/lib/greekFormat';
import { greekcomicsCoverUrl } from '@/lib/greekcomicsCovers';

type GreekcomicsIssue = { n: string; f: string; y?: number };
type GreekcomicsSeries = {
  id: string;
  n: string;
  p: string;
  y?: number;
  g?: string;
  fmt?: string;
  i: GreekcomicsIssue[];
};
type GreekcomicsCatalogFile = {
  source?: string;
  generatedAt?: string;
  series: GreekcomicsSeries[];
};

const catalog = catalogJson as GreekcomicsCatalogFile;

function isBackCoverFile(filename: string): boolean {
  return /_\d+z\.(?:jpe?g|png|webp)$/i.test(filename);
}

function splitName(raw: string): { name: string; aliases: string[] } {
  const parts = raw
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) return { name: raw.trim(), aliases: [] };
  return { name: parts[0], aliases: parts.slice(1) };
}

/** Expand the greekcomics.gr scrape into catalog rows. */
export function greekcomicsCatalogRows() {
  const rows: Array<{
    issueId: string;
    catalogKey: string;
    seriesKey: string;
    seriesName: string;
    aliases: string[];
    publisher: string;
    format: GreekReleaseFormat;
    issueNumber: string;
    issueTitle: string;
    year?: number;
    coverUrl?: string;
    sourceUrl?: string;
  }> = [];
  for (const series of catalog.series ?? []) {
    const covId = String(series.id);
    const { name, aliases } = splitName(series.n ?? '');
    if (!name) continue;
    const publisher = series.p ?? '';
    const sourceUrl = series.g;
    const format: GreekReleaseFormat =
      greekFormatFromCode(series.fmt) ??
      inferGreekSeriesFormat(name, series.i?.length ?? 0);
    for (const issue of series.i ?? []) {
      const number = String(issue.n ?? '').trim();
      if (!number || isBackCoverFile(issue.f ?? '')) continue;
      const catalogKey = `gc-${covId}-${number}`;
      rows.push({
        issueId: `greek:${catalogKey}`,
        catalogKey,
        seriesKey: `gc-${covId}`,
        seriesName: name,
        aliases,
        publisher,
        format,
        issueNumber: number,
        issueTitle: `${name} #${number}`,
        year: issue.y ?? series.y,
        coverUrl: greekcomicsCoverUrl(covId, issue.f),
        sourceUrl,
      });
    }
  }
  return rows;
}

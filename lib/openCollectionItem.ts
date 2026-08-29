import { detectComicMarket } from '@/lib/comicLanguage';
import { metronAliasTitles } from '@/services/greekReleases';
import { searchMetronIssues } from '@/services/metron';
import type { CollectionItem } from '@/types/collection';

type RouterLike = {
  push: (href: { pathname: '/(tabs)/issue-detail' | '/(tabs)/collection-item'; params: Record<string, string> }) => void;
};

export async function openCollectionItem(router: RouterLike, item: CollectionItem) {
  const goLocal = () => {
    router.push({
      pathname: '/(tabs)/collection-item',
      params: {
        id: item.id,
        series: item.series,
        issue: item.issue,
        publisher: item.publisher,
        coverUrl: item.coverUrl ?? '',
        year: item.year ? String(item.year) : '',
        notes: item.notes ?? '',
        grade: item.grade ?? '',
      },
    });
  };

  try {
    const market = detectComicMarket(`${item.series} ${item.publisher}`);
    if (market !== 'greek') {
      const aliases = metronAliasTitles(item.series);
      for (const q of aliases.length ? aliases : [item.series]) {
        const results = await searchMetronIssues(q, item.issue || undefined);
        const hit = results.matches[0];
        if (hit?.issueId) {
          router.push({ pathname: '/(tabs)/issue-detail', params: { id: String(hit.issueId) } });
          return;
        }
      }
    }
  } catch {
    // fall through
  }
  goLocal();
}

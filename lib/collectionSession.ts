import type { CollectionItem } from '@/types/collection';

export type ManualAddPrefill = {
  issueId?: string;
  series?: string;
  issue?: string;
  publisher?: string;
  category?: string;
  edition?: string;
  notes?: string;
};

let prefill: ManualAddPrefill | null = null;

export function setManualAddPrefill(data: ManualAddPrefill) {
  prefill = data;
}

export function consumeManualAddPrefill(): ManualAddPrefill | null {
  const data = prefill;
  prefill = null;
  return data;
}

export function collectionItemToLatest(item: CollectionItem) {
  return {
    title: item.series,
    issue: item.issue,
    publisher: item.publisher,
    condition: item.condition,
    coverLabel: `${item.series.toUpperCase()}\n#${item.issue}`,
  };
}

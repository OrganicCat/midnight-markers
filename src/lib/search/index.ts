import MiniSearch from 'minisearch';
import type { Bookmark } from '$lib/types';

export type SearchIndex = MiniSearch<Bookmark>;

export function buildIndex(items: Bookmark[]): SearchIndex {
  const idx = new MiniSearch<Bookmark>({
    fields: ['title', 'domain', 'url', 'note'],
    storeFields: ['id'],
    idField: 'id',
    searchOptions: { fuzzy: 0.4, prefix: true, boost: { title: 2 } },
  });
  idx.addAll(items.map((b) => ({ ...b, note: b.note ?? '' })));
  return idx;
}

export function searchIds(idx: SearchIndex, query: string): string[] {
  const q = query.trim();
  if (!q) return [];
  return idx.search(q).map((r) => r.id as string);
}

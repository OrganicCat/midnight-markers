import { collections } from '$lib/storage/collections';
import { bookmarks } from '$lib/storage/bookmarks';
import type { BookmarkRef, FolderNode, ResortScope } from './types';

export async function gatherScope(
  scope: ResortScope,
): Promise<{ folders: FolderNode[]; bookmarks: BookmarkRef[] }> {
  const withPaths = await collections.listWithPaths();
  const all = await bookmarks.list({});

  if (scope.kind === 'collection' && !withPaths.some((c) => c.id === scope.id)) {
    return { folders: [], bookmarks: [] };
  }

  let inScope = withPaths;
  if (scope.kind === 'collection') {
    const ids = new Set<string>([scope.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of withPaths) {
        if (c.parentId && ids.has(c.parentId) && !ids.has(c.id)) {
          ids.add(c.id);
          grew = true;
        }
      }
    }
    inScope = withPaths.filter((c) => ids.has(c.id));
  }

  const pathById = new Map(inScope.map((c) => [c.id, c.path]));

  const folders: FolderNode[] = inScope.map((c) => ({
    id: c.id,
    name: c.name,
    parentId: c.parentId,
    path: c.path,
  }));

  const refs: BookmarkRef[] = [];
  for (const b of all) {
    if (b.collectionId === null) {
      if (scope.kind !== 'all') continue;
      refs.push({ id: b.id, title: b.title, domain: b.domain, path: [] });
      continue;
    }
    const path = pathById.get(b.collectionId);
    if (!path) continue; // outside the scope
    refs.push({ id: b.id, title: b.title, domain: b.domain, path });
  }

  return { folders, bookmarks: refs };
}

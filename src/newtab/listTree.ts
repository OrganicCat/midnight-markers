import type { Bookmark, Collection } from '$lib/types';

/**
 * One visible line of the list view's tree. The tree is rendered as a flat
 * array rather than a recursive component so that keyboard navigation can walk
 * exactly what the user sees, in the order they see it.
 */
export type ListRow =
  | {
      kind: 'collection';
      /** Stable key for `{#each}` — collection ids and bookmark ids share a namespace. */
      key: string;
      collection: Collection;
      depth: number;
      /** Bookmarks in this collection and every collection beneath it. */
      count: number;
      expanded: boolean;
    }
  | { kind: 'bookmark'; key: string; bookmark: Bookmark; depth: number };

export type BuildOptions = {
  /**
   * Ids of collections whose children are hidden. Absence means expanded, so a
   * newly created collection starts open and the default state is "show me
   * everything".
   */
  collapsed?: ReadonlySet<string>;
  /**
   * Drop collections that contain no visible bookmark at any depth. Wanted
   * while a search or filter is narrowing the pool — a screen of empty folders
   * is noise — but not when browsing everything, where an empty folder is a
   * real thing the user made and expects to see.
   */
  pruneEmpty?: boolean;
};

const byName = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base' }) || a.localeCompare(b);

/**
 * Flatten collections + bookmarks into the visible rows of the tree.
 *
 * Ordering at every level is alphabetical, folders before bookmarks. Bookmarks
 * with no collection — or one that no longer exists — sit at the root after the
 * folders.
 */
export function buildListRows(
  items: readonly Bookmark[],
  collections: readonly Collection[],
  { collapsed = new Set<string>(), pruneEmpty = false }: BuildOptions = {},
): ListRow[] {
  const known = new Set(collections.map((c) => c.id));

  const childCollections = new Map<string | null, Collection[]>();
  for (const c of collections) {
    // A parent that was deleted out from under a collection would otherwise
    // strand it; re-root it so it stays reachable.
    const parentId = c.parentId !== null && known.has(c.parentId) ? c.parentId : null;
    const list = childCollections.get(parentId) ?? [];
    list.push(c);
    childCollections.set(parentId, list);
  }
  for (const list of childCollections.values()) list.sort((a, b) => byName(a.name, b.name));

  const childBookmarks = new Map<string | null, Bookmark[]>();
  for (const b of items) {
    const parentId = b.collectionId !== null && known.has(b.collectionId) ? b.collectionId : null;
    const list = childBookmarks.get(parentId) ?? [];
    list.push(b);
    childBookmarks.set(parentId, list);
  }
  for (const list of childBookmarks.values()) list.sort((a, b) => byName(a.title, b.title));

  // Cycle guard: malformed parent chains must not hang the render.
  const visited = new Set<string>();

  const countIn = (id: string): number => {
    if (visited.has(id)) return 0;
    visited.add(id);
    const own = childBookmarks.get(id)?.length ?? 0;
    const nested = (childCollections.get(id) ?? []).reduce((n, c) => n + countIn(c.id), 0);
    visited.delete(id);
    return own + nested;
  };

  const rows: ListRow[] = [];
  const walk = (parentId: string | null, depth: number): void => {
    for (const c of childCollections.get(parentId) ?? []) {
      if (visited.has(c.id)) continue;
      const count = countIn(c.id);
      if (pruneEmpty && count === 0) continue;
      const expanded = !collapsed.has(c.id);
      rows.push({ kind: 'collection', key: c.id, collection: c, depth, count, expanded });
      visited.add(c.id);
      if (expanded) {
        walk(c.id, depth + 1);
        for (const b of childBookmarks.get(c.id) ?? []) {
          rows.push({ kind: 'bookmark', key: b.id, bookmark: b, depth: depth + 1 });
        }
      }
    }
    if (parentId === null) {
      for (const b of childBookmarks.get(null) ?? []) {
        rows.push({ kind: 'bookmark', key: b.id, bookmark: b, depth });
      }
    }
  };
  walk(null, 0);
  return rows;
}

/** The bookmarks of `rows`, in the order they appear — what j/k walks. */
export function visibleBookmarks(rows: readonly ListRow[]): Bookmark[] {
  return rows.filter((r) => r.kind === 'bookmark').map((r) => r.bookmark);
}

import type {
  BookmarkRef,
  Change,
  FolderNode,
  PreviewBadge,
  PreviewBookmark,
  PreviewNode,
} from './types';
import { pathKey } from './types';

type Mutable = PreviewNode & { children: Mutable[] };

export function buildPreviewTree(input: {
  folders: FolderNode[];
  bookmarks: BookmarkRef[];
  changes: Change[];
  selected: Set<string>;
}): PreviewNode[] {
  const { folders, bookmarks, changes, selected } = input;
  const active = changes.filter((c) => selected.has(c.key));

  // Effective path per existing folder, after selected renames.
  const renameByFolder = new Map<string, Extract<Change, { kind: 'folder-rename' }>>();
  for (const c of active) if (c.kind === 'folder-rename') renameByFolder.set(c.id, c);

  const mergedAway = new Set<string>();
  /** source folder id → the folder it is being folded into. */
  const mergeTargetById = new Map<string, string>();
  const mergeBadgeById = new Map<string, PreviewBadge>();
  for (const c of active) {
    if (c.kind !== 'folder-merge') continue;
    mergedAway.add(c.sourceId);
    mergeTargetById.set(c.sourceId, c.targetId);
    mergeBadgeById.set(c.targetId, {
      kind: 'merged',
      from: c.sourcePath[c.sourcePath.length - 1] ?? '',
    });
  }

  /**
   * The folder that survives after all selected merges. Merges chain — a
   * duplicate folds into its surviving copy, which may itself fold somewhere
   * else — so following one hop is not enough.
   */
  function survivorOf(id: string): string {
    let cur = id;
    for (let hop = 0; hop < mergeTargetById.size + 1; hop++) {
      const next = mergeTargetById.get(cur);
      if (next === undefined) return cur;
      cur = next;
    }
    return cur;
  }

  const deleteByFolder = new Map<string, Extract<Change, { kind: 'folder-delete' }>>();
  for (const c of active) if (c.kind === 'folder-delete') deleteByFolder.set(c.id, c);

  const roots: Mutable[] = [];
  const byKey = new Map<string, Mutable>();

  function ensure(path: string[]): Mutable {
    const key = pathKey(path);
    const found = byKey.get(key);
    if (found) return found;
    const node: Mutable = {
      id: `path:${key}`,
      name: path[path.length - 1] ?? 'Unfiled',
      path,
      badge: null,
      changeKey: null,
      children: [],
      bookmarks: [],
    };
    byKey.set(key, node);
    if (path.length <= 1) roots.push(node);
    else ensure(path.slice(0, -1)).children.push(node);
    return node;
  }

  // Existing folders, at their post-rename paths, minus merged-away ones.
  const effectivePathById = new Map<string, string[]>();
  const sortedFolders = [...folders].sort((a, b) => a.path.length - b.path.length);
  for (const f of sortedFolders) {
    if (mergedAway.has(f.id)) continue;
    const parentPath = f.parentId ? effectivePathById.get(f.parentId) : [];
    if (f.parentId && !parentPath) continue; // parent merged away; subtree follows it
    const rename = renameByFolder.get(f.id);
    const name = rename ? rename.to : f.name;
    const path = [...(parentPath ?? []), name];
    effectivePathById.set(f.id, path);

    const node = ensure(path);
    node.id = `folder:${f.id}`;
    if (rename) node.badge = { kind: 'renamed', from: rename.from };
    const del = deleteByFolder.get(f.id);
    if (del) {
      node.badge = { kind: 'deleted' };
      node.changeKey = del.key;
    } else if (rename) {
      node.changeKey = rename.key;
    }
  }

  // New folders.
  for (const c of active) {
    if (c.kind !== 'folder-new') continue;
    const node = ensure(c.path);
    if (node.badge === null) node.badge = { kind: 'new' };
    node.changeKey = c.key;
  }

  // Merge badges land on the surviving target, found by id: after a rename its
  // path is no longer the one recorded on the change.
  for (const [id, badge] of mergeBadgeById) {
    const path = effectivePathById.get(survivorOf(id));
    const node = path ? byKey.get(pathKey(path)) : undefined;
    if (node && node.badge === null) node.badge = badge;
  }
  for (const c of active) {
    if (c.kind !== 'folder-merge') continue;
    const path = effectivePathById.get(survivorOf(c.targetId));
    const node = path ? byKey.get(pathKey(path)) : undefined;
    if (node && node.changeKey === null) node.changeKey = c.key;
  }

  function effectivePathOf(original: string[]): string[] {
    if (original.length === 0) return [];
    const match = folders.find((f) => pathKey(f.path) === pathKey(original));
    if (!match) return original;
    return effectivePathById.get(survivorOf(match.id)) ?? original;
  }

  // Bookmarks, at their post-move locations.
  const moveById = new Map<string, Extract<Change, { kind: 'bookmark-move' }>>();
  for (const c of active) if (c.kind === 'bookmark-move') moveById.set(c.id, c);

  for (const b of bookmarks) {
    const move = moveById.get(b.id);
    const path = move ? move.toPath : effectivePathOf(b.path);
    const node = ensure(path);
    const row: PreviewBookmark = {
      id: b.id,
      title: b.title,
      fromPath: move ? move.fromPath : null,
      changeKey: move ? move.key : null,
    };
    node.bookmarks.push(row);
  }

  function sortNode(n: Mutable): void {
    n.children.sort((a, b) => a.name.localeCompare(b.name));
    n.bookmarks.sort((a, b) => a.title.localeCompare(b.title));
    n.children.forEach(sortNode);
  }
  roots.sort((a, b) => a.name.localeCompare(b.name));
  roots.forEach(sortNode);

  return roots;
}

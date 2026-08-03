import type { BookmarkRef, Change, FolderNode, ResortPlan } from './types';
import { isPathPrefix, pathKey } from './types';

export function planToChanges(input: {
  folders: FolderNode[];
  bookmarks: BookmarkRef[];
  plan: ResortPlan;
}): Change[] {
  const { folders, bookmarks, plan } = input;

  // Everything downstream of here — the model's own merge and rename
  // instructions, the preview tree, and apply's path resolution — treats a path
  // as a folder's identity. Two folders sharing a path break that assumption:
  // whichever landed in `byPath` last used to win, and the other became
  // invisible to the whole diff.
  //
  // So the first copy of each path is the canonical one, and every later copy
  // is folded into it by a merge the user can review like any other change.
  // Once those are applied, paths are unique again and the assumption holds.
  const byPath = new Map<string, FolderNode>();
  const duplicates: Array<{ source: FolderNode; target: FolderNode }> = [];
  for (const f of folders) {
    const k = pathKey(f.path);
    const canonical = byPath.get(k);
    if (canonical) duplicates.push({ source: f, target: canonical });
    else byPath.set(k, f);
  }

  const renames: Change[] = [];
  const merges: Change[] = [];
  const news: Change[] = [];
  const moves: Change[] = [];
  const deletes: Change[] = [];

  // --- renames -------------------------------------------------------------
  // Two folders that end up with the same name under the same parent are
  // indistinguishable in the sidebar, and `resolvePath` will only ever find the
  // first of them — so a rename that collides with a sibling is dropped.
  const siblingNames = new Map<string, Set<string>>(); // parentId → lowercased names
  const siblingKey = (parentId: string | null) => parentId ?? '';
  for (const f of folders) {
    const k = siblingKey(f.parentId);
    const set = siblingNames.get(k) ?? new Set<string>();
    set.add(f.name.trim().toLowerCase());
    siblingNames.set(k, set);
  }

  const renamedIds = new Set<string>();
  for (const r of plan.skeleton.renames) {
    const target = byPath.get(pathKey(r.from));
    if (!target) continue;
    const from = target.name.trim().toLowerCase();
    const to = r.to.trim().toLowerCase();
    if (from === to) continue;
    if (renamedIds.has(target.id)) continue;
    const siblings = siblingNames.get(siblingKey(target.parentId));
    if (siblings?.has(to)) continue;
    siblings?.delete(from);
    siblings?.add(to);
    renamedIds.add(target.id);
    renames.push({
      kind: 'folder-rename',
      key: `rename:${target.id}`,
      id: target.id,
      from: target.name,
      to: r.to,
      path: [...r.from.slice(0, -1), r.to],
    });
  }

  // --- merges --------------------------------------------------------------
  const mergedSourceIds = new Set<string>();
  const mergeTargetIds = new Set<string>();

  const addMerge = (source: FolderNode, target: FolderNode): void => {
    if (source.id === target.id) return;
    if (mergedSourceIds.has(source.id)) return;
    // Merging a folder into its own descendant would orphan the subtree.
    // Equal paths are the duplicate case, not ancestry — two distinct folders
    // at the same path are siblings, so the fold is exactly what we want.
    if (target.path.length > source.path.length && isPathPrefix(source.path, target.path)) return;
    mergedSourceIds.add(source.id);
    mergeTargetIds.add(target.id);
    merges.push({
      kind: 'folder-merge',
      key: `merge:${source.id}`,
      sourceId: source.id,
      targetId: target.id,
      sourcePath: source.path,
      targetPath: target.path,
    });
  };

  // Duplicates first, so the model cannot claim one as a merge source and leave
  // the library ambiguous.
  for (const d of duplicates) addMerge(d.source, d.target);

  for (const m of plan.skeleton.merges) {
    const source = byPath.get(pathKey(m.from));
    const target = byPath.get(pathKey(m.into));
    if (!source || !target) continue;
    addMerge(source, target);
  }

  // --- bookmark moves ------------------------------------------------------
  const emptiedFrom = new Map<string, number>(); // pathKey → bookmarks leaving
  const stillHolds = new Set<string>(); // pathKey of folders keeping bookmarks

  for (const b of bookmarks) {
    const filing = plan.filings.find((f) => f.id === b.id);
    if (!filing || pathKey(filing.path) === pathKey(b.path)) {
      if (b.path.length > 0) stillHolds.add(pathKey(b.path));
      continue;
    }
    moves.push({
      kind: 'bookmark-move',
      key: `move:${b.id}`,
      id: b.id,
      title: b.title,
      fromPath: b.path,
      toPath: filing.path,
    });
    if (b.path.length > 0) {
      const k = pathKey(b.path);
      emptiedFrom.set(k, (emptiedFrom.get(k) ?? 0) + 1);
    }
  }

  // --- new folders ---------------------------------------------------------
  // Only folders that will actually receive a bookmark are proposed. The model
  // is asked for a complete skeleton, so it routinely names folders nothing
  // gets filed into; and when the filing pass returns little or nothing, the
  // whole skeleton would otherwise land as a tree of empty folders.
  //
  // Every missing ancestor gets its own change so the user can reject a branch.
  const plannedNew = new Set<string>();
  const addNew = (path: string[]) => {
    for (let i = 1; i <= path.length; i++) {
      const prefix = path.slice(0, i);
      const k = pathKey(prefix);
      if (byPath.has(k) || plannedNew.has(k)) continue;
      plannedNew.add(k);
      news.push({ kind: 'folder-new', key: `new:${k}`, path: prefix });
    }
  };
  const destinations = new Set<string>();
  for (const m of moves) {
    if (m.kind !== 'bookmark-move') continue;
    destinations.add(pathKey(m.toPath));
  }
  // A parent that only holds sub-folders is still created, by addNew's ancestor
  // walk. A skeleton path that is neither a destination nor an ancestor of one
  // is dropped.
  for (const path of plan.skeleton.folders) {
    if (destinations.has(pathKey(path))) addNew(path);
  }

  // --- deletes -------------------------------------------------------------
  // A folder is deletable when it loses all its bookmarks, has no child
  // folders, and is neither a merge source (the merge removes it) nor a merge
  // target (it is about to receive content).
  const hasChild = new Set<string>();
  for (const f of folders) {
    if (f.parentId) hasChild.add(f.parentId);
  }
  for (const f of folders) {
    if (mergedSourceIds.has(f.id) || mergeTargetIds.has(f.id)) continue;
    if (hasChild.has(f.id)) continue;
    const k = pathKey(f.path);
    if (stillHolds.has(k)) continue;
    if (!emptiedFrom.has(k)) continue; // never held anything that moved out
    deletes.push({ kind: 'folder-delete', key: `del:${f.id}`, id: f.id, path: f.path });
  }

  return [...renames, ...merges, ...news, ...moves, ...deletes];
}

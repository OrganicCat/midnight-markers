import type { BookmarkRef, Change, FolderNode, ResortPlan } from './types';
import { isPathPrefix, pathKey } from './types';

export function planToChanges(input: {
  folders: FolderNode[];
  bookmarks: BookmarkRef[];
  plan: ResortPlan;
}): Change[] {
  const { folders, bookmarks, plan } = input;
  const byPath = new Map<string, FolderNode>();
  for (const f of folders) byPath.set(pathKey(f.path), f);

  const renames: Change[] = [];
  const merges: Change[] = [];
  const news: Change[] = [];
  const moves: Change[] = [];
  const deletes: Change[] = [];

  // --- renames -------------------------------------------------------------
  const renamedIds = new Set<string>();
  for (const r of plan.skeleton.renames) {
    const target = byPath.get(pathKey(r.from));
    if (!target) continue;
    if (target.name.trim().toLowerCase() === r.to.trim().toLowerCase()) continue;
    if (renamedIds.has(target.id)) continue;
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
  for (const m of plan.skeleton.merges) {
    const source = byPath.get(pathKey(m.from));
    const target = byPath.get(pathKey(m.into));
    if (!source || !target || source.id === target.id) continue;
    if (mergedSourceIds.has(source.id)) continue;
    // Merging a folder into its own descendant would orphan the subtree.
    if (isPathPrefix(source.path, target.path)) continue;
    mergedSourceIds.add(source.id);
    mergeTargetIds.add(target.id);
    merges.push({
      kind: 'folder-merge',
      key: `merge:${source.id}`,
      sourceId: source.id,
      sourcePath: source.path,
      targetPath: target.path,
    });
  }

  // --- new folders ---------------------------------------------------------
  // A skeleton path is new when no current folder has that path. Every missing
  // ancestor gets its own change so the user can reject a whole branch.
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
  for (const path of plan.skeleton.folders) addNew(path);

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

import type { Change } from './types';
import { isPathPrefix } from './types';

/**
 * The path a folder change lands on. Unchecking a folder change unchecks
 * everything at or under this path. Bookmark moves have no affected path —
 * they never own other changes.
 */
export function affectedPathOf(change: Change): string[] | null {
  switch (change.kind) {
    case 'folder-new': return change.path;
    case 'folder-rename': return change.path;
    case 'folder-merge': return change.sourcePath;
    case 'folder-delete': return change.path;
    case 'bookmark-move': return null;
  }
}

/** The destination path a change depends on existing, if any. */
function dependsOnPath(change: Change): string[] | null {
  switch (change.kind) {
    case 'bookmark-move': return change.toPath;
    case 'folder-new': return change.path;
    case 'folder-merge': return change.targetPath;
    default: return null;
  }
}

export function allKeys(changes: Change[]): Set<string> {
  return new Set(changes.map((c) => c.key));
}

export function toggle(changes: Change[], selected: Set<string>, key: string): Set<string> {
  const target = changes.find((c) => c.key === key);
  if (!target) return selected;

  const next = new Set(selected);
  const turningOn = !next.has(key);

  if (turningOn) {
    next.add(key);
    // Pull in the folder-new chain this change needs to exist.
    const need = dependsOnPath(target);
    if (need) {
      for (const c of changes) {
        if (c.kind !== 'folder-new') continue;
        if (c.key === key) continue;
        if (isPathPrefix(c.path, need)) next.add(c.key);
      }
    }
    return next;
  }

  next.delete(key);
  const owned = affectedPathOf(target);
  if (!owned) return next;

  for (const c of changes) {
    if (c.key === key) continue;
    const dep = dependsOnPath(c);
    if (dep && isPathPrefix(owned, dep)) next.delete(c.key);
    const own = affectedPathOf(c);
    if (own && own.length > owned.length && isPathPrefix(owned, own)) next.delete(c.key);
  }
  return next;
}

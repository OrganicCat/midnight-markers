import { getDb } from '$lib/storage/db';
import { collections } from '$lib/storage/collections';
import { bookmarks } from '$lib/storage/bookmarks';
import { snapshots } from '$lib/storage/snapshot';
import { log } from '$lib/log';
import type { Change } from './types';

export type ApplyResult = {
  renamed: number;
  merged: number;
  created: number;
  moved: number;
  deleted: number;
};

/**
 * Applies the accepted changes in dependency order and returns per-kind counts.
 * Writes an undo snapshot first. Changes whose target has disappeared are
 * skipped rather than thrown — the plan may be minutes old by the time the user
 * hits Apply.
 */
export async function applyChanges(changes: Change[]): Promise<ApplyResult> {
  const result: ApplyResult = { renamed: 0, merged: 0, created: 0, moved: 0, deleted: 0 };
  if (changes.length === 0) return result;

  await snapshots.save();

  for (const c of changes) {
    if (c.kind !== 'folder-rename') continue;
    const cur = await collections.get(c.id);
    if (!cur) continue;
    await collections.update(c.id, { name: c.to });
    result.renamed++;
  }

  for (const c of changes) {
    if (c.kind !== 'folder-merge') continue;
    const source = await collections.get(c.sourceId);
    if (!source) continue;
    // By id, not by path: when the merge exists to collapse two folders that
    // share a path, resolving that path would just find one of them at random.
    const targetId = (await collections.get(c.targetId))
      ? c.targetId
      : await collections.resolvePath(c.targetPath);
    if (targetId === c.sourceId) continue;

    try {
      await collections.absorb(c.sourceId, targetId);
    } catch (e) {
      log.warn('resort merge skipped', { source: c.sourceId, target: targetId, error: e });
      continue;
    }
    result.merged++;
  }

  for (const c of changes) {
    if (c.kind !== 'folder-new') continue;
    const before = (await collections.list()).length;
    await collections.resolvePath(c.path);
    if ((await collections.list()).length > before) result.created++;
  }

  for (const c of changes) {
    if (c.kind !== 'bookmark-move') continue;
    const cur = await bookmarks.get(c.id);
    if (!cur) continue;
    const targetId = await collections.resolvePath(c.toPath);
    if (cur.collectionId === targetId) continue;
    await bookmarks.update(c.id, { collectionId: targetId });
    result.moved++;
  }

  for (const c of changes) {
    if (c.kind !== 'folder-delete') continue;
    const cur = await collections.get(c.id);
    if (!cur) continue;
    const db = await getDb();
    const hasBookmarks = (await db.getAll('bookmarks')).some((b) => b.collectionId === c.id);
    const hasChildren = (await db.getAll('collections')).some((x) => x.parentId === c.id);
    if (hasBookmarks || hasChildren) continue;
    await collections.delete(c.id);
    result.deleted++;
  }

  log.info('resort applied', result);
  return result;
}

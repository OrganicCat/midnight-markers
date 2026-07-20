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
    const targetId = await collections.resolvePath(c.targetPath);
    if (targetId === c.sourceId) continue;

    const db = await getDb();
    for (const child of await db.getAll('collections')) {
      if (child.parentId === c.sourceId) await collections.update(child.id, { parentId: targetId });
    }
    for (const b of await db.getAll('bookmarks')) {
      if (b.collectionId === c.sourceId) await bookmarks.update(b.id, { collectionId: targetId });
    }
    await collections.delete(c.sourceId);
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

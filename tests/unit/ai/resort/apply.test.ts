import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetDbForTests, getDb } from '$lib/storage/db';
import { collections } from '$lib/storage/collections';
import { bookmarks } from '$lib/storage/bookmarks';
import { snapshots } from '$lib/storage/snapshot';
import { applyChanges } from '$lib/ai/resort/apply';
import { planToChanges } from '$lib/ai/resort/diff';
import { gatherScope } from '$lib/ai/resort/scope';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});

async function makeBookmark(collectionId: string | null, title = 'A') {
  return bookmarks.create({
    url: `https://example.com/${title}`,
    title,
    originalTitle: title,
    collectionId,
  });
}

describe('applyChanges', () => {
  it('writes an undo snapshot before touching anything', async () => {
    const old = await collections.create({ name: 'Old' });
    const b = await makeBookmark(old.id);
    await applyChanges([
      { kind: 'bookmark-move', key: 'move:x', id: b.id, title: 'A', fromPath: ['Old'], toPath: ['Dev'] },
    ]);
    const snap = await snapshots.get();
    expect(snap?.bookmarkAssignments).toEqual([{ id: b.id, collectionId: old.id }]);
  });

  it('renames a folder', async () => {
    const c = await collections.create({ name: 'Stuff' });
    const r = await applyChanges([
      { kind: 'folder-rename', key: 'rename:1', id: c.id, from: 'Stuff', to: 'Reference', path: ['Reference'] },
    ]);
    expect(r.renamed).toBe(1);
    expect((await collections.get(c.id))!.name).toBe('Reference');
  });

  it('merges a folder: moves its bookmarks and children, then deletes it', async () => {
    const target = await collections.create({ name: 'Dev' });
    const source = await collections.create({ name: 'Web Dev' });
    const child = await collections.create({ name: 'CSS', parentId: source.id });
    const b = await makeBookmark(source.id);

    const r = await applyChanges([
      {
        kind: 'folder-merge',
        key: 'merge:1',
        sourceId: source.id,
        targetId: target.id,
        sourcePath: ['Web Dev'],
        targetPath: ['Dev'],
      },
    ]);

    expect(r.merged).toBe(1);
    expect(await collections.get(source.id)).toBeNull();
    expect((await bookmarks.get(b.id))!.collectionId).toBe(target.id);
    expect((await collections.get(child.id))!.parentId).toBe(target.id);
  });

  it('creates new folders at the right depth', async () => {
    const r = await applyChanges([
      { kind: 'folder-new', key: 'new:1', path: ['A'] },
      { kind: 'folder-new', key: 'new:2', path: ['A', 'B'] },
    ]);
    expect(r.created).toBe(2);
    const all = await collections.listWithPaths();
    expect(all.map((c) => c.path.join(' > ')).sort()).toEqual(['A', 'A > B']);
  });

  it('moves a bookmark, creating the destination folder', async () => {
    const b = await makeBookmark(null);
    const r = await applyChanges([
      { kind: 'bookmark-move', key: 'move:1', id: b.id, title: 'A', fromPath: [], toPath: ['Dev', 'Rust'] },
    ]);
    expect(r.moved).toBe(1);
    const after = await bookmarks.get(b.id);
    expect(await collections.pathOf(after!.collectionId!)).toEqual(['Dev', 'Rust']);
  });

  it('reuses an existing folder rather than duplicating it', async () => {
    const dev = await collections.create({ name: 'Dev' });
    const b = await makeBookmark(null);
    await applyChanges([
      { kind: 'bookmark-move', key: 'move:1', id: b.id, title: 'A', fromPath: [], toPath: ['dev'] },
    ]);
    expect((await bookmarks.get(b.id))!.collectionId).toBe(dev.id);
    expect(await collections.list()).toHaveLength(1);
  });

  it('deletes an emptied folder', async () => {
    const old = await collections.create({ name: 'Old' });
    const b = await makeBookmark(old.id);
    const r = await applyChanges([
      { kind: 'bookmark-move', key: 'move:1', id: b.id, title: 'A', fromPath: ['Old'], toPath: ['Dev'] },
      { kind: 'folder-delete', key: 'del:1', id: old.id, path: ['Old'] },
    ]);
    expect(r.deleted).toBe(1);
    expect(await collections.get(old.id)).toBeNull();
  });

  it('refuses to delete a folder that still holds bookmarks', async () => {
    const old = await collections.create({ name: 'Old' });
    await makeBookmark(old.id, 'stays');
    const r = await applyChanges([{ kind: 'folder-delete', key: 'del:1', id: old.id, path: ['Old'] }]);
    expect(r.deleted).toBe(0);
    expect(await collections.get(old.id)).not.toBeNull();
  });

  it('skips a change whose target no longer exists instead of throwing', async () => {
    const r = await applyChanges([
      { kind: 'folder-rename', key: 'rename:1', id: 'ghost', from: 'X', to: 'Y', path: ['Y'] },
      { kind: 'bookmark-move', key: 'move:1', id: 'ghost', title: 'X', fromPath: [], toPath: ['Dev'] },
    ]);
    expect(r).toEqual({ renamed: 0, merged: 0, created: 0, moved: 0, deleted: 0 });
  });

  it('round-trips: apply then restore puts everything back', async () => {
    const old = await collections.create({ name: 'Old' });
    const b1 = await makeBookmark(old.id, 'one');
    const b2 = await makeBookmark(old.id, 'two');
    const before = (await collections.list()).map((c) => ({ id: c.id, name: c.name, parentId: c.parentId }));

    await applyChanges([
      { kind: 'folder-rename', key: 'rename:1', id: old.id, from: 'Old', to: 'Older', path: ['Older'] },
      { kind: 'folder-new', key: 'new:1', path: ['Dev'] },
      { kind: 'bookmark-move', key: 'move:1', id: b1.id, title: 'one', fromPath: ['Old'], toPath: ['Dev'] },
      { kind: 'bookmark-move', key: 'move:2', id: b2.id, title: 'two', fromPath: ['Old'], toPath: ['Dev'] },
    ]);

    expect(await snapshots.restore()).toBe(true);
    const after = (await collections.list()).map((c) => ({ id: c.id, name: c.name, parentId: c.parentId }));
    expect(after).toEqual(before);
    expect((await bookmarks.get(b1.id))!.collectionId).toBe(old.id);
    expect((await bookmarks.get(b2.id))!.collectionId).toBe(old.id);
  });

  it('collapses two same-named root collections end to end', async () => {
    // The user's case: two top-level "Games" folders, each holding bookmarks.
    const keep = await collections.create({ name: 'Games' });
    const db = await getDb();
    // Past create()'s guard, the way an older build could leave things.
    await db.put('collections', { ...keep, id: 'dup', name: 'Games', sortOrder: 1 });
    const a = await makeBookmark(keep.id, 'a');
    const b = await makeBookmark('dup', 'b');

    const { folders, bookmarks: refs } = await gatherScope({ kind: 'all' });
    expect(folders).toHaveLength(2);

    const changes = planToChanges({
      folders,
      bookmarks: refs,
      plan: {
        skeleton: { folders: [['Games']], renames: [], merges: [] },
        filings: [
          { id: a.id, path: ['Games'] },
          { id: b.id, path: ['Games'] },
        ],
        unplannedIds: [],
      },
    });

    const result = await applyChanges(changes);

    expect(result.merged).toBe(1);
    const left = await collections.list();
    expect(left.map((c) => c.name)).toEqual(['Games']);
    expect((await bookmarks.get(a.id))!.collectionId).toBe(keep.id);
    expect((await bookmarks.get(b.id))!.collectionId).toBe(keep.id);
  });
});

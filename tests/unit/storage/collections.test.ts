import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetDbForTests, getDb } from '$lib/storage/db';
import { collections } from '$lib/storage/collections';
import { bookmarks } from '$lib/storage/bookmarks';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});

describe('collections', () => {
  it('creates with defaults and returns the row', async () => {
    const c = await collections.create({ name: 'Reading' });
    expect(c.name).toBe('Reading');
    expect(c.parentId).toBeNull();
    expect(c.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(c.id).toHaveLength(26);
  });

  it('lists collections, ordered by sortOrder asc', async () => {
    await collections.create({ name: 'A' });
    await collections.create({ name: 'B' });
    const rows = await collections.list();
    expect(rows.map((r) => r.name)).toEqual(['A', 'B']);
  });

  it('updates name and color', async () => {
    const c = await collections.create({ name: 'X' });
    const updated = await collections.update(c.id, { name: 'X2', color: '#ff0000' });
    expect(updated.name).toBe('X2');
    expect(updated.color).toBe('#ff0000');
  });

  it('delete removes the row', async () => {
    const c = await collections.create({ name: 'Tmp' });
    await collections.delete(c.id);
    expect(await collections.list()).toHaveLength(0);
  });

  it('resolvePath creates a single new top-level collection', async () => {
    const id = await collections.resolvePath(['Gaming']);
    const c = await collections.get(id);
    expect(c?.name).toBe('Gaming');
    expect(c?.parentId).toBeNull();
  });

  it('resolvePath creates a nested chain when none exists', async () => {
    const id = await collections.resolvePath(['Gaming', 'Path of Exile', 'Builds']);
    const leaf = await collections.get(id);
    expect(leaf?.name).toBe('Builds');
    expect(leaf?.parentId).not.toBeNull();
    const parent = await collections.get(leaf!.parentId!);
    expect(parent?.name).toBe('Path of Exile');
    const grand = await collections.get(parent!.parentId!);
    expect(grand?.name).toBe('Gaming');
    expect(grand?.parentId).toBeNull();
  });

  it('resolvePath reuses an existing chain (case-insensitive)', async () => {
    const a = await collections.create({ name: 'Gaming' });
    const b = await collections.create({ name: 'Path of Exile', parentId: a.id });
    const id = await collections.resolvePath(['gaming', 'PATH OF EXILE']);
    expect(id).toBe(b.id);
    expect(await collections.list()).toHaveLength(2);
  });

  it('resolvePath caps depth at MAX_COLLECTION_DEPTH (3)', async () => {
    const id = await collections.resolvePath(['A', 'B', 'C', 'D', 'E']);
    const path = await collections.pathOf(id);
    expect(path).toEqual(['A', 'B', 'C']);
  });

  it('move re-parents a collection under a target', async () => {
    const parent = await collections.create({ name: 'Learning' });
    const child = await collections.create({ name: 'AI' });
    await collections.move(child.id, parent.id, 0);
    const moved = await collections.get(child.id);
    expect(moved?.parentId).toBe(parent.id);
    expect(moved?.sortOrder).toBe(0);
  });

  it('move reorders siblings and renumbers sortOrder densely', async () => {
    const a = await collections.create({ name: 'A' });
    const b = await collections.create({ name: 'B' });
    const c = await collections.create({ name: 'C' });
    // Move C to the front of the root group.
    await collections.move(c.id, null, 0);
    const order = (await collections.list())
      .filter((x) => x.parentId === null)
      .sort((x, y) => x.sortOrder - y.sortOrder)
      .map((x) => x.name);
    expect(order).toEqual(['C', 'A', 'B']);
    expect((await collections.get(a.id))?.sortOrder).toBe(1);
    expect((await collections.get(b.id))?.sortOrder).toBe(2);
  });

  it('move clamps an out-of-range index to the end of the group', async () => {
    const parent = await collections.create({ name: 'P' });
    await collections.create({ name: 'X', parentId: parent.id });
    const y = await collections.create({ name: 'Y' });
    await collections.move(y.id, parent.id, 999);
    const kids = (await collections.list())
      .filter((c) => c.parentId === parent.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => c.name);
    expect(kids).toEqual(['X', 'Y']);
  });

  it('move rejects dropping a collection onto its own descendant (cycle)', async () => {
    const a = await collections.create({ name: 'A' });
    const b = await collections.create({ name: 'B', parentId: a.id });
    const c = await collections.create({ name: 'C', parentId: b.id });
    await collections.move(a.id, c.id, 0); // would make A a child of its own grandchild
    expect((await collections.get(a.id))?.parentId).toBeNull();
    expect((await collections.get(b.id))?.parentId).toBe(a.id);
    expect((await collections.get(c.id))?.parentId).toBe(b.id);
  });

  it('move to a null parent promotes a nested collection to the top level', async () => {
    const parent = await collections.create({ name: 'Parent' });
    const child = await collections.create({ name: 'Child', parentId: parent.id });
    await collections.move(child.id, null, 0);
    expect((await collections.get(child.id))?.parentId).toBeNull();
  });

  // --- duplicate prevention ------------------------------------------------

  it('create returns the existing sibling instead of a duplicate name', async () => {
    const first = await collections.create({ name: 'Games' });
    const second = await collections.create({ name: 'games' });
    expect(second.id).toBe(first.id);
    expect(await collections.list()).toHaveLength(1);
  });

  it('create still allows the same name under a different parent', async () => {
    const parent = await collections.create({ name: 'Gaming' });
    const root = await collections.create({ name: 'Builds' });
    const nested = await collections.create({ name: 'Builds', parentId: parent.id });
    expect(nested.id).not.toBe(root.id);
    expect(await collections.list()).toHaveLength(3);
  });

  it('move refuses to create a same-named sibling', async () => {
    const parent = await collections.create({ name: 'Gaming' });
    await collections.create({ name: 'Builds', parentId: parent.id });
    const stray = await collections.create({ name: 'builds' });
    const result = await collections.move(stray.id, parent.id, 0);
    expect(result).toEqual({ ok: false, reason: 'name-collision' });
    expect((await collections.get(stray.id))?.parentId).toBeNull();
  });

  it('move reports a rejected cycle rather than silently doing nothing', async () => {
    const a = await collections.create({ name: 'A' });
    const b = await collections.create({ name: 'B', parentId: a.id });
    const result = await collections.move(a.id, b.id, 0);
    expect(result).toEqual({ ok: false, reason: 'cycle' });
  });

  it('move reports success on a normal move', async () => {
    const parent = await collections.create({ name: 'P' });
    const child = await collections.create({ name: 'C' });
    expect(await collections.move(child.id, parent.id, 0)).toEqual({ ok: true });
  });

  // --- duplicates & repair ---------------------------------------------------

  it('duplicateSiblings finds same-named siblings and ignores other parents', async () => {
    const a = await collections.create({ name: 'Games' });
    const db = await getDb();
    // Force a duplicate past create()'s guard, as older builds could produce.
    await db.put('collections', { ...a, id: 'dup', name: 'games' });
    const parent = await collections.create({ name: 'Elsewhere' });
    await db.put('collections', { ...a, id: 'nested', name: 'Games', parentId: parent.id });

    const dups = await collections.duplicateSiblings(a.id);
    expect(dups.map((d) => d.id)).toEqual(['dup']);
  });

  it('absorb moves bookmarks and child folders, then deletes the source', async () => {
    const target = await collections.create({ name: 'Games' });
    const db = await getDb();
    await db.put('collections', { ...target, id: 'dup', name: 'Games' });
    await db.put('collections', { ...target, id: 'kid', name: 'PoE', parentId: 'dup' });
    const b = await bookmarks.create({ url: 'https://x.com', title: 'x', originalTitle: 'x' });
    await bookmarks.update(b.id, { collectionId: 'dup' });

    const moved = await collections.absorb('dup', target.id);

    expect(moved).toEqual({ bookmarks: 1, children: 1 });
    expect(await collections.get('dup')).toBeNull();
    expect((await collections.get('kid'))?.parentId).toBe(target.id);
    expect((await bookmarks.get(b.id))?.collectionId).toBe(target.id);
  });

  it('absorb refuses to fold a collection into itself or its own descendant', async () => {
    const a = await collections.create({ name: 'A' });
    const b = await collections.create({ name: 'B', parentId: a.id });
    await expect(collections.absorb(a.id, a.id)).rejects.toThrow();
    await expect(collections.absorb(a.id, b.id)).rejects.toThrow();
  });

  // --- remove ---------------------------------------------------------------

  it('remove unfiles its bookmarks and promotes its children', async () => {
    const parent = await collections.create({ name: 'Parent' });
    const doomed = await collections.create({ name: 'Doomed', parentId: parent.id });
    const kid = await collections.create({ name: 'Kid', parentId: doomed.id });
    const b = await bookmarks.create({ url: 'https://y.com', title: 'y', originalTitle: 'y' });
    await bookmarks.update(b.id, { collectionId: doomed.id });

    const freed = await collections.remove(doomed.id);

    expect(freed).toEqual({ bookmarks: 1, children: 1 });
    expect(await collections.get(doomed.id)).toBeNull();
    expect((await collections.get(kid.id))?.parentId).toBe(parent.id);
    expect((await bookmarks.get(b.id))?.collectionId).toBeNull();
  });

  it('remove promotes children of a top-level collection to the root', async () => {
    const top = await collections.create({ name: 'Top' });
    const kid = await collections.create({ name: 'Kid', parentId: top.id });
    await collections.remove(top.id);
    expect((await collections.get(kid.id))?.parentId).toBeNull();
  });

  it('countContents reports direct bookmarks and children', async () => {
    const c = await collections.create({ name: 'C' });
    await collections.create({ name: 'Kid', parentId: c.id });
    const b = await bookmarks.create({ url: 'https://z.com', title: 'z', originalTitle: 'z' });
    await bookmarks.update(b.id, { collectionId: c.id });
    expect(await collections.countContents(c.id)).toEqual({ bookmarks: 1, children: 1 });
  });

  it('listWithPaths returns paths and depth', async () => {
    const a = await collections.create({ name: 'Gaming' });
    const b = await collections.create({ name: 'PoE', parentId: a.id });
    void b;
    const out = await collections.listWithPaths();
    const gaming = out.find((c) => c.name === 'Gaming');
    const poe = out.find((c) => c.name === 'PoE');
    expect(gaming?.path).toEqual(['Gaming']);
    expect(gaming?.depth).toBe(0);
    expect(poe?.path).toEqual(['Gaming', 'PoE']);
    expect(poe?.depth).toBe(1);
  });
});

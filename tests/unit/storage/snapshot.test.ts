import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetDbForTests, getDb } from '$lib/storage/db';
import { collections } from '$lib/storage/collections';
import { bookmarks } from '$lib/storage/bookmarks';
import { snapshots } from '$lib/storage/snapshot';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});

async function seed() {
  const dev = await collections.create({ name: 'Dev' });
  const old = await collections.create({ name: 'Old' });
  const b = await bookmarks.create({
    url: 'https://example.com/a',
    title: 'A',
    originalTitle: 'A',
    collectionId: old.id,
  });
  return { dev, old, b };
}

describe('snapshots', () => {
  it('has a snapshots object store at the current DB version', async () => {
    const db = await getDb();
    expect([...db.objectStoreNames]).toContain('snapshots');
  });

  it('returns null before anything is saved', async () => {
    expect(await snapshots.get()).toBeNull();
  });

  it('captures the whole tree and every bookmark assignment', async () => {
    const { old, b } = await seed();
    const snap = await snapshots.save();
    expect(snap.collections).toHaveLength(2);
    expect(snap.bookmarkAssignments).toEqual([{ id: b.id, collectionId: old.id }]);
    expect(snap.createdAt).toBeGreaterThan(0);
  });

  it('restores moved bookmarks', async () => {
    const { dev, old, b } = await seed();
    await snapshots.save();
    await bookmarks.update(b.id, { collectionId: dev.id });
    expect((await bookmarks.get(b.id))!.collectionId).toBe(dev.id);

    expect(await snapshots.restore()).toBe(true);
    expect((await bookmarks.get(b.id))!.collectionId).toBe(old.id);
  });

  it('restores deleted collections and removes ones created after the snapshot', async () => {
    const { old } = await seed();
    await snapshots.save();
    await collections.delete(old.id);
    const extra = await collections.create({ name: 'Extra' });

    await snapshots.restore();
    const after = await collections.list();
    expect(after.map((c) => c.name).sort()).toEqual(['Dev', 'Old']);
    expect(after.find((c) => c.id === extra.id)).toBeUndefined();
    expect(after.find((c) => c.id === old.id)?.name).toBe('Old');
  });

  it('clears the slot after restoring', async () => {
    await seed();
    await snapshots.save();
    await snapshots.restore();
    expect(await snapshots.get()).toBeNull();
  });

  it('returns false when there is nothing to restore', async () => {
    expect(await snapshots.restore()).toBe(false);
  });

  it('keeps only one slot — a second save overwrites the first', async () => {
    await seed();
    await snapshots.save();
    await collections.create({ name: 'Later' });
    const second = await snapshots.save();
    expect(second.collections).toHaveLength(3);
    const db = await getDb();
    expect(await db.count('snapshots')).toBe(1);
  });

  it('clear() empties the slot', async () => {
    await seed();
    await snapshots.save();
    await snapshots.clear();
    expect(await snapshots.get()).toBeNull();
  });
});

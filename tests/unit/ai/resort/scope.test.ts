import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetDbForTests } from '$lib/storage/db';
import { collections } from '$lib/storage/collections';
import { bookmarks } from '$lib/storage/bookmarks';
import { gatherScope } from '$lib/ai/resort/scope';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});

async function seed() {
  const dev = await collections.create({ name: 'Dev' });
  const rust = await collections.create({ name: 'Rust', parentId: dev.id });
  const cooking = await collections.create({ name: 'Cooking' });
  const inRust = await bookmarks.create({
    url: 'https://rust-lang.org', title: 'Rust', originalTitle: 'Rust', collectionId: rust.id,
  });
  const inCooking = await bookmarks.create({
    url: 'https://example.com/soup', title: 'Soup', originalTitle: 'Soup', collectionId: cooking.id,
  });
  const loose = await bookmarks.create({
    url: 'https://example.com/loose', title: 'Loose', originalTitle: 'Loose', collectionId: null,
  });
  return { dev, rust, cooking, inRust, inCooking, loose };
}

describe('gatherScope', () => {
  it('collects everything for scope all, including unfiled bookmarks', async () => {
    const { loose } = await seed();
    const out = await gatherScope({ kind: 'all' });
    expect(out.folders).toHaveLength(3);
    expect(out.bookmarks).toHaveLength(3);
    expect(out.bookmarks.find((b) => b.id === loose.id)?.path).toEqual([]);
  });

  it('gives each folder its full path', async () => {
    await seed();
    const out = await gatherScope({ kind: 'all' });
    expect(out.folders.map((f) => f.path.join(' > ')).sort()).toEqual(['Cooking', 'Dev', 'Dev > Rust']);
  });

  it('gives each bookmark its current folder path', async () => {
    const { inRust } = await seed();
    const out = await gatherScope({ kind: 'all' });
    expect(out.bookmarks.find((b) => b.id === inRust.id)?.path).toEqual(['Dev', 'Rust']);
  });

  it('limits a collection scope to that subtree', async () => {
    const { dev, inRust } = await seed();
    const out = await gatherScope({ kind: 'collection', id: dev.id });
    expect(out.folders.map((f) => f.name).sort()).toEqual(['Dev', 'Rust']);
    expect(out.bookmarks.map((b) => b.id)).toEqual([inRust.id]);
  });

  it('excludes unfiled bookmarks from a collection scope', async () => {
    const { dev, loose } = await seed();
    const out = await gatherScope({ kind: 'collection', id: dev.id });
    expect(out.bookmarks.find((b) => b.id === loose.id)).toBeUndefined();
  });

  it('returns empty for an unknown collection', async () => {
    await seed();
    expect(await gatherScope({ kind: 'collection', id: 'ghost' })).toEqual({ folders: [], bookmarks: [] });
  });

  it('carries the bookmark domain through for the prompt', async () => {
    const { inRust } = await seed();
    const out = await gatherScope({ kind: 'all' });
    expect(out.bookmarks.find((b) => b.id === inRust.id)?.domain).toBe('rust-lang.org');
  });
});

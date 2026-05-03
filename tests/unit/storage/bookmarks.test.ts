import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetDbForTests } from '$lib/storage/db';
import { bookmarks } from '$lib/storage/bookmarks';
import { tags } from '$lib/storage/tags';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});

describe('bookmarks', () => {
  it('create populates id, timestamps, defaults, and domain', async () => {
    const b = await bookmarks.create({
      url: 'https://example.com/foo',
      title: 'Foo',
      originalTitle: 'Foo',
    });
    expect(b.id).toHaveLength(26);
    expect(b.domain).toBe('example.com');
    expect(b.unread).toBe(true);
    expect(b.starred).toBe(false);
    expect(b.tagIds).toEqual([]);
    expect(b.collectionId).toBeNull();
    expect(b.createdAt).toBeGreaterThan(0);
    expect(b.updatedAt).toBe(b.createdAt);
  });

  it('update bumps updatedAt and applies patch', async () => {
    const b = await bookmarks.create({ url: 'https://x', title: 'X', originalTitle: 'X' });
    await new Promise((r) => setTimeout(r, 2));
    const u = await bookmarks.update(b.id, { starred: true, title: 'X-edit' });
    expect(u.starred).toBe(true);
    expect(u.title).toBe('X-edit');
    expect(u.updatedAt).toBeGreaterThan(b.updatedAt);
  });

  it('delete removes the row', async () => {
    const b = await bookmarks.create({ url: 'https://x', title: 'X', originalTitle: 'X' });
    await bookmarks.delete(b.id);
    expect(await bookmarks.get(b.id)).toBeNull();
  });

  it('addTag increments tag count and updates bookmark.tagIds', async () => {
    const b = await bookmarks.create({ url: 'https://x', title: 'X', originalTitle: 'X' });
    const t = await tags.upsertByName('design');
    await bookmarks.addTag(b.id, t.id);
    const after = await bookmarks.get(b.id);
    expect(after!.tagIds).toEqual([t.id]);
    expect((await tags.get(t.id))!.count).toBe(1);
  });

  it('removeTag decrements tag count and removes id from bookmark', async () => {
    const b = await bookmarks.create({ url: 'https://x', title: 'X', originalTitle: 'X' });
    const t = await tags.upsertByName('design');
    await bookmarks.addTag(b.id, t.id);
    await bookmarks.removeTag(b.id, t.id);
    const after = await bookmarks.get(b.id);
    expect(after!.tagIds).toEqual([]);
    expect((await tags.get(t.id))!.count).toBe(0);
  });

  it('list with no filter returns all sorted createdAt desc', async () => {
    const a = await bookmarks.create({ url: 'https://a', title: 'A', originalTitle: 'A' });
    await new Promise((r) => setTimeout(r, 2));
    const b = await bookmarks.create({ url: 'https://b', title: 'B', originalTitle: 'B' });
    const list = await bookmarks.list({});
    expect(list.map((x) => x.id)).toEqual([b.id, a.id]);
  });

  it('list filters by collectionId', async () => {
    const a = await bookmarks.create({ url: 'https://a', title: 'A', originalTitle: 'A' });
    await bookmarks.update(a.id, { collectionId: 'COL-1' });
    await bookmarks.create({ url: 'https://b', title: 'B', originalTitle: 'B' });
    const list = await bookmarks.list({ collectionId: 'COL-1' });
    expect(list.map((x) => x.url)).toEqual(['https://a']);
  });

  it('list filters by smart=starred', async () => {
    const a = await bookmarks.create({ url: 'https://a', title: 'A', originalTitle: 'A' });
    await bookmarks.create({ url: 'https://b', title: 'B', originalTitle: 'B' });
    await bookmarks.update(a.id, { starred: true });
    const list = await bookmarks.list({ smart: 'starred' });
    expect(list.map((x) => x.url)).toEqual(['https://a']);
  });

  it('list applies search across title and url', async () => {
    await bookmarks.create({ url: 'https://blog.example.com/types', title: 'Type theory', originalTitle: 'Type theory' });
    await bookmarks.create({ url: 'https://other.com/foo', title: 'Foo', originalTitle: 'Foo' });
    const list = await bookmarks.list({ search: 'type' });
    expect(list).toHaveLength(1);
    expect(list[0]!.title).toBe('Type theory');
  });
});

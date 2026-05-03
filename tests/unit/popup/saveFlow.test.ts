import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetDbForTests } from '$lib/storage/db';
import { bookmarks } from '$lib/storage/bookmarks';
import { performSave } from '../../../src/popup/saveFlow';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});

describe('performSave', () => {
  it('creates a bookmark from extracted metadata', async () => {
    const id = await performSave({
      url: 'https://example.com/foo',
      extracted: {
        title: 'Foo',
        description: 'About foo',
        faviconUrl: 'https://example.com/favicon.ico',
        ogImageUrl: 'https://example.com/og.png',
        excerpt: 'lorem ipsum',
      },
    });
    const b = await bookmarks.get(id);
    expect(b).not.toBeNull();
    expect(b!.title).toBe('Foo');
    expect(b!.originalTitle).toBe('Foo');
    expect(b!.description).toBe('About foo');
    expect(b!.thumbnailUrl).toBe('https://example.com/og.png');
    expect(b!.faviconUrl).toBe('https://example.com/favicon.ico');
  });

  it('falls back to URL when title is empty', async () => {
    const id = await performSave({
      url: 'https://example.com/foo',
      extracted: {
        title: '',
        description: null,
        faviconUrl: null,
        ogImageUrl: null,
        excerpt: null,
      },
    });
    const b = await bookmarks.get(id);
    expect(b!.title).toBe('https://example.com/foo');
  });
});

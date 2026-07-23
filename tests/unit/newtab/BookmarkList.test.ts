import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import BookmarkList from '../../../src/newtab/BookmarkList.svelte';
import { buildListRows } from '../../../src/newtab/listTree';
import type { Bookmark, Collection } from '../../../src/lib/types';

function col(id: string, name: string, parentId: string | null = null): Collection {
  return { id, name, parentId, color: '#fff', sortOrder: 0, createdAt: 0 };
}

function bm(id: string, title: string, collectionId: string | null = null): Bookmark {
  return {
    id,
    url: `https://example.com/${id}`,
    title,
    originalTitle: title,
    domain: 'example.com',
    faviconUrl: null,
    thumbnailUrl: null,
    description: null,
    excerpt: null,
    collectionId,
    tagIds: [],
    starred: false,
    unread: false,
    note: null,
    createdAt: Date.now(),
    updatedAt: 0,
    lastCheckedAt: null,
    isBroken: false,
  };
}

const noop = () => {};

describe('BookmarkList', () => {
  const collections = [col('tools', 'Tools')];
  const items = [bm('b1', 'Zed', 'tools'), bm('b2', 'Loose page')];

  it('renders collection rows alongside their bookmarks', () => {
    const { getByText, getByLabelText } = render(BookmarkList, {
      rows: buildListRows(items, collections),
      tags: [],
      onOpen: noop,
      onDelete: noop,
      onToggleCollection: noop,
    });
    expect(getByLabelText('Tools, 1 bookmark')).toBeTruthy();
    expect(getByText('Zed')).toBeTruthy();
    expect(getByText('Loose page')).toBeTruthy();
  });

  it('reports expansion state and emits a toggle when a folder is clicked', async () => {
    let toggled: string | null = null;
    const { getByLabelText } = render(BookmarkList, {
      rows: buildListRows(items, collections),
      tags: [],
      onOpen: noop,
      onDelete: noop,
      onToggleCollection: (id: string) => (toggled = id),
    });
    const folder = getByLabelText('Tools, 1 bookmark');
    expect(folder.getAttribute('aria-expanded')).toBe('true');
    await fireEvent.click(folder);
    expect(toggled).toBe('tools');
  });

  it('hides a collapsed folder’s bookmarks', () => {
    const { queryByText, getByLabelText } = render(BookmarkList, {
      rows: buildListRows(items, collections, { collapsed: new Set(['tools']) }),
      tags: [],
      onOpen: noop,
      onDelete: noop,
      onToggleCollection: noop,
    });
    expect(getByLabelText('Tools, 1 bookmark').getAttribute('aria-expanded')).toBe('false');
    expect(queryByText('Zed')).toBeNull();
    expect(queryByText('Loose page')).toBeTruthy();
  });

  it('opens a bookmark on click', async () => {
    let opened: Bookmark | null = null;
    const { getByText } = render(BookmarkList, {
      rows: buildListRows(items, collections),
      tags: [],
      onOpen: (b: Bookmark) => (opened = b),
      onDelete: noop,
      onToggleCollection: noop,
    });
    await fireEvent.click(getByText('Zed'));
    expect(opened && (opened as Bookmark).id).toBe('b1');
  });
});

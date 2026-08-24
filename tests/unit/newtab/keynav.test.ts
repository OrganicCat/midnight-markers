import { describe, it, expect } from 'vitest';
import { stepIndex, gridDelta, enterAction, folderArrow, navigableRows } from '../../../src/newtab/keynav';
import type { ListRow } from '../../../src/newtab/listTree';
import type { Bookmark, Collection } from '../../../src/lib/types';

function col(id: string, name = id): Collection {
  return { id, name, parentId: null, color: '#fff', sortOrder: 0, createdAt: 0 };
}

function bm(id: string): Bookmark {
  return {
    id,
    url: `https://example.com/${id}`,
    title: id,
    originalTitle: id,
    domain: 'example.com',
    faviconUrl: null,
    thumbnailUrl: null,
    description: null,
    excerpt: null,
    collectionId: null,
    tagIds: [],
    starred: false,
    unread: false,
    note: null,
    createdAt: 0,
    updatedAt: 0,
    isBroken: false,
    lastCheckedAt: null,
  } as Bookmark;
}

const folderRow = (id: string, expanded: boolean): ListRow => ({
  kind: 'collection',
  key: id,
  collection: col(id),
  depth: 0,
  count: 1,
  expanded,
});

const bookmarkRow = (id: string): ListRow => ({
  kind: 'bookmark',
  key: id,
  bookmark: bm(id),
  depth: 0,
});

describe('stepIndex', () => {
  it('moves by the delta', () => {
    expect(stepIndex(2, 5, 1)).toBe(3);
    expect(stepIndex(2, 5, -1)).toBe(1);
    expect(stepIndex(4, 9, 3)).toBe(7);
  });

  it('stops at the ends rather than wrapping', () => {
    expect(stepIndex(0, 5, -1)).toBe(0);
    expect(stepIndex(4, 5, 1)).toBe(4);
    expect(stepIndex(4, 5, 3)).toBe(4);
    expect(stepIndex(1, 5, -3)).toBe(0);
  });

  it('holds still when there is nothing to walk', () => {
    expect(stepIndex(0, 0, 1)).toBe(0);
    expect(stepIndex(0, 0, -1)).toBe(0);
  });
});

describe('gridDelta', () => {
  it('walks sideways one card at a time', () => {
    expect(gridDelta('ArrowRight', 4)).toBe(1);
    expect(gridDelta('ArrowLeft', 4)).toBe(-1);
  });

  it('walks vertically a whole row at a time', () => {
    expect(gridDelta('ArrowDown', 4)).toBe(4);
    expect(gridDelta('ArrowUp', 4)).toBe(-4);
  });

  it('treats a single-column grid as a plain list', () => {
    expect(gridDelta('ArrowDown', 1)).toBe(1);
    expect(gridDelta('ArrowUp', 1)).toBe(-1);
  });

  it('falls back to one row when the column count is unusable', () => {
    expect(gridDelta('ArrowDown', 0)).toBe(1);
    expect(gridDelta('ArrowUp', Number.NaN)).toBe(-1);
  });

  it('ignores keys that are not arrows', () => {
    expect(gridDelta('Enter', 4)).toBeNull();
    expect(gridDelta('a', 4)).toBeNull();
  });
});

describe('enterAction', () => {
  it('opens a bookmark', () => {
    expect(enterAction(bookmarkRow('b1'))).toEqual({ kind: 'open', id: 'b1' });
  });

  it('toggles a folder', () => {
    expect(enterAction(folderRow('c1', true))).toEqual({ kind: 'toggle', id: 'c1' });
    expect(enterAction(folderRow('c1', false))).toEqual({ kind: 'toggle', id: 'c1' });
  });

  it('does nothing when the cursor is on nothing', () => {
    expect(enterAction(undefined)).toBeNull();
  });
});

describe('folderArrow', () => {
  it('opens a shut folder with Right', () => {
    expect(folderArrow(folderRow('c1', false), 'ArrowRight')).toBe('c1');
  });

  it('shuts an open folder with Left', () => {
    expect(folderArrow(folderRow('c1', true), 'ArrowLeft')).toBe('c1');
  });

  it('leaves a folder alone when the arrow points the way it already is', () => {
    expect(folderArrow(folderRow('c1', true), 'ArrowRight')).toBeNull();
    expect(folderArrow(folderRow('c1', false), 'ArrowLeft')).toBeNull();
  });

  it('ignores bookmarks and empty rows', () => {
    expect(folderArrow(bookmarkRow('b1'), 'ArrowRight')).toBeNull();
    expect(folderArrow(bookmarkRow('b1'), 'ArrowLeft')).toBeNull();
    expect(folderArrow(undefined, 'ArrowLeft')).toBeNull();
  });
});

describe('navigableRows', () => {
  const rows = [folderRow('c1', true), bookmarkRow('b1'), bookmarkRow('b2')];

  it('walks folders and bookmarks alike while browsing', () => {
    expect(navigableRows(rows, false).map((r) => r.key)).toEqual(['c1', 'b1', 'b2']);
  });

  it('skips folders while a search or filter is on, since their folds are inert', () => {
    expect(navigableRows(rows, true).map((r) => r.key)).toEqual(['b1', 'b2']);
  });
});

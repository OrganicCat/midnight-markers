import { describe, it, expect } from 'vitest';
import { buildListRows, visibleBookmarks, type ListRow } from '../../../src/newtab/listTree';
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
    createdAt: 0,
    updatedAt: 0,
    lastCheckedAt: null,
    isBroken: false,
  };
}

const labels = (rows: ListRow[]): string[] =>
  rows.map((r) => `${'  '.repeat(r.depth)}${r.kind === 'collection' ? r.collection.name + '/' : r.bookmark.title}`);

describe('buildListRows', () => {
  it('nests collections and their bookmarks, alphabetically, folders first', () => {
    const collections = [col('tools', 'Tools'), col('learn', 'Learning'), col('ai', 'AI', 'learn')];
    const items = [
      bm('b1', 'Zed', 'tools'),
      bm('b2', 'Ableton', 'tools'),
      bm('b3', 'Prompting', 'ai'),
      bm('b4', 'Syllabus', 'learn'),
      bm('b5', 'Loose page'),
    ];

    expect(labels(buildListRows(items, collections))).toEqual([
      'Learning/',
      '  AI/',
      '    Prompting',
      '  Syllabus',
      'Tools/',
      '  Ableton',
      '  Zed',
      'Loose page',
    ]);
  });

  it('sorts case-insensitively', () => {
    const rows = buildListRows([bm('b1', 'zebra'), bm('b2', 'Apple'), bm('b3', 'banana')], []);
    expect(labels(rows)).toEqual(['Apple', 'banana', 'zebra']);
  });

  it('hides the children of a collapsed collection but keeps its count', () => {
    const collections = [col('learn', 'Learning'), col('ai', 'AI', 'learn')];
    const items = [bm('b1', 'Prompting', 'ai'), bm('b2', 'Syllabus', 'learn')];

    const rows = buildListRows(items, collections, { collapsed: new Set(['learn']) });
    expect(labels(rows)).toEqual(['Learning/']);
    expect(rows[0]).toMatchObject({ kind: 'collection', expanded: false, count: 2 });
  });

  it('counts bookmarks in nested collections', () => {
    const rows = buildListRows(
      [bm('b1', 'A', 'ai'), bm('b2', 'B', 'learn')],
      [col('learn', 'Learning'), col('ai', 'AI', 'learn')],
    );
    const learning = rows.find((r) => r.kind === 'collection' && r.collection.id === 'learn');
    expect(learning).toMatchObject({ count: 2 });
  });

  it('shows empty collections by default and drops them when pruning', () => {
    const collections = [col('empty', 'Empty'), col('full', 'Full')];
    const items = [bm('b1', 'Something', 'full')];

    expect(labels(buildListRows(items, collections))).toEqual(['Empty/', 'Full/', '  Something']);
    expect(labels(buildListRows(items, collections, { pruneEmpty: true }))).toEqual([
      'Full/',
      '  Something',
    ]);
  });

  it('keeps a collection whose only matches are nested when pruning', () => {
    const rows = buildListRows([bm('b1', 'Deep', 'ai')], [col('learn', 'Learning'), col('ai', 'AI', 'learn')], {
      pruneEmpty: true,
    });
    expect(labels(rows)).toEqual(['Learning/', '  AI/', '    Deep']);
  });

  it('re-roots bookmarks and collections whose parent no longer exists', () => {
    const rows = buildListRows([bm('b1', 'Orphan', 'gone')], [col('kid', 'Kid', 'missing')]);
    expect(labels(rows)).toEqual(['Kid/', 'Orphan']);
  });

  it('returns visible bookmarks in row order', () => {
    const rows = buildListRows(
      [bm('b1', 'Zed', 'tools'), bm('b2', 'Ableton', 'tools'), bm('b3', 'Loose')],
      [col('tools', 'Tools')],
    );
    expect(visibleBookmarks(rows).map((b) => b.title)).toEqual(['Ableton', 'Zed', 'Loose']);
  });

  it('omits bookmarks hidden inside a collapsed collection from navigation', () => {
    const rows = buildListRows([bm('b1', 'Hidden', 'tools'), bm('b2', 'Loose')], [col('tools', 'Tools')], {
      collapsed: new Set(['tools']),
    });
    expect(visibleBookmarks(rows).map((b) => b.title)).toEqual(['Loose']);
  });
});

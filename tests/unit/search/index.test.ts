import { describe, it, expect } from 'vitest';
import { buildIndex, searchIds } from '$lib/search/index';
import type { Bookmark } from '$lib/types';

function bm(over: Partial<Bookmark>): Bookmark {
  return {
    id: 'X',
    url: 'https://x',
    title: 'X',
    originalTitle: 'X',
    domain: 'x',
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
    lastCheckedAt: null,
    isBroken: false,
    ...over,
  };
}

describe('search index', () => {
  it('matches by title', () => {
    const idx = buildIndex([
      bm({ id: 'A', title: 'Type theory primer' }),
      bm({ id: 'B', title: 'Async Rust patterns' }),
    ]);
    expect(searchIds(idx, 'type')).toEqual(['A']);
    expect(searchIds(idx, 'rust')).toEqual(['B']);
  });

  it('matches by domain', () => {
    const idx = buildIndex([
      bm({ id: 'A', title: 'X', domain: 'fly.io' }),
      bm({ id: 'B', title: 'Y', domain: 'github.com' }),
    ]);
    expect(searchIds(idx, 'fly')).toEqual(['A']);
  });

  it('matches by note', () => {
    const idx = buildIndex([
      bm({ id: 'A', title: 'X', note: 'great essay on hyperloop scaling' }),
    ]);
    expect(searchIds(idx, 'hyperloop')).toEqual(['A']);
  });

  it('returns empty array for empty query', () => {
    const idx = buildIndex([bm({ id: 'A', title: 'foo' })]);
    expect(searchIds(idx, '')).toEqual([]);
  });

  it('is fuzzy — handles small typos', () => {
    const idx = buildIndex([bm({ id: 'A', title: 'Designing for the long now' })]);
    const results = searchIds(idx, 'desingn');
    expect(results).toContain('A');
  });

  it('is prefix — partial words match', () => {
    const idx = buildIndex([bm({ id: 'A', title: 'webdevelopment' })]);
    expect(searchIds(idx, 'webdev')).toContain('A');
  });
});

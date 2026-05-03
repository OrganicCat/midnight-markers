import { describe, it, expect } from 'vitest';
import { flattenBookmarkTree, type ChromeBookmarkNode } from '$lib/native/importBookmarks';

describe('flattenBookmarkTree', () => {
  it('returns leaves (nodes with url) and skips folders', () => {
    const tree: ChromeBookmarkNode[] = [
      {
        id: '0', title: '', children: [
          { id: '1', title: 'Bookmarks bar', children: [
            { id: '2', title: 'Hacker News', url: 'https://news.ycombinator.com/' },
            { id: '3', title: 'Inner folder', children: [
              { id: '4', title: 'GitHub', url: 'https://github.com/' },
            ] },
          ] },
        ],
      },
    ];
    const out = flattenBookmarkTree(tree);
    expect(out).toEqual([
      { title: 'Hacker News', url: 'https://news.ycombinator.com/', folderPath: ['Bookmarks bar'] },
      { title: 'GitHub', url: 'https://github.com/', folderPath: ['Bookmarks bar', 'Inner folder'] },
    ]);
  });

  it('skips entries without url', () => {
    const tree: ChromeBookmarkNode[] = [
      { id: '1', title: 'X', children: [{ id: '2', title: 'No URL' }] },
    ];
    expect(flattenBookmarkTree(tree)).toEqual([]);
  });

  it('handles empty tree', () => {
    expect(flattenBookmarkTree([])).toEqual([]);
  });

  it('handles a node with empty title by using URL hostname', () => {
    const tree: ChromeBookmarkNode[] = [
      { id: '1', title: 'Folder', children: [
        { id: '2', title: '', url: 'https://example.com/foo' },
      ] },
    ];
    expect(flattenBookmarkTree(tree)).toEqual([
      { title: 'example.com', url: 'https://example.com/foo', folderPath: ['Folder'] },
    ]);
  });
});

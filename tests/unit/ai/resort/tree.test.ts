import { describe, it, expect } from 'vitest';
import { buildPreviewTree } from '$lib/ai/resort/tree';
import { planToChanges } from '$lib/ai/resort/diff';
import { allKeys } from '$lib/ai/resort/selection';
import type { BookmarkRef, FolderNode, PreviewNode, ResortPlan } from '$lib/ai/resort/types';

function folder(id: string, path: string[], parentId: string | null = null): FolderNode {
  return { id, name: path[path.length - 1]!, parentId, path };
}
function bm(id: string, path: string[]): BookmarkRef {
  return { id, title: `Title ${id}`, domain: 'example.com', path };
}
function find(nodes: PreviewNode[], name: string): PreviewNode | undefined {
  for (const n of nodes) {
    if (n.name === name) return n;
    const hit = find(n.children, name);
    if (hit) return hit;
  }
  return undefined;
}

describe('buildPreviewTree', () => {
  it('nests folders and puts bookmarks under their destination', () => {
    const folders = [folder('c1', ['Old'])];
    const bookmarks = [bm('b1', ['Old'])];
    const plan: ResortPlan = {
      skeleton: { folders: [['Dev', 'Rust']], renames: [], merges: [] },
      filings: [{ id: 'b1', path: ['Dev', 'Rust'] }],
      unplannedIds: [],
    };
    const changes = planToChanges({ folders, bookmarks, plan });
    const tree = buildPreviewTree({ folders, bookmarks, changes, selected: allKeys(changes) });

    const dev = find(tree, 'Dev');
    expect(dev?.badge).toEqual({ kind: 'new' });
    const rust = find(tree, 'Rust');
    expect(rust?.bookmarks).toEqual([
      { id: 'b1', title: 'Title b1', fromPath: ['Old'], changeKey: 'move:b1' },
    ]);
  });

  it('leaves a bookmark in place when its move is deselected', () => {
    const folders = [folder('c1', ['Old'])];
    const bookmarks = [bm('b1', ['Old'])];
    const plan: ResortPlan = {
      skeleton: { folders: [['Dev']], renames: [], merges: [] },
      filings: [{ id: 'b1', path: ['Dev'] }],
      unplannedIds: [],
    };
    const changes = planToChanges({ folders, bookmarks, plan });
    const selected = new Set(changes.map((c) => c.key));
    selected.delete('move:b1');
    const tree = buildPreviewTree({ folders, bookmarks, changes, selected });

    expect(find(tree, 'Old')?.bookmarks.map((b) => b.id)).toEqual(['b1']);
    expect(find(tree, 'Dev')?.bookmarks).toEqual([]);
  });

  it('shows the new name and a renamed badge when a rename is selected', () => {
    const folders = [folder('c1', ['Stuff'])];
    const changes = planToChanges({
      folders,
      bookmarks: [],
      plan: {
        skeleton: { folders: [['Stuff']], renames: [{ from: ['Stuff'], to: 'Reference' }], merges: [] },
        filings: [],
        unplannedIds: [],
      },
    });
    const tree = buildPreviewTree({ folders, bookmarks: [], changes, selected: allKeys(changes) });
    expect(find(tree, 'Reference')?.badge).toEqual({ kind: 'renamed', from: 'Stuff' });
    expect(find(tree, 'Stuff')).toBeUndefined();
  });

  it('shows the old name when the rename is deselected', () => {
    const folders = [folder('c1', ['Stuff'])];
    const changes = planToChanges({
      folders,
      bookmarks: [],
      plan: {
        skeleton: { folders: [['Stuff']], renames: [{ from: ['Stuff'], to: 'Reference' }], merges: [] },
        filings: [],
        unplannedIds: [],
      },
    });
    const tree = buildPreviewTree({ folders, bookmarks: [], changes, selected: new Set() });
    expect(find(tree, 'Stuff')?.badge).toBeNull();
    expect(find(tree, 'Reference')).toBeUndefined();
  });

  it('marks a deleted folder rather than removing it, so the user can see it go', () => {
    const folders = [folder('c1', ['Old']), folder('c2', ['Dev'])];
    const bookmarks = [bm('b1', ['Old'])];
    const changes = planToChanges({
      folders,
      bookmarks,
      plan: {
        skeleton: { folders: [['Dev']], renames: [], merges: [] },
        filings: [{ id: 'b1', path: ['Dev'] }],
        unplannedIds: [],
      },
    });
    const tree = buildPreviewTree({ folders, bookmarks, changes, selected: allKeys(changes) });
    expect(find(tree, 'Old')?.badge).toEqual({ kind: 'deleted' });
    expect(find(tree, 'Old')?.changeKey).toBe('del:c1');
  });

  it('marks the merge target and drops the merged-away source', () => {
    const folders = [folder('c1', ['Web Dev']), folder('c2', ['Dev'])];
    const changes = planToChanges({
      folders,
      bookmarks: [],
      plan: {
        skeleton: { folders: [['Dev']], renames: [], merges: [{ from: ['Web Dev'], into: ['Dev'] }] },
        filings: [],
        unplannedIds: [],
      },
    });
    const tree = buildPreviewTree({ folders, bookmarks: [], changes, selected: allKeys(changes) });
    expect(find(tree, 'Dev')?.badge).toEqual({ kind: 'merged', from: 'Web Dev' });
    expect(find(tree, 'Web Dev')).toBeUndefined();
  });

  it('sorts siblings by name and keeps unchanged folders with no change key', () => {
    const folders = [folder('c1', ['Zebra']), folder('c2', ['Apple'])];
    const tree = buildPreviewTree({ folders, bookmarks: [], changes: [], selected: new Set() });
    expect(tree.map((n) => n.name)).toEqual(['Apple', 'Zebra']);
    expect(tree[0]!.changeKey).toBeNull();
    expect(tree[0]!.badge).toBeNull();
  });

  it('puts unfiled bookmarks in a synthetic root bucket', () => {
    const tree = buildPreviewTree({
      folders: [],
      bookmarks: [bm('b1', [])],
      changes: [],
      selected: new Set(),
    });
    const unfiled = tree.find((n) => n.id === 'path:');
    expect(unfiled?.name).toBe('Unfiled');
    expect(unfiled?.bookmarks.map((b) => b.id)).toEqual(['b1']);
  });
});

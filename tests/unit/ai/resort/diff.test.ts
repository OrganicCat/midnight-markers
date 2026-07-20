import { describe, it, expect } from 'vitest';
import { planToChanges } from '$lib/ai/resort/diff';
import type { BookmarkRef, FolderNode, ResortPlan } from '$lib/ai/resort/types';

function folder(id: string, path: string[], parentId: string | null = null): FolderNode {
  return { id, name: path[path.length - 1]!, parentId, path };
}
function bm(id: string, path: string[]): BookmarkRef {
  return { id, title: `Title ${id}`, domain: 'example.com', path };
}
function plan(p: {
  folders: string[][];
  skeleton?: { renames?: ResortPlan['skeleton']['renames']; merges?: ResortPlan['skeleton']['merges'] };
  filings?: ResortPlan['filings'];
  unplannedIds?: string[];
}): ResortPlan {
  return {
    skeleton: {
      folders: p.folders,
      renames: p.skeleton?.renames ?? [],
      merges: p.skeleton?.merges ?? [],
    },
    filings: p.filings ?? [],
    unplannedIds: p.unplannedIds ?? [],
  };
}

describe('planToChanges', () => {
  it('emits folder-new only for paths that do not exist yet', () => {
    const changes = planToChanges({
      folders: [folder('c1', ['Dev'])],
      bookmarks: [],
      plan: plan({ folders: [['Dev'], ['Dev', 'Rust']] }),
    });
    expect(changes.filter((c) => c.kind === 'folder-new')).toEqual([
      { kind: 'folder-new', key: 'new:dev rust', path: ['Dev', 'Rust'] },
    ]);
  });

  it('emits a folder-new for each missing ancestor of a deep path', () => {
    const changes = planToChanges({
      folders: [],
      bookmarks: [],
      plan: plan({ folders: [['A', 'B', 'C']] }),
    });
    expect(
      changes.filter((c) => c.kind === 'folder-new').map((c) => (c as { path: string[] }).path),
    ).toEqual([['A'], ['A', 'B'], ['A', 'B', 'C']]);
  });

  it('emits a rename with the resulting path', () => {
    const changes = planToChanges({
      folders: [folder('c1', ['Stuff'])],
      bookmarks: [],
      plan: plan({
        folders: [['Stuff']],
        skeleton: { renames: [{ from: ['Stuff'], to: 'Reference' }] },
      }),
    });
    expect(changes[0]).toEqual({
      kind: 'folder-rename',
      key: 'rename:c1',
      id: 'c1',
      from: 'Stuff',
      to: 'Reference',
      path: ['Reference'],
    });
  });

  it('ignores a rename to the same name and a rename of an unknown folder', () => {
    const changes = planToChanges({
      folders: [folder('c1', ['Stuff'])],
      bookmarks: [],
      plan: plan({
        folders: [['Stuff']],
        skeleton: { renames: [{ from: ['Stuff'], to: 'stuff' }, { from: ['Ghost'], to: 'X' }] },
      }),
    });
    expect(changes.filter((c) => c.kind === 'folder-rename')).toEqual([]);
  });

  it('emits a merge when both sides exist', () => {
    const changes = planToChanges({
      folders: [folder('c1', ['Web Dev']), folder('c2', ['Dev'])],
      bookmarks: [],
      plan: plan({ folders: [['Dev']], skeleton: { merges: [{ from: ['Web Dev'], into: ['Dev'] }] } }),
    });
    expect(changes.filter((c) => c.kind === 'folder-merge')).toEqual([
      { kind: 'folder-merge', key: 'merge:c1', sourceId: 'c1', sourcePath: ['Web Dev'], targetPath: ['Dev'] },
    ]);
  });

  it('emits bookmark-move and drops no-op moves', () => {
    const changes = planToChanges({
      folders: [folder('c1', ['Dev'])],
      bookmarks: [bm('b1', ['Old']), bm('b2', ['Dev'])],
      plan: plan({
        folders: [['Dev']],
        filings: [{ id: 'b1', path: ['Dev'] }, { id: 'b2', path: ['Dev'] }],
      }),
    });
    const moves = changes.filter((c) => c.kind === 'bookmark-move');
    expect(moves).toEqual([
      { kind: 'bookmark-move', key: 'move:b1', id: 'b1', title: 'Title b1', fromPath: ['Old'], toPath: ['Dev'] },
    ]);
  });

  it('emits folder-delete for a folder left empty, but not for one that keeps bookmarks', () => {
    const changes = planToChanges({
      folders: [folder('c1', ['Old']), folder('c2', ['Keep']), folder('c3', ['Dev'])],
      bookmarks: [bm('b1', ['Old']), bm('b2', ['Keep'])],
      plan: plan({ folders: [['Dev'], ['Keep']], filings: [{ id: 'b1', path: ['Dev'] }] }),
    });
    const deletes = changes.filter((c) => c.kind === 'folder-delete');
    expect(deletes).toEqual([{ kind: 'folder-delete', key: 'del:c1', id: 'c1', path: ['Old'] }]);
  });

  it('does not delete a folder that still has child folders', () => {
    const changes = planToChanges({
      folders: [folder('c1', ['Top']), folder('c2', ['Top', 'Child'], 'c1')],
      bookmarks: [bm('b1', ['Top', 'Child'])],
      plan: plan({ folders: [['Top', 'Child']] }),
    });
    expect(changes.filter((c) => c.kind === 'folder-delete')).toEqual([]);
  });

  it('does not delete a folder that is a merge target', () => {
    const changes = planToChanges({
      folders: [folder('c1', ['A']), folder('c2', ['B'])],
      bookmarks: [],
      plan: plan({ folders: [['B']], skeleton: { merges: [{ from: ['A'], into: ['B'] }] } }),
    });
    const deleted = changes.filter((c) => c.kind === 'folder-delete').map((c) => (c as { id: string }).id);
    expect(deleted).not.toContain('c2');
  });

  it('orders changes renames → merges → new → moves → deletes', () => {
    const changes = planToChanges({
      folders: [folder('c1', ['Stuff']), folder('c2', ['Dupe']), folder('c3', ['Dev'])],
      bookmarks: [bm('b1', ['Stuff'])],
      plan: plan({
        folders: [['Dev'], ['Dev', 'Rust']],
        skeleton: {
          renames: [{ from: ['Stuff'], to: 'Reference' }],
          merges: [{ from: ['Dupe'], into: ['Dev'] }],
        },
        filings: [{ id: 'b1', path: ['Dev', 'Rust'] }],
      }),
    });
    expect(changes.map((c) => c.kind)).toEqual([
      'folder-rename',
      'folder-merge',
      'folder-new',
      'bookmark-move',
      'folder-delete',
    ]);
  });

  it('returns an empty array when nothing would change', () => {
    const changes = planToChanges({
      folders: [folder('c1', ['Dev'])],
      bookmarks: [bm('b1', ['Dev'])],
      plan: plan({ folders: [['Dev']], filings: [{ id: 'b1', path: ['Dev'] }] }),
    });
    expect(changes).toEqual([]);
  });
});

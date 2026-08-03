import { describe, it, expect } from 'vitest';
import { affectedPathOf, allKeys, toggle } from '$lib/ai/resort/selection';
import type { Change } from '$lib/ai/resort/types';

const newA: Change = { kind: 'folder-new', key: 'new:a', path: ['A'] };
const newAB: Change = { kind: 'folder-new', key: 'new:a b', path: ['A', 'B'] };
const moveIntoAB: Change = {
  kind: 'bookmark-move', key: 'move:b1', id: 'b1', title: 'One', fromPath: ['Old'], toPath: ['A', 'B'],
};
const moveElsewhere: Change = {
  kind: 'bookmark-move', key: 'move:b2', id: 'b2', title: 'Two', fromPath: ['Old'], toPath: ['Z'],
};
const rename: Change = {
  kind: 'folder-rename', key: 'rename:c1', id: 'c1', from: 'Stuff', to: 'Ref', path: ['Ref'],
};
const changes = [newA, newAB, moveIntoAB, moveElsewhere, rename];

describe('affectedPathOf', () => {
  it('uses the resulting path for a rename', () => {
    expect(affectedPathOf(rename)).toEqual(['Ref']);
  });
  it('uses the source path for a merge', () => {
    expect(
      affectedPathOf({
        kind: 'folder-merge',
        key: 'm',
        sourceId: 'x',
        targetId: 'y',
        sourcePath: ['A'],
        targetPath: ['B'],
      }),
    ).toEqual(['A']);
  });
  it('returns null for a bookmark move', () => {
    expect(affectedPathOf(moveIntoAB)).toBeNull();
  });
});

describe('toggle', () => {
  it('unchecking a parent folder unchecks nested folders and moves into them', () => {
    const next = toggle(changes, allKeys(changes), 'new:a');
    expect(next.has('new:a')).toBe(false);
    expect(next.has('new:a b')).toBe(false);
    expect(next.has('move:b1')).toBe(false);
    expect(next.has('move:b2')).toBe(true);
    expect(next.has('rename:c1')).toBe(true);
  });

  it('checking a nested folder re-checks its ancestors', () => {
    const empty = new Set<string>();
    const next = toggle(changes, empty, 'new:a b');
    expect(next.has('new:a b')).toBe(true);
    expect(next.has('new:a')).toBe(true);
  });

  it('checking a move re-checks the folders it needs', () => {
    const next = toggle(changes, new Set<string>(), 'move:b1');
    expect(next.has('move:b1')).toBe(true);
    expect(next.has('new:a')).toBe(true);
    expect(next.has('new:a b')).toBe(true);
  });

  it('unchecking a move leaves everything else alone', () => {
    const next = toggle(changes, allKeys(changes), 'move:b1');
    expect(next.has('move:b1')).toBe(false);
    expect(next.has('new:a b')).toBe(true);
  });

  it('does not mutate the set it was given', () => {
    const before = allKeys(changes);
    const size = before.size;
    toggle(changes, before, 'new:a');
    expect(before.size).toBe(size);
  });

  it('ignores an unknown key', () => {
    const before = allKeys(changes);
    expect(toggle(changes, before, 'nope:1')).toEqual(before);
  });
});

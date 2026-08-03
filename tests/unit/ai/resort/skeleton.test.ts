import { describe, it, expect } from 'vitest';
import { buildSkeletonMessages, sampleBookmarks, SKELETON_SYSTEM_PROMPT } from '$lib/ai/resort/skeleton';
import type { BookmarkRef, FolderNode } from '$lib/ai/resort/types';

function folder(id: string, path: string[]): FolderNode {
  return { id, name: path[path.length - 1]!, parentId: null, path };
}
function bm(id: string, title: string, path: string[]): BookmarkRef {
  return { id, title, domain: 'example.com', path };
}

describe('SKELETON_SYSTEM_PROMPT', () => {
  it('carries the filing doctrine forward', () => {
    expect(SKELETON_SYSTEM_PROMPT).toContain('NEVER more than 3');
    expect(SKELETON_SYSTEM_PROMPT).toContain('Prefer TWO levels');
    expect(SKELETON_SYSTEM_PROMPT).toMatch(/junk drawer/i);
    expect(SKELETON_SYSTEM_PROMPT).toMatch(/media/i);
  });

  it('states the merge and minimum-size rules', () => {
    expect(SKELETON_SYSTEM_PROMPT).toMatch(/merge/i);
    expect(SKELETON_SYSTEM_PROMPT).toContain('fewer than 3');
  });

  it('declares the exact output shape', () => {
    expect(SKELETON_SYSTEM_PROMPT).toContain('"folders"');
    expect(SKELETON_SYSTEM_PROMPT).toContain('"renames"');
    expect(SKELETON_SYSTEM_PROMPT).toContain('"merges"');
  });
});

describe('buildSkeletonMessages', () => {
  it('renders folders as arrow paths and bookmarks with their current path', () => {
    const msgs = buildSkeletonMessages({
      folders: [folder('c1', ['Dev']), folder('c2', ['Dev', 'Rust'])],
      sample: [bm('b1', 'Ownership in Rust', ['Dev', 'Rust'])],
    });
    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.role).toBe('system');
    expect(msgs[1]!.content).toContain('Dev > Rust');
    expect(msgs[1]!.content).toContain('Ownership in Rust — example.com — Dev > Rust');
  });

  it('marks an empty tree and unfiled bookmarks explicitly', () => {
    const msgs = buildSkeletonMessages({ folders: [], sample: [bm('b1', 'Loose', [])] });
    expect(msgs[1]!.content).toContain('(none yet)');
    expect(msgs[1]!.content).toContain('(unfiled)');
  });
});

describe('sampleBookmarks', () => {
  it('returns everything when under the limit', () => {
    const input = [bm('a', 'A', ['X']), bm('b', 'B', ['Y'])];
    expect(sampleBookmarks(input, 10)).toHaveLength(2);
  });

  it('spreads the sample across folders instead of taking one folder whole', () => {
    const big = Array.from({ length: 50 }, (_, i) => bm(`big${i}`, `Big ${i}`, ['Big']));
    const small = [bm('s1', 'Small one', ['Small'])];
    const out = sampleBookmarks([...big, ...small], 10);
    expect(out).toHaveLength(10);
    expect(out.some((b) => b.id === 's1')).toBe(true);
  });

  it('is deterministic for the same input', () => {
    const input = Array.from({ length: 20 }, (_, i) => bm(`x${i}`, `X ${i}`, [i % 3 === 0 ? 'A' : 'B']));
    expect(sampleBookmarks(input, 7).map((b) => b.id)).toEqual(sampleBookmarks(input, 7).map((b) => b.id));
  });

  it('lists a duplicated folder path only once', () => {
    const messages = buildSkeletonMessages({
      folders: [
        { id: 'c1', name: 'Games', parentId: null, path: ['Games'] },
        { id: 'c2', name: 'games', parentId: null, path: ['games'] },
      ],
      sample: [],
    });
    const user = messages[1]!.content;
    expect(user.match(/Games/gi)).toHaveLength(1);
  });
});

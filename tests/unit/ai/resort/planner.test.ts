import { describe, it, expect, vi, afterEach } from 'vitest';
import { chunk, runResort, resortReasonMessage, MAX_BOOKMARKS } from '$lib/ai/resort/planner';
import type { BookmarkRef, FolderNode, ResortProgress } from '$lib/ai/resort/types';

afterEach(() => vi.unstubAllGlobals());

function folder(id: string, path: string[]): FolderNode {
  return { id, name: path[path.length - 1]!, parentId: null, path };
}
function bm(id: string): BookmarkRef {
  return { id, title: `Title ${id}`, domain: 'example.com', path: ['Old'] };
}
function reply(payload: unknown): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }] }));
}
function baseArgs(bookmarks: BookmarkRef[]) {
  return {
    folders: [folder('c1', ['Old'])],
    bookmarks,
    apiKey: 'sk-test',
    model: 'anthropic/claude-haiku-4.5',
    signal: new AbortController().signal,
  };
}

describe('chunk', () => {
  it('splits evenly and keeps the remainder', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('returns nothing for an empty list', () => {
    expect(chunk([], 10)).toEqual([]);
  });
  it('returns one chunk when the list is smaller than the size', () => {
    expect(chunk([1], 10)).toEqual([[1]]);
  });
});

describe('runResort', () => {
  it('refuses more than MAX_BOOKMARKS', async () => {
    const many = Array.from({ length: MAX_BOOKMARKS + 1 }, (_, i) => bm(`b${i}`));
    const r = await runResort(baseArgs(many));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.kind).toBe('too-many');
  });

  it('runs both passes and returns a plan', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ folders: [['Dev', 'Rust']], renames: [], merges: [] }))
      .mockResolvedValueOnce(reply({ filings: [{ id: 'b1', path: ['Dev', 'Rust'] }] }));
    vi.stubGlobal('fetch', fetchMock);

    const r = await runResort(baseArgs([bm('b1')]));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.skeleton.folders).toEqual([['Dev', 'Rust']]);
      expect(r.plan.filings).toEqual([{ id: 'b1', path: ['Dev', 'Rust'] }]);
      expect(r.plan.unplannedIds).toEqual([]);
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('fails with empty-skeleton when pass 1 returns no folders', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply({ folders: [] })));
    const r = await runResort(baseArgs([bm('b1')]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.kind).toBe('empty-skeleton');
  });

  it('surfaces an HTTP failure from pass 1', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 401 })));
    const r = await runResort(baseArgs([bm('b1')]));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason.kind).toBe('http');
      expect(resortReasonMessage(r.reason)).toContain('401');
    }
  });

  it('retries a failed filing batch once, then succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ folders: [['Dev']] }))
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockResolvedValueOnce(reply({ filings: [{ id: 'b1', path: ['Dev'] }] }));
    vi.stubGlobal('fetch', fetchMock);

    const r = await runResort(baseArgs([bm('b1')]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.filings).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('reports bookmarks as unplanned when their batch fails twice', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ folders: [['Dev']] }))
      .mockResolvedValue(new Response('boom', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const r = await runResort(baseArgs([bm('b1')]));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.plan.filings).toEqual([]);
      expect(r.plan.unplannedIds).toEqual(['b1']);
    }
  });

  it('marks bookmarks the model omitted as unplanned', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ folders: [['Dev']] }))
      .mockResolvedValueOnce(reply({ filings: [{ id: 'b1', path: ['Dev'] }] }));
    vi.stubGlobal('fetch', fetchMock);

    const r = await runResort(baseArgs([bm('b1'), bm('b2')]));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.unplannedIds).toEqual(['b2']);
  });

  it('emits progress for both phases', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ folders: [['Dev']] }))
      .mockResolvedValueOnce(reply({ filings: [{ id: 'b1', path: ['Dev'] }] }));
    vi.stubGlobal('fetch', fetchMock);

    const seen: ResortProgress[] = [];
    await runResort({ ...baseArgs([bm('b1')]), onProgress: (p) => seen.push(p) });
    expect(seen[0]).toEqual({ phase: 'skeleton' });
    expect(seen.at(-1)).toEqual({ phase: 'filing', done: 1, total: 1 });
  });

  it('reports a timeout when the caller aborts', async () => {
    const ac = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => {
        ac.abort();
        const err = new Error('aborted');
        err.name = 'AbortError';
        return Promise.reject(err);
      }),
    );
    const r = await runResort({ ...baseArgs([bm('b1')]), signal: ac.signal });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason.kind).toBe('timeout');
  });
});

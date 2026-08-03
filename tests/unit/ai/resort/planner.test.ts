import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import {
  chunk,
  runResort,
  resortReasonMessage,
  MAX_BOOKMARKS,
  BATCH_SIZE,
} from '$lib/ai/resort/planner';
import type { LastAIError } from '$lib/log';
import type { BookmarkRef, FolderNode, ResortProgress } from '$lib/ai/resort/types';

/**
 * Captures what the planner writes to the settings diagnostics pane. The real
 * `recordAIError` needs extension storage, which does not exist under vitest.
 */
const recorded: LastAIError[] = [];
vi.mock('$lib/log', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/log')>();
  return {
    ...actual,
    recordAIError: async (err: LastAIError) => {
      recorded.push(err);
    },
  };
});

beforeEach(() => {
  recorded.length = 0;
});
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

  it('fails rather than returning a folders-only plan when every batch fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ folders: [['Dev']] }))
      .mockResolvedValue(new Response('boom', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    const r = await runResort(baseArgs([bm('b1')]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toEqual({ kind: 'no-filings', batches: 1, failed: 1 });
  });

  it('fails when the model returns filings that match no proposed folder', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ folders: [['Dev']] }))
      .mockResolvedValue(reply({ filings: [{ id: 'b1', path: ['Nowhere'] }] }));
    vi.stubGlobal('fetch', fetchMock);

    const r = await runResort(baseArgs([bm('b1')]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toEqual({ kind: 'no-filings', batches: 1, failed: 0 });
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

  it('records the underlying provider error when pass 1 fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('nope', { status: 401 })));
    await runResort(baseArgs([bm('b1')]));
    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.status).toBe(401);
    expect(recorded[0]!.model).toBe('anthropic/claude-haiku-4.5');
  });

  it('records the underlying provider error when a filing batch gives up', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ folders: [['Dev']] }))
      // A fresh Response per attempt: a body can only be read once, and the
      // retry would otherwise see an already-drained stream.
      .mockImplementation(() => Promise.resolve(new Response('boom', { status: 500 })));
    vi.stubGlobal('fetch', fetchMock);

    const r = await runResort(baseArgs([bm('b1')]));
    expect(r.ok).toBe(false);
    // Without this the settings diagnostics pane stays empty and the only clue
    // the user gets is "1 of 1 request failed".
    expect(recorded).toHaveLength(1);
    expect(recorded[0]!.status).toBe(500);
    expect(recorded[0]!.body).toContain('boom');
  });

  it('asks for enough output tokens to hold a full batch of filings', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(reply({ folders: [['Dev']] }))
      .mockResolvedValue(reply({ filings: [] }));
    vi.stubGlobal('fetch', fetchMock);

    const batch = Array.from({ length: BATCH_SIZE }, (_, i) => bm(`b${i}`));
    await runResort(baseArgs(batch));

    // A ULID id alone costs ~10 tokens, so 100 filings will not fit in the
    // 2048-token default the single-bookmark prompts were sized for.
    const init = fetchMock.mock.calls[1]![1] as RequestInit;
    const body = JSON.parse(init.body as string) as { max_tokens?: number };
    expect(body.max_tokens).toBeGreaterThan(3000);
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

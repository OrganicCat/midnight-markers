import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { _resetDbForTests } from '$lib/storage/db';
import { settings } from '$lib/storage/settings';
import { suggestForBookmark, suggestForBookmarkResult } from '$lib/ai/suggest';

const fetchMock = vi.fn();

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

const baseInput = {
  title: 'Type theory primer',
  url: 'https://example.com/types',
  description: null,
  excerpt: null,
  existingTags: ['cs', 'reading'],
  existingCollections: [{ id: '01READING', path: ['Reading'] }],
};

describe('suggestForBookmark', () => {
  it('returns null when no API key is set', async () => {
    const out = await suggestForBookmark(baseInput);
    expect(out).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when all AI features are off', async () => {
    await settings.set({ openrouterKey: 'sk-test', aiConsentAt: 1, aiFeatures: { tags: false, title: false, collection: false } });
    const out = await suggestForBookmark(baseInput);
    expect(out).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns parsed suggestions on a valid response', async () => {
    await settings.set({ openrouterKey: 'sk-test', aiConsentAt: 1, aiFeatures: { tags: true, title: true, collection: true } });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            title: 'A Type Theory Primer',
            tags: ['cs', 'types'],
            collectionPath: ['Reading'],
          }) } }],
        }),
        { status: 200 },
      ),
    );
    const out = await suggestForBookmark(baseInput);
    expect(out).not.toBeNull();
    expect(out!.suggestedTitle).toBe('A Type Theory Primer');
    expect(out!.suggestedTags).toEqual([
      { name: 'cs', isNew: false },
      { name: 'types', isNew: true },
    ]);
    expect(out!.suggestedCollectionPath).toEqual(['Reading']);
  });

  it('caps collection path at 3 levels', async () => {
    await settings.set({ openrouterKey: 'sk-test', aiConsentAt: 1, aiFeatures: { tags: true, title: true, collection: true } });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            title: null, tags: [], collectionPath: ['Gaming', 'PoE', 'Builds', 'Necro', 'Spectre'],
          }) } }],
        }),
        { status: 200 },
      ),
    );
    const out = await suggestForBookmark(baseInput);
    expect(out!.suggestedCollectionPath).toEqual(['Gaming', 'PoE', 'Builds']);
  });

  it('returns null path when collectionPath is missing', async () => {
    await settings.set({ openrouterKey: 'sk-test', aiConsentAt: 1, aiFeatures: { tags: true, title: true, collection: true } });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ title: null, tags: ['cs'] }) } }],
        }),
        { status: 200 },
      ),
    );
    const out = await suggestForBookmark(baseInput);
    expect(out!.suggestedCollectionPath).toBeNull();
  });

  it('returns null path when collection feature is off', async () => {
    await settings.set({ openrouterKey: 'sk-test', aiConsentAt: 1, aiFeatures: { tags: true, title: true, collection: false } });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            title: null, tags: [], collectionPath: ['Reading'],
          }) } }],
        }),
        { status: 200 },
      ),
    );
    const out = await suggestForBookmark(baseInput);
    expect(out!.suggestedCollectionPath).toBeNull();
  });

  it('lowercases tag names and caps total tags at 5', async () => {
    await settings.set({ openrouterKey: 'sk-test', aiConsentAt: 1, aiFeatures: { tags: true, title: true, collection: true } });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            title: null, tags: ['CS', 'Types', 'Foo', 'Bar', 'Baz', 'Qux', 'Extra'], collectionPath: null,
          }) } }],
        }),
        { status: 200 },
      ),
    );
    const out = await suggestForBookmark(baseInput);
    expect(out!.suggestedTags.map((t) => t.name)).toEqual(['cs', 'types', 'foo', 'bar', 'baz']);
  });

  it('respects feature flags — drops title when title flag off', async () => {
    await settings.set({ openrouterKey: 'sk-test', aiConsentAt: 1, aiFeatures: { tags: true, title: false, collection: true } });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            title: 'Better Title', tags: ['cs'], collectionPath: null,
          }) } }],
        }),
        { status: 200 },
      ),
    );
    const out = await suggestForBookmark(baseInput);
    expect(out!.suggestedTitle).toBeNull();
    expect(out!.suggestedTags).toEqual([{ name: 'cs', isNew: false }]);
  });

  it('returns null on OpenRouter error (graceful degrade)', async () => {
    await settings.set({ openrouterKey: 'sk-test', aiConsentAt: 1, aiFeatures: { tags: true, title: true, collection: true } });
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    const out = await suggestForBookmark(baseInput);
    expect(out).toBeNull();
  });

  it('returns null on timeout', async () => {
    await settings.set({ openrouterKey: 'sk-test', aiConsentAt: 1, aiFeatures: { tags: true, title: true, collection: true } });
    fetchMock.mockImplementationOnce(
      (_u: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const out = await suggestForBookmark(baseInput, { timeoutMs: 5 });
    expect(out).toBeNull();
  });
});

describe('provider routing', () => {
  const ALL_ON = { tags: true, title: true, collection: true };

  /** An Anthropic Messages API response carrying the given JSON payload. */
  function anthropicReply(payload: unknown): Response {
    return new Response(
      JSON.stringify({
        id: 'msg_01',
        type: 'message',
        role: 'assistant',
        model: 'claude-haiku-4-5',
        content: [{ type: 'text', text: JSON.stringify(payload) }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }

  it('calls Anthropic when Anthropic is the selected provider', async () => {
    await settings.set({
      aiProvider: 'anthropic',
      anthropicKey: 'sk-ant-test',
      anthropicModel: 'claude-haiku-4-5',
      aiConsentAt: 1,
      aiFeatures: ALL_ON,
    });
    fetchMock.mockResolvedValueOnce(
      anthropicReply({ title: 'A Type Theory Primer', tags: ['cs'], collectionPath: ['Reading'] }),
    );

    const out = await suggestForBookmark(baseInput);

    expect(out).not.toBeNull();
    expect(out!.suggestedTitle).toBe('A Type Theory Primer');
    expect(String(fetchMock.mock.calls[0]![0])).toBe('https://api.anthropic.com/v1/messages');
  });

  it('calls OpenRouter when OpenRouter is the selected provider', async () => {
    await settings.set({
      aiProvider: 'openrouter',
      openrouterKey: 'sk-or-v1-test',
      aiConsentAt: 1,
      aiFeatures: ALL_ON,
    });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ title: 'T', tags: [] }) } }],
        }),
        { status: 200 },
      ),
    );

    await suggestForBookmark(baseInput);

    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      'https://openrouter.ai/api/v1/chat/completions',
    );
  });

  it('never contacts the inactive provider', async () => {
    await settings.set({
      aiProvider: 'anthropic',
      openrouterKey: 'sk-or-v1-test',
      anthropicKey: 'sk-ant-test',
      aiConsentAt: 1,
      aiFeatures: ALL_ON,
    });
    fetchMock.mockResolvedValueOnce(anthropicReply({ tags: ['cs'] }));

    await suggestForBookmark(baseInput);

    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toContain('openrouter.ai');
    }
  });

  it('reports no-key when the ACTIVE provider has none, even if the other does', async () => {
    await settings.set({
      aiProvider: 'anthropic',
      openrouterKey: 'sk-or-v1-test',
      anthropicKey: null,
      aiConsentAt: 1,
      aiFeatures: ALL_ON,
    });

    const r = await suggestForBookmarkResult(baseInput);

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason.kind).toBe('no-key');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('names the active provider in an HTTP failure message', async () => {
    await settings.set({
      aiProvider: 'anthropic',
      anthropicKey: 'sk-ant-test',
      aiConsentAt: 1,
      aiFeatures: ALL_ON,
    });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const r = await suggestForBookmarkResult(baseInput);

    expect(r.ok).toBe(false);
    if (r.ok === false && r.reason.kind === 'http') {
      expect(r.reason.status).toBe(401);
      expect(r.reason.provider).toBe('Anthropic');
    } else {
      throw new Error(`expected an http failure, got ${JSON.stringify(r)}`);
    }
  });

  it('classifies an Anthropic timeout as a timeout, not an unknown error', async () => {
    // Regression: the SDK wraps aborts in APIUserAbortError, whose `name` is
    // plain "Error". Misdetecting that turns every timeout into 'unknown' and
    // the user sees a useless error message instead of "Request timed out".
    await settings.set({
      aiProvider: 'anthropic',
      anthropicKey: 'sk-ant-test',
      aiConsentAt: 1,
      aiFeatures: ALL_ON,
    });
    fetchMock.mockImplementation(
      (_u: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );

    const r = await suggestForBookmarkResult(baseInput, { timeoutMs: 10 });

    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason.kind).toBe('timeout');
  });
});

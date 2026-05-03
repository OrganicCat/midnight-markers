import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { chatComplete, validateKey, OpenRouterError } from '$lib/ai/openrouter';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('chatComplete', () => {
  it('POSTs to /v1/chat/completions with bearer auth and json body', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ choices: [{ message: { content: '{"title":null,"tags":[],"collectionId":null}' } }] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    await chatComplete({
      apiKey: 'sk-test',
      model: 'anthropic/claude-haiku-4.5',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
    expect(init.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('anthropic/claude-haiku-4.5');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('returns the parsed JSON content from the first choice', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"title":"Hello","tags":["foo"],"collectionId":null}' } }],
        }),
        { status: 200 },
      ),
    );

    const out = await chatComplete({
      apiKey: 'sk-test',
      model: 'm',
      messages: [{ role: 'user', content: 'q' }],
    });
    expect(out).toEqual({ title: 'Hello', tags: ['foo'], collectionId: null });
  });

  it('strips markdown fences when the model wraps its JSON output', async () => {
    // Reproduces the actual Claude Haiku response shape from the bug report.
    const fenced = '```json\n{\n  "title": "Spectre Summoner Necromancer Build Guide PoE",\n  "tags": ["poe", "necromancer", "summoner", "build-guide"],\n  "collectionId": null\n}\n```';
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: fenced } }] }), { status: 200 }),
    );

    const out = (await chatComplete({
      apiKey: 'sk-test',
      model: 'anthropic/claude-haiku-4.5',
      messages: [{ role: 'user', content: 'q' }],
    })) as { title: string; tags: string[]; collectionId: null };
    expect(out.title).toBe('Spectre Summoner Necromancer Build Guide PoE');
    expect(out.tags).toEqual(['poe', 'necromancer', 'summoner', 'build-guide']);
    expect(out.collectionId).toBeNull();
  });

  it('throws OpenRouterError on HTTP non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"error":"unauthorized"}', { status: 401 }));
    await expect(
      chatComplete({ apiKey: 'bad', model: 'm', messages: [{ role: 'user', content: 'q' }] }),
    ).rejects.toBeInstanceOf(OpenRouterError);
  });

  it('throws OpenRouterError when content is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: 'not json' } }] }), { status: 200 }),
    );
    await expect(
      chatComplete({ apiKey: 'sk', model: 'm', messages: [{ role: 'user', content: 'q' }] }),
    ).rejects.toBeInstanceOf(OpenRouterError);
  });

  it('respects abort signal', async () => {
    const ac = new AbortController();
    fetchMock.mockImplementationOnce(
      (_u: string, init: RequestInit) =>
        new Promise((_, reject) => {
          init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    );
    const p = chatComplete({
      apiKey: 'sk',
      model: 'm',
      messages: [{ role: 'user', content: 'q' }],
      signal: ac.signal,
    });
    ac.abort();
    await expect(p).rejects.toThrow();
  });
});

describe('validateKey', () => {
  it('GETs /v1/auth/key with bearer auth, returns true on 200', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"data":{"label":"x"}}', { status: 200 }));
    const ok = await validateKey('sk-real');
    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://openrouter.ai/api/v1/auth/key');
    expect(init.method ?? 'GET').toBe('GET');
    expect(init.headers.Authorization).toBe('Bearer sk-real');
  });

  it('returns false on 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }));
    expect(await validateKey('bad')).toBe(false);
  });

  it('returns false on network error', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    expect(await validateKey('sk')).toBe(false);
  });
});

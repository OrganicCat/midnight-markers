import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  chatComplete,
  validateKey,
  splitSystem,
  AnthropicError,
  ANTHROPIC_ENDPOINT,
} from '$lib/ai/anthropic';

/**
 * These tests drive the real SDK and assert on the outbound HTTP request, via
 * the client's `fetch` injection point. Mocking the SDK itself would only
 * prove we can call a mock; this proves the wire format Anthropic will see.
 */
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
});

/** A well-formed Messages API response carrying `text` as its text block. */
function reply(text: string, status = 200): Response {
  return new Response(
    JSON.stringify({
      id: 'msg_01',
      type: 'message',
      role: 'assistant',
      model: 'claude-haiku-4-5',
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 10, output_tokens: 20 },
    }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}

/** The parsed body of the Nth captured request. */
async function requestBody(n = 0): Promise<Record<string, unknown>> {
  const call = fetchMock.mock.calls[n]!;
  const init = call[1] as RequestInit;
  return JSON.parse(init.body as string);
}

function requestHeaders(n = 0): Record<string, string> {
  const call = fetchMock.mock.calls[n]!;
  const init = call[1] as RequestInit;
  const h = init.headers;
  // The SDK hands fetch a Headers instance, but `instanceof Headers` is
  // unreliable across realms under happy-dom — duck-type on entries() instead.
  if (h && typeof (h as Headers).entries === 'function') {
    return Object.fromEntries(
      [...(h as Headers).entries()].map(([k, v]) => [k.toLowerCase(), v]),
    );
  }
  return Object.fromEntries(
    Object.entries((h ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]),
  );
}

function requestUrl(n = 0): string {
  return String(fetchMock.mock.calls[n]![0]);
}

describe('splitSystem', () => {
  it('lifts a leading system message out of the list', () => {
    const { system, rest } = splitSystem([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'hi' },
    ]);
    expect(system).toBe('SYS');
    expect(rest).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('returns undefined system when there is none', () => {
    const { system, rest } = splitSystem([{ role: 'user', content: 'hi' }]);
    expect(system).toBeUndefined();
    expect(rest).toHaveLength(1);
  });

  it('joins multiple system messages rather than dropping any', () => {
    const { system, rest } = splitSystem([
      { role: 'system', content: 'A' },
      { role: 'user', content: 'q' },
      { role: 'system', content: 'B' },
    ]);
    expect(system).toBe('A\n\nB');
    expect(rest).toEqual([{ role: 'user', content: 'q' }]);
  });
});

describe('chatComplete', () => {
  it('POSTs to /v1/messages with the documented auth and version headers', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"title":null,"tags":[],"collectionPath":null}'));

    await chatComplete({
      apiKey: 'sk-ant-test',
      model: 'claude-haiku-4-5',
      messages: [{ role: 'user', content: 'hi' }],
      fetch: fetchMock,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(requestUrl()).toBe(ANTHROPIC_ENDPOINT);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe('POST');

    const headers = requestHeaders();
    expect(headers['x-api-key']).toBe('sk-ant-test');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    // Without this the browser blocks the request outright.
    expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    // The key must never travel as a bearer token — that is OpenRouter's scheme.
    expect(headers['authorization']).toBeUndefined();
  });

  it('sends the model, a max_tokens ceiling, and the user messages', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"tags":[]}'));

    await chatComplete({
      apiKey: 'sk-ant-test',
      model: 'claude-sonnet-5',
      messages: [{ role: 'user', content: 'q' }],
      fetch: fetchMock,
    });

    const body = await requestBody();
    expect(body.model).toBe('claude-sonnet-5');
    expect(typeof body.max_tokens).toBe('number');
    expect(body.max_tokens as number).toBeGreaterThan(0);
    expect(body.messages).toEqual([{ role: 'user', content: 'q' }]);
  });

  it('hoists the system prompt to the top-level system field, not into messages', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"tags":[]}'));

    await chatComplete({
      apiKey: 'sk-ant-test',
      model: 'claude-haiku-4-5',
      messages: [
        { role: 'system', content: 'You are a tagging assistant.' },
        { role: 'user', content: 'q' },
      ],
      fetch: fetchMock,
    });

    const body = await requestBody();
    expect(body.system).toBe('You are a tagging assistant.');
    expect(body.messages).toEqual([{ role: 'user', content: 'q' }]);
    // A system-role entry in messages is rejected by the Messages API.
    expect(JSON.stringify(body.messages)).not.toContain('system');
  });

  it('omits system entirely when the prompt has none', async () => {
    fetchMock.mockResolvedValueOnce(reply('{"tags":[]}'));
    await chatComplete({
      apiKey: 'sk',
      model: 'm',
      messages: [{ role: 'user', content: 'q' }],
      fetch: fetchMock,
    });
    expect(await requestBody()).not.toHaveProperty('system');
  });

  it('returns the parsed JSON from the first text block', async () => {
    fetchMock.mockResolvedValueOnce(
      reply('{"title":"Hello","tags":["foo"],"collectionPath":["Dev"]}'),
    );

    const out = await chatComplete({
      apiKey: 'sk',
      model: 'm',
      messages: [{ role: 'user', content: 'q' }],
      fetch: fetchMock,
    });
    expect(out).toEqual({ title: 'Hello', tags: ['foo'], collectionPath: ['Dev'] });
  });

  it('strips markdown fences when the model wraps its JSON output', async () => {
    // Same real-world Claude response shape the OpenRouter path had to handle.
    const fenced =
      '```json\n{\n  "title": "Spectre Summoner Necromancer Build Guide PoE",\n  "tags": ["poe", "necromancer", "summoner", "build-guide"],\n  "collectionPath": null\n}\n```';
    fetchMock.mockResolvedValueOnce(reply(fenced));

    const out = (await chatComplete({
      apiKey: 'sk',
      model: 'm',
      messages: [{ role: 'user', content: 'q' }],
      fetch: fetchMock,
    })) as { title: string; tags: string[]; collectionPath: null };

    expect(out.title).toBe('Spectre Summoner Necromancer Build Guide PoE');
    expect(out.tags).toEqual(['poe', 'necromancer', 'summoner', 'build-guide']);
    expect(out.collectionPath).toBeNull();
  });

  it('skips non-text blocks and reads the first text block', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'msg_01',
          type: 'message',
          role: 'assistant',
          model: 'claude-haiku-4-5',
          content: [
            { type: 'thinking', thinking: '' },
            { type: 'text', text: '{"tags":["ok"]}' },
          ],
          stop_reason: 'end_turn',
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const out = (await chatComplete({
      apiKey: 'sk',
      model: 'm',
      messages: [{ role: 'user', content: 'q' }],
      fetch: fetchMock,
    })) as { tags: string[] };
    expect(out.tags).toEqual(['ok']);
  });

  it('throws AnthropicError carrying the status on HTTP non-2xx', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const err = await chatComplete({
      apiKey: 'bad',
      model: 'm',
      messages: [{ role: 'user', content: 'q' }],
      fetch: fetchMock,
    }).catch((e) => e);

    expect(err).toBeInstanceOf(AnthropicError);
    expect((err as AnthropicError).status).toBe(401);
    expect((err as AnthropicError).body).toContain('authentication_error');
  });

  it('throws AnthropicError on a 500 without retrying forever', async () => {
    fetchMock.mockResolvedValue(new Response('upstream boom', { status: 500 }));
    await expect(
      chatComplete({
        apiKey: 'sk',
        model: 'm',
        messages: [{ role: 'user', content: 'q' }],
        fetch: fetchMock,
      }),
    ).rejects.toBeInstanceOf(AnthropicError);
  });

  it('throws AnthropicError when content is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(reply('I am afraid I cannot do that.'));
    await expect(
      chatComplete({
        apiKey: 'sk',
        model: 'm',
        messages: [{ role: 'user', content: 'q' }],
        fetch: fetchMock,
      }),
    ).rejects.toBeInstanceOf(AnthropicError);
  });

  it('throws AnthropicError when the response has no text block', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'msg_01',
          type: 'message',
          role: 'assistant',
          model: 'claude-haiku-4-5',
          content: [],
          stop_reason: 'end_turn',
          usage: { input_tokens: 1, output_tokens: 0 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const err = await chatComplete({
      apiKey: 'sk',
      model: 'm',
      messages: [{ role: 'user', content: 'q' }],
      fetch: fetchMock,
    }).catch((e) => e);

    expect(err).toBeInstanceOf(AnthropicError);
    expect((err as AnthropicError).message).toMatch(/empty response/i);
  });

  it('propagates an abort so the caller can classify it as a timeout', async () => {
    const ac = new AbortController();
    fetchMock.mockImplementationOnce(
      (_u: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          );
        }),
    );

    const p = chatComplete({
      apiKey: 'sk',
      model: 'm',
      messages: [{ role: 'user', content: 'q' }],
      signal: ac.signal,
      fetch: fetchMock,
    });
    ac.abort();

    const err = await p.catch((e) => e);
    // Must NOT be wrapped as an AnthropicError — suggest.ts classifies an
    // AbortError as 'timeout', and a wrapped one would become 'unknown'.
    expect((err as Error).name).toBe('AbortError');
  });
});

describe('validateKey', () => {
  it('POSTs to the count_tokens endpoint and returns true on 200', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ input_tokens: 8 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const ok = await validateKey('sk-ant-real', { fetch: fetchMock });
    expect(ok).toBe(true);

    expect(requestUrl()).toContain('/v1/messages/count_tokens');
    expect(requestHeaders()['x-api-key']).toBe('sk-ant-real');
  });

  it('returns false on 401 rather than throwing', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ type: 'error', error: { type: 'authentication_error' } }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );
    expect(await validateKey('bad', { fetch: fetchMock })).toBe(false);
  });

  it('returns false on network error rather than throwing', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await validateKey('sk', { fetch: fetchMock })).toBe(false);
  });

  it('does not spend a generation — it never calls /v1/messages', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ input_tokens: 8 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await validateKey('sk-ant-real', { fetch: fetchMock });
    for (const call of fetchMock.mock.calls) {
      expect(String(call[0])).not.toBe(ANTHROPIC_ENDPOINT);
    }
  });
});

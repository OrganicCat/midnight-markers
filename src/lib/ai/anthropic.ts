import type Anthropic from '@anthropic-ai/sdk';
import { log } from '$lib/log';
import { parseModelJSON } from './parse';
import type { ChatMessage } from './types';

export const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';

/**
 * Ceiling on the response. Every prompt in this extension asks for one small
 * JSON object (a title, a handful of tags, a collection path), so this is
 * generous headroom rather than a real constraint — but the Messages API
 * requires the field, unlike the OpenRouter path where it is optional.
 */
const MAX_TOKENS = 2048;

export class AnthropicError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = 'AnthropicError';
  }
}

export type AnthropicChatArgs = {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  /**
   * Injection seam for tests, which assert on the real outbound request rather
   * than on a mocked SDK. Production omits it and the SDK uses global fetch.
   */
  fetch?: typeof globalThis.fetch;
};

/**
 * Loaded on demand rather than imported at module scope.
 *
 * The SDK is ~160 kB of the shared bundle, and it is dead weight for anyone on
 * OpenRouter — which is every user by default. A dynamic import keeps it out of
 * the chunk the popup, new tab, and settings pages all load at startup, so the
 * cost is paid only by users who actually send a request to Anthropic.
 */
async function client(
  apiKey: string,
  customFetch?: typeof globalThis.fetch,
): Promise<Anthropic> {
  const { default: Ctor } = await import('@anthropic-ai/sdk');
  return new Ctor({
    apiKey,
    // The SDK refuses to construct in a browser unless this is set, because
    // shipping a key inside a public web page leaks it to every visitor. That
    // is not the situation here: the key is the user's own, entered by them,
    // sealed in their own profile, and sent only to Anthropic. An extension
    // has no server to proxy through. See PRIVACY.md.
    dangerouslyAllowBrowser: true,
    ...(customFetch ? { fetch: customFetch } : {}),
  });
}

/**
 * Splits the leading system-role message out of a message list.
 *
 * The prompt builders emit an OpenAI-shaped list with the system prompt as the
 * first message; the Messages API takes it as a separate top-level parameter.
 * Keeping the split here means prompt.ts, resort/filing.ts, and
 * resort/skeleton.ts stay provider-agnostic.
 */
export function splitSystem(messages: ChatMessage[]): {
  system: string | undefined;
  rest: ChatMessage[];
} {
  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const rest = messages.filter((m) => m.role !== 'system');
  return {
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    rest,
  };
}

export async function chatComplete(args: AnthropicChatArgs): Promise<unknown> {
  const { system, rest } = splitSystem(args.messages);
  log.debug('anthropic chatComplete →', {
    model: args.model,
    messageCount: rest.length,
    hasSystem: system !== undefined,
  });

  let res;
  try {
    res = await (await client(args.apiKey, args.fetch)).messages.create(
      {
        model: args.model,
        max_tokens: MAX_TOKENS,
        ...(system ? { system } : {}),
        messages: rest.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
      },
      { ...(args.signal ? { signal: args.signal } : {}) },
    );
  } catch (e) {
    // An abort must surface with name 'AbortError' so the callers' timeout
    // handling classifies it as such. The SDK wraps aborts in its own
    // APIUserAbortError, whose name is not 'AbortError', so re-normalise it
    // rather than letting it fall through and become a generic 'unknown'.
    if (isAbort(e, args.signal)) {
      const abort = new DOMException('aborted', 'AbortError');
      throw abort;
    }
    const status = (e as { status?: number }).status;
    const body = describeError(e);
    log.error('Anthropic HTTP error', { status, body: body.slice(0, 500) });
    throw new AnthropicError(
      status === undefined ? body.slice(0, 200) : `HTTP ${status}: ${body.slice(0, 200)}`,
      status,
      body,
    );
  }

  log.debug('anthropic chatComplete ←', { stopReason: res.stop_reason });

  const first = res.content.find((b) => b.type === 'text');
  const content = first && first.type === 'text' ? first.text : undefined;
  if (typeof content !== 'string' || content.length === 0) {
    log.error('Anthropic empty response content', res);
    throw new AnthropicError(
      'Empty response content',
      undefined,
      JSON.stringify(res).slice(0, 500),
    );
  }

  try {
    const parsed = parseModelJSON(content);
    log.debug('anthropic chatComplete parsed', parsed);
    return parsed;
  } catch {
    log.error('Model output was not valid JSON even after fence-stripping', {
      content: content.slice(0, 500),
    });
    throw new AnthropicError(
      `Model output was not valid JSON: ${content.slice(0, 200)}`,
      undefined,
      content,
    );
  }
}

/**
 * True for both a raw fetch abort and the SDK's wrapper around one.
 *
 * The signal is the reliable tell. The SDK's APIUserAbortError sets `name` to
 * plain "Error" — only its constructor is named — so name-matching alone
 * silently misclassifies a timeout as an unknown failure. `instanceof` is not
 * an option either: the class lives behind a dynamic import, and loading it
 * eagerly would put the whole SDK back in the startup bundle.
 */
function isAbort(e: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  const name = (e as { name?: string }).name;
  if (name === 'AbortError') return true;
  return (e as object)?.constructor?.name === 'APIUserAbortError';
}

function describeError(e: unknown): string {
  const err = e as { error?: unknown; message?: string };
  if (err.error !== undefined) {
    try {
      return JSON.stringify(err.error);
    } catch {
      /* fall through to message */
    }
  }
  return err.message ?? String(e);
}

/**
 * Cheapest possible proof that a key works: token counting authenticates
 * against the real API without spending a generation.
 */
export async function validateKey(
  apiKey: string,
  opts: { model?: string; fetch?: typeof globalThis.fetch } = {},
): Promise<boolean> {
  try {
    await (await client(apiKey, opts.fetch)).messages.countTokens({
      model: opts.model ?? 'claude-haiku-4-5',
      messages: [{ role: 'user', content: 'hi' }],
    });
    log.debug('anthropic validateKey ← ok');
    return true;
  } catch (e) {
    log.warn('anthropic validateKey failed', e);
    return false;
  }
}

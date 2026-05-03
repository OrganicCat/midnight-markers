import { log } from '$lib/log';
import { parseModelJSON } from './parse';
import type { OpenRouterMessage } from './types';

const BASE = 'https://openrouter.ai/api/v1';

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

export type ChatCompleteArgs = {
  apiKey: string;
  model: string;
  messages: OpenRouterMessage[];
  signal?: AbortSignal;
};

export async function chatComplete(args: ChatCompleteArgs): Promise<unknown> {
  const url = `${BASE}/chat/completions`;
  log.debug('chatComplete →', { model: args.model, messageCount: args.messages.length, url });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/midnight-markers',
      'X-Title': 'midnight-markers',
    },
    body: JSON.stringify({
      model: args.model,
      messages: args.messages,
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }),
    ...(args.signal ? { signal: args.signal } : {}),
  });

  log.debug('chatComplete ←', { status: res.status });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    log.error('OpenRouter HTTP error', { status: res.status, body: text.slice(0, 500) });
    throw new OpenRouterError(`HTTP ${res.status}: ${text.slice(0, 200)}`, res.status, text);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    log.error('OpenRouter empty response content', json);
    throw new OpenRouterError('Empty response content', undefined, JSON.stringify(json).slice(0, 500));
  }

  try {
    const parsed = parseModelJSON(content);
    log.debug('chatComplete parsed', parsed);
    return parsed;
  } catch {
    log.error('Model output was not valid JSON even after fence-stripping', { content: content.slice(0, 500) });
    throw new OpenRouterError(`Model output was not valid JSON: ${content.slice(0, 200)}`, undefined, content);
  }
}

export async function validateKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/auth/key`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    log.debug('validateKey ←', { status: res.status });
    return res.ok;
  } catch (e) {
    log.warn('validateKey failed', e);
    return false;
  }
}

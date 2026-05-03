import type { OpenRouterMessage } from './types';

const BASE = 'https://openrouter.ai/api/v1';

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
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
  const res = await fetch(`${BASE}/chat/completions`, {
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

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new OpenRouterError(`HTTP ${res.status}: ${text.slice(0, 200)}`, res.status);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new OpenRouterError('Empty response content');
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new OpenRouterError(`Model output was not valid JSON: ${content.slice(0, 200)}`);
  }
}

export async function validateKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/auth/key`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

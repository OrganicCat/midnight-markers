# midnight-markers — Plan 2: AI suggestions via OpenRouter

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in AI suggestion layer to the popup save flow — title rewrite, tag suggestions (preferring existing tags), and collection routing — backed by OpenRouter (BYOK). Includes a settings page for key/model/feature management.

**Architecture:** A single `OpenRouterClient` (no provider abstraction) wraps `https://openrouter.ai/api/v1/chat/completions`. A `suggestForBookmark()` orchestrator reads the key/model from settings, builds a JSON-mode prompt, calls the client, validates the response shape, and returns structured suggestions. The popup invokes it asynchronously after save and renders suggestions inline. A new `options_ui` page in the manifest exposes a Svelte settings UI.

**Tech Stack:** Same as Plan 1 (Svelte 5, Tailwind 4, Vite, Vitest). Adds: `fetch` calls to OpenRouter (no SDK), `chrome.runtime.openOptionsPage()` for settings access.

**Reference spec:** `docs/superpowers/specs/2026-05-03-midnight-markers-design.md`

**Prerequisites:** Plan 1 must be complete (`git log --oneline | grep "plan-1-mvp"` should show the tag, or all 22 commits should be in place). Verify with `npm test` (33 green) and `npm run build` (clean dist/).

---

## File Structure (Plan 2)

```
midnight-markers/
├── src/
│   ├── manifest.json                       # MODIFY: options_ui, host_permissions
│   ├── lib/
│   │   └── ai/
│   │       ├── openrouter.ts               # NEW: chat/completions HTTP client
│   │       ├── prompt.ts                   # NEW: prompt builder
│   │       ├── suggest.ts                  # NEW: orchestrator
│   │       └── types.ts                    # NEW: AI request/response types
│   ├── popup/
│   │   ├── App.svelte                      # MODIFY: integrate AI flow
│   │   ├── AIBanner.svelte                 # NEW: pulsing/ready/error states
│   │   └── AISuggestions.svelte            # NEW: title bar + tag pills + collection
│   ├── newtab/
│   │   └── Sidebar.svelte                  # MODIFY: gear icon → openOptionsPage
│   └── settings/
│       ├── settings.html                   # NEW
│       ├── main.ts                         # NEW
│       ├── App.svelte                      # NEW: full settings UI
│       ├── KeyForm.svelte                  # NEW: key input + change/remove/test
│       ├── ModelPicker.svelte              # NEW: model dropdown
│       └── PrivacyNote.svelte              # NEW: disclosure block
└── tests/
    └── unit/
        ├── ai/
        │   ├── openrouter.test.ts          # NEW
        │   ├── prompt.test.ts              # NEW
        │   └── suggest.test.ts             # NEW
        └── settings/
            └── KeyForm.test.ts             # NEW
```

---

## Task 1: Manifest — settings page + OpenRouter host permission

**Files:**
- Modify: `src/manifest.json`

- [ ] **Step 1: Update manifest**

Replace the contents of `src/manifest.json` with:

```json
{
  "manifest_version": 3,
  "name": "midnight-markers",
  "description": "A dark, polished bookmark library for Brave and Chrome.",
  "version": "0.2.0",
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_title": "Save to midnight-markers"
  },
  "chrome_url_overrides": {
    "newtab": "src/newtab/newtab.html"
  },
  "options_ui": {
    "page": "src/settings/settings.html",
    "open_in_tab": true
  },
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  "permissions": ["storage", "activeTab", "scripting", "tabs"],
  "host_permissions": ["https://openrouter.ai/*"]
}
```

- [ ] **Step 2: Don't build yet** — `settings.html` doesn't exist; build will fail until Task 6. Skip ahead.

- [ ] **Step 3: Commit**

```bash
git add src/manifest.json
git commit -m "feat(manifest): add options_ui settings page and openrouter host permission

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: AI types

**Files:**
- Create: `src/lib/ai/types.ts`

- [ ] **Step 1: Implement**

```ts
export type SuggestInput = {
  title: string;
  url: string;
  description: string | null;
  excerpt: string | null;
  existingTags: string[];           // lowercased tag names
  existingCollections: { id: string; name: string }[];
};

export type SuggestedTag = {
  name: string;        // lowercased
  isNew: boolean;      // true if not in existingTags
};

export type Suggestion = {
  suggestedTitle: string | null;       // null = keep original
  suggestedTags: SuggestedTag[];       // capped at 5 by orchestrator
  suggestedCollectionId: string | null;
};

export type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type ChatCompletionRequest = {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  response_format?: { type: 'json_object' };
};

export type ChatCompletionResponse = {
  choices: Array<{ message: { content: string } }>;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ai/types.ts
git commit -m "feat(ai): types for OpenRouter requests and suggestions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Prompt builder

**Files:**
- Create: `src/lib/ai/prompt.ts`, `tests/unit/ai/prompt.test.ts`

- [ ] **Step 1: Failing test**

`tests/unit/ai/prompt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildMessages } from '$lib/ai/prompt';

describe('buildMessages', () => {
  const baseInput = {
    title: 'Designing for the long now',
    url: 'https://jakeworth.com/long-now-web',
    description: 'An essay on durable web design.',
    excerpt: 'When we design for the web today, we tend to optimize for...',
    existingTags: ['design', 'webdev', 'longread'],
    existingCollections: [
      { id: '01ABC', name: 'Reading' },
      { id: '01DEF', name: 'Design' },
    ],
  };

  it('returns a system message and a user message', () => {
    const msgs = buildMessages(baseInput);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.role).toBe('system');
    expect(msgs[1]!.role).toBe('user');
  });

  it('system message instructs JSON-only output with the expected schema', () => {
    const msgs = buildMessages(baseInput);
    const sys = msgs[0]!.content;
    expect(sys).toMatch(/JSON/);
    expect(sys).toMatch(/"title"/);
    expect(sys).toMatch(/"tags"/);
    expect(sys).toMatch(/"collectionId"/);
  });

  it('system message instructs to prefer existing tags and cap new tags at 2', () => {
    const sys = buildMessages(baseInput)[0]!.content;
    expect(sys).toMatch(/prefer existing/i);
    expect(sys).toMatch(/at most 2 new/i);
  });

  it('user message includes the page title, url, description, and excerpt', () => {
    const user = buildMessages(baseInput)[1]!.content;
    expect(user).toContain('Designing for the long now');
    expect(user).toContain('https://jakeworth.com/long-now-web');
    expect(user).toContain('An essay on durable web design.');
    expect(user).toContain('When we design for the web today');
  });

  it('user message lists existing tags and collections by name and id', () => {
    const user = buildMessages(baseInput)[1]!.content;
    expect(user).toContain('design');
    expect(user).toContain('webdev');
    expect(user).toContain('Reading (01ABC)');
    expect(user).toContain('Design (01DEF)');
  });

  it('handles null description and excerpt gracefully', () => {
    const user = buildMessages({ ...baseInput, description: null, excerpt: null })[1]!.content;
    expect(user).not.toMatch(/null/i);
  });

  it('truncates excerpt at 500 characters', () => {
    const longExcerpt = 'a'.repeat(2000);
    const user = buildMessages({ ...baseInput, excerpt: longExcerpt })[1]!.content;
    // The body of the excerpt section should not exceed 500 + framing
    const aRuns = user.match(/a{500,}/g) ?? [];
    expect(aRuns.length).toBeLessThanOrEqual(1);
    expect(aRuns[0]?.length ?? 0).toBeLessThanOrEqual(510);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/unit/ai/prompt.test.ts`
Expected: fails on missing module.

- [ ] **Step 3: Implement**

`src/lib/ai/prompt.ts`:

```ts
import type { OpenRouterMessage, SuggestInput } from './types';

const SYSTEM_PROMPT = `You are a concise tagging assistant for a personal bookmark manager.

Given a saved web page (title, URL, description, content excerpt) and the user's existing tags and collections, return suggestions as a single JSON object with this exact shape:

{
  "title": string | null,
  "tags": string[],
  "collectionId": string | null
}

Rules:
- "title": a clearer, friendlier display title (5-12 words). Return null if the original title is already good.
- "tags": 2-5 lowercased single-word or hyphenated tags. PREFER existing tags. You may invent at most 2 new tags if no existing tag fits well.
- "collectionId": the ID of the best-fit collection from the supplied list, or null if none fit.

Return only the JSON object — no prose, no markdown fences.`;

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

export function buildMessages(input: SuggestInput): OpenRouterMessage[] {
  const tagsLine = input.existingTags.length > 0 ? input.existingTags.join(', ') : '(none yet)';
  const colLines = input.existingCollections.length > 0
    ? input.existingCollections.map((c) => `${c.name} (${c.id})`).join('\n')
    : '(none yet)';

  const userParts: string[] = [
    `Title: ${input.title}`,
    `URL: ${input.url}`,
  ];
  if (input.description) userParts.push(`Description: ${input.description}`);
  if (input.excerpt) userParts.push(`Excerpt: ${truncate(input.excerpt, 500)}`);
  userParts.push('', `Existing tags: ${tagsLine}`);
  userParts.push('', `Existing collections:\n${colLines}`);

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userParts.join('\n') },
  ];
}
```

- [ ] **Step 4: Verify pass**

Run: `npm test -- tests/unit/ai/prompt.test.ts`
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/prompt.ts tests/unit/ai/prompt.test.ts
git commit -m "feat(ai): JSON-mode prompt builder for bookmark suggestions

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: OpenRouter client

**Files:**
- Create: `src/lib/ai/openrouter.ts`, `tests/unit/ai/openrouter.test.ts`

- [ ] **Step 1: Failing test**

`tests/unit/ai/openrouter.test.ts`:

```ts
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
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/unit/ai/openrouter.test.ts`
Expected: fails on missing module.

- [ ] **Step 3: Implement**

`src/lib/ai/openrouter.ts`:

```ts
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
    signal: args.signal,
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
```

- [ ] **Step 4: Verify pass**

Run: `npm test -- tests/unit/ai/openrouter.test.ts`
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/openrouter.ts tests/unit/ai/openrouter.test.ts
git commit -m "feat(ai): OpenRouter client with chatComplete and validateKey

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Suggest orchestrator

**Files:**
- Create: `src/lib/ai/suggest.ts`, `tests/unit/ai/suggest.test.ts`

- [ ] **Step 1: Failing test**

`tests/unit/ai/suggest.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { _resetDbForTests } from '$lib/storage/db';
import { settings } from '$lib/storage/settings';
import { suggestForBookmark } from '$lib/ai/suggest';

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
  existingCollections: [{ id: '01READING', name: 'Reading' }],
};

describe('suggestForBookmark', () => {
  it('returns null when no API key is set', async () => {
    const out = await suggestForBookmark(baseInput);
    expect(out).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when all AI features are off', async () => {
    await settings.set({ aiKey: 'sk-test', aiFeatures: { tags: false, title: false, collection: false } });
    const out = await suggestForBookmark(baseInput);
    expect(out).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns parsed suggestions on a valid response', async () => {
    await settings.set({ aiKey: 'sk-test' });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            title: 'A Type Theory Primer',
            tags: ['cs', 'types'],
            collectionId: '01READING',
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
    expect(out!.suggestedCollectionId).toBe('01READING');
  });

  it('drops collectionId when not in existingCollections', async () => {
    await settings.set({ aiKey: 'sk-test' });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            title: null, tags: ['cs'], collectionId: 'NOT-A-REAL-ID',
          }) } }],
        }),
        { status: 200 },
      ),
    );
    const out = await suggestForBookmark(baseInput);
    expect(out!.suggestedCollectionId).toBeNull();
  });

  it('lowercases tag names and caps total tags at 5', async () => {
    await settings.set({ aiKey: 'sk-test' });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            title: null, tags: ['CS', 'Types', 'Foo', 'Bar', 'Baz', 'Qux', 'Extra'], collectionId: null,
          }) } }],
        }),
        { status: 200 },
      ),
    );
    const out = await suggestForBookmark(baseInput);
    expect(out!.suggestedTags.map((t) => t.name)).toEqual(['cs', 'types', 'foo', 'bar', 'baz']);
  });

  it('respects feature flags — drops title when title flag off', async () => {
    await settings.set({ aiKey: 'sk-test', aiFeatures: { tags: true, title: false, collection: true } });
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({
            title: 'Better Title', tags: ['cs'], collectionId: null,
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
    await settings.set({ aiKey: 'sk-test' });
    fetchMock.mockResolvedValueOnce(new Response('', { status: 500 }));
    const out = await suggestForBookmark(baseInput);
    expect(out).toBeNull();
  });

  it('returns null on timeout', async () => {
    await settings.set({ aiKey: 'sk-test' });
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
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/unit/ai/suggest.test.ts`
Expected: fails on missing module.

- [ ] **Step 3: Implement**

`src/lib/ai/suggest.ts`:

```ts
import { settings } from '$lib/storage/settings';
import { chatComplete, OpenRouterError } from './openrouter';
import { buildMessages } from './prompt';
import type { Suggestion, SuggestInput, SuggestedTag } from './types';

type RawModelOutput = {
  title?: unknown;
  tags?: unknown;
  collectionId?: unknown;
};

const MAX_TAGS = 5;
const DEFAULT_TIMEOUT_MS = 10_000;

export async function suggestForBookmark(
  input: SuggestInput,
  options: { timeoutMs?: number } = {},
): Promise<Suggestion | null> {
  const s = await settings.get();
  if (!s.aiKey) return null;

  const anyFeatureOn = s.aiFeatures.tags || s.aiFeatures.title || s.aiFeatures.collection;
  if (!anyFeatureOn) return null;

  const ac = new AbortController();
  const timeout = setTimeout(() => ac.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const raw = (await chatComplete({
      apiKey: s.aiKey,
      model: s.aiModel,
      messages: buildMessages(input),
      signal: ac.signal,
    })) as RawModelOutput;

    return shapeSuggestion(raw, input, s.aiFeatures);
  } catch (e) {
    if (e instanceof OpenRouterError || (e as { name?: string }).name === 'AbortError') {
      return null;
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function shapeSuggestion(
  raw: RawModelOutput,
  input: SuggestInput,
  features: { tags: boolean; title: boolean; collection: boolean },
): Suggestion {
  const existingTagSet = new Set(input.existingTags);
  const collectionIds = new Set(input.existingCollections.map((c) => c.id));

  const suggestedTitle =
    features.title && typeof raw.title === 'string' && raw.title.trim().length > 0
      ? raw.title.trim()
      : null;

  let suggestedTags: SuggestedTag[] = [];
  if (features.tags && Array.isArray(raw.tags)) {
    suggestedTags = raw.tags
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0)
      .slice(0, MAX_TAGS)
      .map((name) => ({ name, isNew: !existingTagSet.has(name) }));
  }

  const suggestedCollectionId =
    features.collection && typeof raw.collectionId === 'string' && collectionIds.has(raw.collectionId)
      ? raw.collectionId
      : null;

  return { suggestedTitle, suggestedTags, suggestedCollectionId };
}
```

- [ ] **Step 4: Verify pass**

Run: `npm test -- tests/unit/ai/suggest.test.ts`
Expected: 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/suggest.ts tests/unit/ai/suggest.test.ts
git commit -m "feat(ai): suggestForBookmark orchestrator with feature flags and graceful degrade

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Settings page entry

**Files:**
- Create: `src/settings/settings.html`, `src/settings/main.ts`, `src/settings/App.svelte`

- [ ] **Step 1: settings.html**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>midnight-markers — Settings</title>
    <link rel="stylesheet" href="../lib/theme.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: main.ts**

```ts
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
```

- [ ] **Step 3: App.svelte (placeholder)**

```svelte
<script lang="ts">
</script>

<div class="min-h-screen p-10" style="background: linear-gradient(180deg, #0b0c14 0%, #14172a 100%);">
  <div class="max-w-2xl mx-auto">
    <h1 class="text-3xl font-semibold tracking-tight">Settings</h1>
    <p class="text-xs opacity-50 mt-1">midnight-markers · v0.2.0</p>
    <p class="mt-8 opacity-70">Settings UI lands in Tasks 7–10.</p>
  </div>
</div>
```

- [ ] **Step 4: Build and verify**

Run: `npm run build`
Expected: clean. dist/ now contains `dist/src/settings/settings.html` etc.

- [ ] **Step 5: Commit**

```bash
git add src/settings
git commit -m "feat(settings): page shell mounted at options_ui

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: KeyForm component

**Files:**
- Create: `src/settings/KeyForm.svelte`, `tests/unit/settings/KeyForm.test.ts`

- [ ] **Step 1: Failing test**

`tests/unit/settings/KeyForm.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import KeyForm from '../../../src/settings/KeyForm.svelte';

describe('KeyForm', () => {
  it('shows masked key when one is set', () => {
    const { getByDisplayValue } = render(KeyForm, {
      currentKey: 'sk-or-v1-abc123def456ghi789jkl012mno345',
      onSave: () => {},
      onRemove: () => {},
      onTest: async () => 'idle',
    });
    // First 8 visible, rest masked
    expect(getByDisplayValue(/^sk-or-v1.*•.*$/)).toBeTruthy();
  });

  it('clicking Edit reveals an input that accepts a new key', async () => {
    const onSave = vi.fn();
    const { getByText, getByLabelText } = render(KeyForm, {
      currentKey: 'sk-or-v1-old',
      onSave,
      onRemove: () => {},
      onTest: async () => 'idle',
    });
    await fireEvent.click(getByText('Change'));
    const input = getByLabelText('OpenRouter API key') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'sk-or-v1-new' } });
    await fireEvent.click(getByText('Save'));
    expect(onSave).toHaveBeenCalledWith('sk-or-v1-new');
  });

  it('clicking Remove fires onRemove', async () => {
    const onRemove = vi.fn();
    const { getByText } = render(KeyForm, {
      currentKey: 'sk-or-v1-x',
      onSave: () => {},
      onRemove,
      onTest: async () => 'idle',
    });
    await fireEvent.click(getByText('Remove key'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('shows "Add key" UI when no key is set', () => {
    const { getByText } = render(KeyForm, {
      currentKey: null,
      onSave: () => {},
      onRemove: () => {},
      onTest: async () => 'idle',
    });
    expect(getByText(/no key set/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/unit/settings/KeyForm.test.ts`
Expected: fails on missing component.

- [ ] **Step 3: Implement**

`src/settings/KeyForm.svelte`:

```svelte
<script lang="ts">
  type TestStatus = 'idle' | 'testing' | 'ok' | 'fail';

  let {
    currentKey,
    onSave,
    onRemove,
    onTest,
  }: {
    currentKey: string | null;
    onSave: (key: string) => void | Promise<void>;
    onRemove: () => void | Promise<void>;
    onTest: () => Promise<TestStatus>;
  } = $props();

  let editing = $state(currentKey === null);
  let draft = $state('');
  let status = $state<TestStatus>('idle');

  function maskKey(k: string): string {
    if (k.length <= 12) return k;
    return k.slice(0, 8) + '•'.repeat(Math.min(24, k.length - 12)) + k.slice(-4);
  }

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    await onSave(trimmed);
    draft = '';
    editing = false;
    status = 'idle';
  }

  async function test() {
    status = 'testing';
    status = await onTest();
  }
</script>

<div class="rounded-xl border border-white/10 p-5 bg-white/[0.02]">
  <div class="text-[10px] uppercase tracking-wider opacity-50 mb-2">OpenRouter API key</div>

  {#if !currentKey && !editing}
    <p class="text-sm opacity-70">No key set. Add one to enable AI suggestions.</p>
    <button class="mt-3 px-3 py-1.5 rounded bg-accent-violet/20 text-sm" onclick={() => (editing = true)}>Add key</button>
  {:else if !editing}
    <input
      class="w-full bg-black/40 rounded px-3 py-2 text-xs font-mono"
      value={maskKey(currentKey ?? '')}
      readonly
      aria-label="OpenRouter API key (masked)"
    />
    <div class="flex gap-2 mt-3">
      <button class="px-3 py-1.5 rounded bg-white/5 text-xs" onclick={() => (editing = true)}>Change</button>
      <button class="px-3 py-1.5 rounded bg-white/5 text-xs" onclick={test}>
        {#if status === 'testing'}Testing…{:else if status === 'ok'}✓ OK{:else if status === 'fail'}✗ Failed{:else}Test connection{/if}
      </button>
      <button class="px-3 py-1.5 rounded bg-red-500/15 text-red-300 text-xs ml-auto" onclick={onRemove}>Remove key</button>
    </div>
  {:else}
    <input
      type="password"
      class="w-full bg-black/40 rounded px-3 py-2 text-xs font-mono"
      bind:value={draft}
      placeholder="sk-or-v1-..."
      aria-label="OpenRouter API key"
    />
    <div class="flex gap-2 mt-3">
      <button class="px-3 py-1.5 rounded bg-accent-violet/20 text-xs" onclick={save}>Save</button>
      <button class="px-3 py-1.5 rounded bg-white/5 text-xs" onclick={() => { editing = false; draft = ''; }}>Cancel</button>
    </div>
    <p class="mt-3 text-xs opacity-50">Get a key at <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer noopener" class="underline">openrouter.ai/keys</a>.</p>
  {/if}
</div>
```

- [ ] **Step 4: Verify pass**

Run: `npm test -- tests/unit/settings/KeyForm.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/settings/KeyForm.svelte tests/unit/settings/KeyForm.test.ts
git commit -m "feat(settings): KeyForm component with mask, change/test/remove

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: ModelPicker and PrivacyNote

**Files:**
- Create: `src/settings/ModelPicker.svelte`, `src/settings/PrivacyNote.svelte`

- [ ] **Step 1: ModelPicker.svelte**

```svelte
<script lang="ts">
  let {
    value = $bindable(),
  }: { value: string } = $props();

  // Curated list — user can paste any OpenRouter model id via "Other".
  const presets = [
    'anthropic/claude-haiku-4.5',
    'anthropic/claude-sonnet-4.6',
    'openai/gpt-4o-mini',
    'google/gemini-2.0-flash',
    'meta-llama/llama-3.3-70b-instruct',
  ];

  let custom = $state(presets.includes(value) ? '' : value);
  let mode = $state<'preset' | 'custom'>(presets.includes(value) ? 'preset' : 'custom');

  function commit() {
    if (mode === 'custom' && custom.trim()) value = custom.trim();
  }
</script>

<div class="rounded-xl border border-white/10 p-5 bg-white/[0.02]">
  <div class="text-[10px] uppercase tracking-wider opacity-50 mb-2">Model</div>

  {#if mode === 'preset'}
    <select
      bind:value
      class="w-full bg-black/40 rounded px-3 py-2 text-sm"
      aria-label="Model preset"
    >
      {#each presets as p (p)}
        <option value={p}>{p}</option>
      {/each}
    </select>
    <button class="mt-2 text-xs underline opacity-60 hover:opacity-100" onclick={() => (mode = 'custom')}>Use a different model id…</button>
  {:else}
    <input
      bind:value={custom}
      onblur={commit}
      class="w-full bg-black/40 rounded px-3 py-2 text-xs font-mono"
      placeholder="provider/model-id"
      aria-label="Custom model id"
    />
    <button class="mt-2 text-xs underline opacity-60 hover:opacity-100" onclick={() => (mode = 'preset')}>Choose from presets</button>
  {/if}

  <p class="mt-3 text-xs opacity-50">Default Haiku 4.5 is fastest and cheapest. See <a href="https://openrouter.ai/models" target="_blank" rel="noreferrer noopener" class="underline">openrouter.ai/models</a> for the full catalog.</p>
</div>
```

- [ ] **Step 2: PrivacyNote.svelte**

```svelte
<div class="rounded-xl border border-white/10 p-5 bg-white/[0.02]">
  <div class="text-[10px] uppercase tracking-wider opacity-50 mb-2">Privacy</div>
  <p class="text-xs leading-relaxed opacity-80">
    When AI suggestions are on, this is sent to OpenRouter for each save:
    page <strong>title</strong>, <strong>URL</strong>, <strong>meta description</strong>, up to <strong>500 chars</strong> of main content,
    your existing tag names, and your collection names + IDs. Your key, your account, your cost.
  </p>
  <p class="text-xs leading-relaxed opacity-50 mt-2">
    Key is stored unencrypted in <code>chrome.storage.local</code> — standard for browser extensions.
  </p>
</div>
```

- [ ] **Step 3: Commit (no tests — these are presentational)**

```bash
git add src/settings/ModelPicker.svelte src/settings/PrivacyNote.svelte
git commit -m "feat(settings): ModelPicker with presets+custom, and PrivacyNote disclosure

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Wire settings App.svelte

**Files:**
- Modify: `src/settings/App.svelte`

- [ ] **Step 1: Replace App.svelte**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { settings } from '$lib/storage/settings';
  import { validateKey } from '$lib/ai/openrouter';
  import type { Settings } from '$lib/types';
  import KeyForm from './KeyForm.svelte';
  import ModelPicker from './ModelPicker.svelte';
  import PrivacyNote from './PrivacyNote.svelte';

  let s = $state<Settings | null>(null);

  async function refresh() {
    s = await settings.get();
  }

  onMount(refresh);

  async function saveKey(key: string) {
    await settings.set({ aiKey: key });
    await refresh();
  }
  async function removeKey() {
    if (!confirm('Remove the saved API key? AI suggestions will stop until you add one again.')) return;
    await settings.set({ aiKey: null });
    await refresh();
  }
  async function testConnection(): Promise<'idle' | 'testing' | 'ok' | 'fail'> {
    if (!s?.aiKey) return 'fail';
    const ok = await validateKey(s.aiKey);
    return ok ? 'ok' : 'fail';
  }

  async function setModel(m: string) {
    await settings.set({ aiModel: m });
    await refresh();
  }

  async function toggleFeature(k: 'tags' | 'title' | 'collection') {
    if (!s) return;
    await settings.set({ aiFeatures: { ...s.aiFeatures, [k]: !s.aiFeatures[k] } });
    await refresh();
  }
</script>

<div class="min-h-screen p-10" style="background: linear-gradient(180deg, #0b0c14 0%, #14172a 100%);">
  <div class="max-w-2xl mx-auto space-y-5">
    <header>
      <h1 class="text-3xl font-semibold tracking-tight">Settings</h1>
      <p class="text-xs opacity-50 mt-1">midnight-markers · v0.2.0</p>
    </header>

    {#if s}
      <KeyForm
        currentKey={s.aiKey}
        onSave={saveKey}
        onRemove={removeKey}
        onTest={testConnection}
      />

      <ModelPicker value={s.aiModel} {...{ get value() { return s.aiModel; }, set value(v) { setModel(v); } }} />

      <div class="rounded-xl border border-white/10 p-5 bg-white/[0.02]">
        <div class="text-[10px] uppercase tracking-wider opacity-50 mb-3">AI features</div>
        {#each [['tags','Suggest tags','Prefer existing · max 2 new per save'],['title','Suggest title','Show a friendlier title; original always recoverable'],['collection','Suggest collection','Pick from existing collections only']] as [key, label, desc]}
          <label class="flex items-start justify-between gap-4 py-2">
            <div>
              <div class="text-sm">{label}</div>
              <div class="text-xs opacity-50">{desc}</div>
            </div>
            <input
              type="checkbox"
              checked={s.aiFeatures[key as 'tags'|'title'|'collection']}
              onchange={() => toggleFeature(key as 'tags'|'title'|'collection')}
              class="mt-1 accent-accent-violet"
            />
          </label>
        {/each}
      </div>

      <PrivacyNote />
    {:else}
      <p class="opacity-50">Loading…</p>
    {/if}
  </div>
</div>
```

Note: the awkward inline `{...{ get value() { ... } }}` is a workaround if `bind:` doesn't propagate through ModelPicker's `$bindable`. If `ModelPicker bind:value={s.aiModel}` doesn't work directly because `s` is replaced on refresh, replace the line with this two-step pattern:

```svelte
<ModelPicker value={s.aiModel} oninput={(e) => setModel(e.detail)} />
```

…and have ModelPicker dispatch `oninput` events instead of `$bindable` mutation. Adjust whichever way produces working binding; one of the two will. The simpler path is acceptable.

- [ ] **Step 2: Build and verify**

Run: `npm run build && npm run check`
Expected: clean build, 0 typecheck errors.

- [ ] **Step 3: Manual smoke**

Reload the unpacked extension. Right-click the extension icon → Options. Settings page opens in a new tab. Add a fake key, click Test connection, expect "Failed" (real OpenRouter rejects). Toggle features, refresh page, verify state persists.

- [ ] **Step 4: Commit**

```bash
git add src/settings/App.svelte
git commit -m "feat(settings): wire key/model/feature management to settings storage

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Settings link from newtab sidebar

**Files:**
- Modify: `src/newtab/Sidebar.svelte`

- [ ] **Step 1: Read current sidebar**

```bash
cat src/newtab/Sidebar.svelte
```

(reference — no edit yet).

- [ ] **Step 2: Add gear icon button**

In `src/newtab/Sidebar.svelte`, add at the bottom of the `<aside>` (after the last `{#if tags.length > 0}` block):

```svelte
  <div class="mt-6 pt-3 border-t border-white/5">
    <button
      class="w-full text-left px-2 py-1 rounded hover:bg-white/5 text-xs opacity-60 hover:opacity-100"
      onclick={() => chrome.runtime.openOptionsPage()}
    >
      ⚙ Settings
    </button>
  </div>
```

- [ ] **Step 3: Build and verify manually**

Run: `npm run build`
Reload extension, open a new tab, click ⚙ Settings in sidebar — settings tab opens.

- [ ] **Step 4: Commit**

```bash
git add src/newtab/Sidebar.svelte
git commit -m "feat(newtab): settings link in sidebar opens options page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: AIBanner component

**Files:**
- Create: `src/popup/AIBanner.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
  type State = 'thinking' | 'ready' | 'error' | 'disabled';
  let { state, model, latencyMs }: { state: State; model?: string; latencyMs?: number } = $props();
</script>

<div class="rounded-lg border px-3 py-2 flex items-center gap-2 text-[11px]"
     class:border-accent-violet={state === 'thinking' || state === 'ready'}
     class:border-white={state === 'disabled' || state === 'error'}
     class:bg-accent-violet={false}
     style="background: {state === 'thinking' || state === 'ready' ? 'rgba(140,150,255,0.06)' : 'rgba(255,255,255,0.04)'}; border-color: {state === 'thinking' || state === 'ready' ? 'rgba(140,150,255,0.3)' : 'rgba(255,255,255,0.1)'}">
  {#if state === 'thinking'}
    <span class="w-1.5 h-1.5 rounded-full bg-accent-violet animate-pulse" style="box-shadow: 0 0 6px var(--color-accent-violet);"></span>
    <span class="opacity-80">Thinking{model ? ` · ${model}` : ''}…</span>
  {:else if state === 'ready'}
    <span class="w-1.5 h-1.5 rounded-full bg-accent-violet"></span>
    <span class="opacity-80">Suggestions ready{model ? ` · ${model}` : ''}{latencyMs ? ` · ${(latencyMs / 1000).toFixed(1)}s` : ''}</span>
  {:else if state === 'error'}
    <span class="opacity-70">⚠ AI request failed — saving without suggestions</span>
  {:else}
    <span class="opacity-50">AI suggestions off · enable in Settings</span>
  {/if}
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/AIBanner.svelte
git commit -m "feat(popup): AIBanner component for thinking/ready/error/disabled states

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: AISuggestions component

**Files:**
- Create: `src/popup/AISuggestions.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
  import type { Suggestion } from '$lib/ai/types';
  import type { Collection } from '$lib/types';

  let {
    suggestion,
    collections,
    onAcceptTitle,
    onAcceptTag,
    onAcceptCollection,
  }: {
    suggestion: Suggestion;
    collections: Collection[];
    onAcceptTitle: (title: string) => void;
    onAcceptTag: (name: string, isNew: boolean) => void;
    onAcceptCollection: (id: string) => void;
  } = $props();

  function colName(id: string): string {
    return collections.find((c) => c.id === id)?.name ?? '?';
  }

  let titleDismissed = $state(false);
  let tagsAccepted = $state<Set<string>>(new Set());
  let collectionAccepted = $state(false);

  async function acceptTitle() {
    if (suggestion.suggestedTitle) {
      onAcceptTitle(suggestion.suggestedTitle);
      titleDismissed = true;
    }
  }
  function acceptTag(t: { name: string; isNew: boolean }) {
    onAcceptTag(t.name, t.isNew);
    tagsAccepted = new Set([...tagsAccepted, t.name]);
  }
  function acceptCollection() {
    if (suggestion.suggestedCollectionId) {
      onAcceptCollection(suggestion.suggestedCollectionId);
      collectionAccepted = true;
    }
  }
</script>

{#if suggestion.suggestedTitle && !titleDismissed}
  <div class="mt-2 flex items-center gap-2 px-2 py-1.5 rounded-md bg-accent-violet/10 border border-accent-violet/20 text-[11px]">
    <span class="text-accent-violet">✦</span>
    <span class="flex-1 truncate font-medium">{suggestion.suggestedTitle}</span>
    <button class="px-2 py-0.5 rounded bg-accent-violet/30 text-accent-violet text-[10px]" onclick={acceptTitle}>use</button>
    <button class="px-1.5 py-0.5 rounded bg-white/5 text-[10px]" onclick={() => (titleDismissed = true)} aria-label="Dismiss">×</button>
  </div>
{/if}

{#if suggestion.suggestedTags.length > 0}
  <div class="mt-2 flex flex-wrap gap-1">
    {#each suggestion.suggestedTags as t (t.name)}
      {#if !tagsAccepted.has(t.name)}
        <button
          class="px-2 py-0.5 rounded-full text-[10px] border border-dashed"
          class:border-accent-violet={!t.isNew}
          class:text-accent-violet={!t.isNew}
          class:border-accent-teal={t.isNew}
          class:text-accent-teal={t.isNew}
          style="background: {t.isNew ? 'rgba(111,230,207,0.08)' : 'rgba(140,150,255,0.08)'}"
          onclick={() => acceptTag(t)}
        >
          {t.isNew ? '+ ' : '✦ '}{t.name}
        </button>
      {/if}
    {/each}
  </div>
{/if}

{#if suggestion.suggestedCollectionId && !collectionAccepted}
  <div class="mt-2 flex items-center gap-2 text-[11px]">
    <span class="opacity-50">Collection:</span>
    <button class="px-2 py-0.5 rounded bg-accent-violet/10 text-accent-violet text-[10px]" onclick={acceptCollection}>
      ✦ {colName(suggestion.suggestedCollectionId)}
    </button>
  </div>
{/if}
```

- [ ] **Step 2: Commit**

```bash
git add src/popup/AISuggestions.svelte
git commit -m "feat(popup): AISuggestions component for title/tags/collection picks

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Integrate AI flow into popup App.svelte

**Files:**
- Modify: `src/popup/App.svelte`

- [ ] **Step 1: Replace App.svelte**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { extractFromDocument, type ExtractedMetadata } from '$lib/metadata/extract';
  import { captureActiveTabThumbnail } from '$lib/metadata/thumbnail';
  import { performSave } from './saveFlow';
  import { bookmarks } from '$lib/storage/bookmarks';
  import { tags as tagsStore } from '$lib/storage/tags';
  import { collections as colStore } from '$lib/storage/collections';
  import { settings } from '$lib/storage/settings';
  import { suggestForBookmark } from '$lib/ai/suggest';
  import type { Bookmark, Collection, Tag } from '$lib/types';
  import type { Suggestion } from '$lib/ai/types';
  import TagPicker from './TagPicker.svelte';
  import CollectionPicker from './CollectionPicker.svelte';
  import AIBanner from './AIBanner.svelte';
  import AISuggestions from './AISuggestions.svelte';

  let bookmark = $state<Bookmark | null>(null);
  let error = $state<string | null>(null);
  let allTags = $state<Tag[]>([]);
  let allCollections = $state<Collection[]>([]);
  let selectedTagIds = $state<string[]>([]);
  let selectedCollectionId = $state<string | null>(null);

  // AI state
  let aiState = $state<'thinking' | 'ready' | 'error' | 'disabled'>('disabled');
  let aiModel = $state<string | undefined>(undefined);
  let aiLatencyMs = $state<number | undefined>(undefined);
  let suggestion = $state<Suggestion | null>(null);

  $effect(() => {
    if (!bookmark) return;
    const before = new Set(bookmark.tagIds);
    const after = new Set(selectedTagIds);
    for (const id of after) if (!before.has(id)) bookmarks.addTag(bookmark.id, id);
    for (const id of before) if (!after.has(id)) bookmarks.removeTag(bookmark.id, id);
  });

  $effect(() => {
    if (!bookmark) return;
    if (selectedCollectionId !== bookmark.collectionId) {
      bookmarks.update(bookmark.id, { collectionId: selectedCollectionId });
    }
  });

  async function runAI(b: Bookmark): Promise<void> {
    const s = await settings.get();
    if (!s.aiKey) {
      aiState = 'disabled';
      return;
    }
    aiModel = s.aiModel;
    aiState = 'thinking';
    const t0 = performance.now();
    const result = await suggestForBookmark({
      title: b.originalTitle,
      url: b.url,
      description: b.description,
      excerpt: b.excerpt,
      existingTags: allTags.map((t) => t.name),
      existingCollections: allCollections.map((c) => ({ id: c.id, name: c.name })),
    });
    aiLatencyMs = performance.now() - t0;
    if (result === null) {
      aiState = 'error';
      return;
    }
    suggestion = result;
    aiState = 'ready';
  }

  onMount(async () => {
    [allTags, allCollections] = await Promise.all([tagsStore.list(), colStore.list()]);
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('brave://')) {
        error = "Can't save this page (browser internal).";
        return;
      }
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractFromDocument,
      });
      const extracted = result?.result as ExtractedMetadata | undefined;
      if (!extracted) {
        error = "Couldn't read page metadata.";
        return;
      }
      if (!extracted.ogImageUrl) {
        const thumb = await captureActiveTabThumbnail(tab.id);
        if (thumb) extracted.ogImageUrl = thumb;
      }
      const id = await performSave({ url: tab.url, extracted });
      bookmark = await bookmarks.get(id);
      if (bookmark) void runAI(bookmark);
    } catch (e) {
      error = (e as Error).message;
    }
  });

  async function toggleStar() {
    if (!bookmark) return;
    bookmark = await bookmarks.update(bookmark.id, { starred: !bookmark.starred });
  }
  async function undoSave() {
    if (!bookmark) return;
    await bookmarks.delete(bookmark.id);
    window.close();
  }

  async function acceptTitle(title: string) {
    if (!bookmark) return;
    bookmark = await bookmarks.update(bookmark.id, { title });
  }
  async function acceptTag(name: string, isNew: boolean) {
    if (!bookmark) return;
    if (isNew) {
      const t = await tagsStore.upsertByName(name);
      allTags = await tagsStore.list();
      selectedTagIds = [...selectedTagIds, t.id];
    } else {
      const t = allTags.find((x) => x.name === name);
      if (t && !selectedTagIds.includes(t.id)) selectedTagIds = [...selectedTagIds, t.id];
    }
  }
  function acceptCollection(id: string) {
    selectedCollectionId = id;
  }
</script>

<div class="p-4 w-[320px] text-sm">
  {#if error}
    <div class="opacity-70">{error}</div>
  {:else if bookmark}
    <div class="flex gap-2 items-start">
      {#if bookmark.faviconUrl}
        <img src={bookmark.faviconUrl} alt="" class="w-8 h-8 rounded-md" />
      {:else}
        <div class="w-8 h-8 rounded-md bg-accent-violet/30"></div>
      {/if}
      <div class="flex-1 min-w-0">
        <div class="font-semibold truncate">{bookmark.title}</div>
        <div class="opacity-50 text-xs truncate">{bookmark.domain}</div>
      </div>
      <button onclick={toggleStar} class="px-2 py-1 rounded {bookmark.starred ? 'text-yellow-300' : 'opacity-50'}">★</button>
    </div>

    <div class="mt-3">
      <AIBanner state={aiState} model={aiModel} latencyMs={aiLatencyMs} />
      {#if aiState === 'ready' && suggestion}
        <AISuggestions
          {suggestion}
          collections={allCollections}
          onAcceptTitle={acceptTitle}
          onAcceptTag={acceptTag}
          onAcceptCollection={acceptCollection}
        />
      {/if}
    </div>

    <div class="mt-3">
      <div class="text-[10px] uppercase tracking-wide opacity-50 mb-1">Tags</div>
      <TagPicker bind:selectedIds={selectedTagIds} {allTags} />
    </div>
    <div class="mt-3">
      <div class="text-[10px] uppercase tracking-wide opacity-50 mb-1">Collection</div>
      <CollectionPicker bind:selectedId={selectedCollectionId} collections={allCollections} />
    </div>
    <div class="mt-3 text-xs opacity-50">Saved · <button onclick={undoSave} class="underline">undo</button></div>
  {:else}
    <div class="opacity-50">Saving…</div>
  {/if}
</div>
```

- [ ] **Step 2: Build and check**

Run: `npm run build && npm run check`
Expected: clean build, 0 typecheck errors.

- [ ] **Step 3: Run unit suite**

Run: `npm test`
Expected: all tests pass (33 from Plan 1 + 27 new from Plan 2 = 60).

- [ ] **Step 4: Manual end-to-end smoke**

1. Settings → add a real OpenRouter key (sk-or-v1-...). Click Test connection → "OK".
2. Visit any article page. Click toolbar icon. Popup opens, shows favicon/title, then within ~2s the AI banner says "Suggestions ready · ...".
3. Suggested title appears with "use" button. Click — title swaps. Suggested tags appear as pills. Click to add. Suggested collection (if any existing collections match) appears as a button. Click — collection set.
4. Open the new tab. Bookmark appears with the (possibly rewritten) title and tags.
5. Settings → Remove key → confirm. Save another bookmark → AI banner shows "AI suggestions off · enable in Settings".

- [ ] **Step 5: Commit**

```bash
git add src/popup/App.svelte
git commit -m "feat(popup): integrate AI suggestions with async banner and accept flow

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Final verification

- [ ] **Step 1: Run full unit suite**

Run: `npm test`
Expected: 60+ tests pass (33 Plan 1 + 27 Plan 2: 7 prompt + 8 openrouter + 8 suggest + 4 KeyForm = 27).

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 3: Run E2E**

Run: `npm run build && npm run test:e2e`
Expected: passes (the smoke test from Plan 1 still validates load+empty-state).

- [ ] **Step 4: Manual smoke (with real key)**

Per Task 13 step 4.

- [ ] **Step 5: Tag**

```bash
git tag plan-2-ai
git log --oneline | head -20
```

---

## Self-Review

**Spec coverage check** (against `docs/superpowers/specs/2026-05-03-midnight-markers-design.md`):

| Spec section | Covered in Plan 2 |
| --- | --- |
| Settings page (provider, key, model, features, privacy, import/export) | ✅ Tasks 6–10 (import/export deferred to Plan 3) |
| AI provider section, OpenRouter active | ✅ Implicit — settings page is OpenRouter-only |
| Disabled rows for Anthropic/OpenAI/Local "(soon)" | ⚠️ Not implemented — intentional simplification, OpenRouter covers all those models. The settings page accurately represents the architecture. |
| API key input, Test connection, Change/Remove | ✅ Task 7 |
| AI feature toggles (tags/title/collection) | ✅ Task 9 |
| Privacy disclosure block | ✅ Task 8 |
| OpenRouter client (BASE + chat/completions + auth/key) | ✅ Task 4 |
| `suggestForBookmark` orchestrator (prompt, validation, graceful degrade) | ✅ Task 5 |
| Popup AI banner, async suggestions | ✅ Tasks 11–13 |
| Suggested title bar, tag pills (existing/new), collection | ✅ Task 12 |
| Manifest changes (host_permission, options_ui) | ✅ Task 1 |
| Settings page accessible from sidebar gear | ✅ Task 10 |

**Placeholder scan:** clean. No TBD/TODO. The one "if-the-binding-doesn't-work-try-this-instead" note in Task 9 is not a placeholder — it's a documented fallback for a known Svelte 5 quirk with `$bindable` across replaced parent state, with both alternatives spelled out.

**Type consistency:**
- `Suggestion`, `SuggestedTag`, `SuggestInput` defined in Task 2's `types.ts`, used in Tasks 4, 5, 12, 13.
- `OpenRouterError`, `chatComplete`, `validateKey` defined in Task 4, used in Tasks 5, 9.
- `buildMessages` in Task 3 returns `OpenRouterMessage[]` per Task 2.
- `aiKey`/`aiModel`/`aiFeatures` settings shape matches Plan 1's `Settings` type — already defined.

**Scope check:** This is one plan that produces working software. All 14 tasks chain — no orphan code paths. The intentional non-goals (provider abstraction beyond OpenRouter, full import/export, broken-link checker, list view, DnD) are deferred to Plan 3 and explicitly out of scope.

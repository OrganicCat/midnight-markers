import { settings } from '$lib/storage/settings';
import { log, recordAIError } from '$lib/log';
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

export type SuggestFailReason =
  | { kind: 'no-key' }
  | { kind: 'no-features' }
  | { kind: 'http'; status: number; body: string; message: string }
  | { kind: 'timeout' }
  | { kind: 'parse'; message: string; body: string }
  | { kind: 'unknown'; message: string };

export type SuggestResult =
  | { ok: true; suggestion: Suggestion }
  | { ok: false; reason: SuggestFailReason };

export async function suggestForBookmarkResult(
  input: SuggestInput,
  options: { timeoutMs?: number } = {},
): Promise<SuggestResult> {
  const s = await settings.get();
  if (!s.aiKey) {
    log.info('AI suggest skipped: no key set');
    return { ok: false, reason: { kind: 'no-key' } };
  }

  const anyFeatureOn = s.aiFeatures.tags || s.aiFeatures.title || s.aiFeatures.collection;
  if (!anyFeatureOn) {
    log.info('AI suggest skipped: all features off');
    return { ok: false, reason: { kind: 'no-features' } };
  }

  const ac = new AbortController();
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timeout = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const raw = (await chatComplete({
      apiKey: s.aiKey,
      model: s.aiModel,
      messages: buildMessages(input),
      signal: ac.signal,
    })) as RawModelOutput;

    log.info('AI suggest succeeded', { model: s.aiModel });
    return { ok: true, suggestion: shapeSuggestion(raw, input, s.aiFeatures) };
  } catch (e) {
    const reason = classifyError(e);
    log.error('AI suggest failed', reason);
    void recordAIError({
      ts: Date.now(),
      message: reasonMessage(reason),
      ...('status' in reason ? { status: reason.status } : {}),
      ...('body' in reason ? { body: reason.body } : {}),
      model: s.aiModel,
      url: 'https://openrouter.ai/api/v1/chat/completions',
    });
    return { ok: false, reason };
  } finally {
    clearTimeout(timeout);
  }
}

// Backwards-compatible wrapper: returns Suggestion | null (for tests + simple callers).
export async function suggestForBookmark(
  input: SuggestInput,
  options: { timeoutMs?: number } = {},
): Promise<Suggestion | null> {
  const r = await suggestForBookmarkResult(input, options);
  return r.ok ? r.suggestion : null;
}

function classifyError(e: unknown): SuggestFailReason {
  if (e instanceof OpenRouterError) {
    if (e.status !== undefined) {
      return { kind: 'http', status: e.status, body: e.body ?? '', message: e.message };
    }
    return { kind: 'parse', message: e.message, body: e.body ?? '' };
  }
  const name = (e as { name?: string }).name;
  if (name === 'AbortError') return { kind: 'timeout' };
  return { kind: 'unknown', message: (e as Error).message ?? String(e) };
}

function reasonMessage(r: SuggestFailReason): string {
  switch (r.kind) {
    case 'no-key': return 'No API key set';
    case 'no-features': return 'All AI features disabled';
    case 'http': return `OpenRouter HTTP ${r.status}: ${r.message}`;
    case 'timeout': return 'Request timed out';
    case 'parse': return `Bad model output: ${r.message}`;
    case 'unknown': return r.message;
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

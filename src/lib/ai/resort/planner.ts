import { log } from '$lib/log';
import { getProvider, isProviderError, type ChatProvider } from '$lib/ai/provider';
import type { SuggestFailReason } from '$lib/ai/suggest';
import { buildSkeletonMessages, sampleBookmarks } from './skeleton';
import { buildFilingMessages, parseFilings, parseSkeleton } from './filing';
import type {
  BookmarkRef,
  FilingResult,
  FolderNode,
  ResortPlan,
  ResortProgress,
  Skeleton,
} from './types';

export const BATCH_SIZE = 100;
export const CONCURRENCY = 2;
export const SAMPLE_SIZE = 200;
export const MAX_BOOKMARKS = 5000;

export type ResortFailReason =
  | SuggestFailReason
  | { kind: 'too-many'; count: number }
  | { kind: 'empty-skeleton' };

export type ResortRunArgs = {
  folders: FolderNode[];
  bookmarks: BookmarkRef[];
  apiKey: string;
  model: string;
  /** Defaults to OpenRouter so existing callers keep their behaviour. */
  provider?: ChatProvider;
  signal: AbortSignal;
  onProgress?: (p: ResortProgress) => void;
};

export type ResortRunResult =
  | { ok: true; plan: ResortPlan }
  | { ok: false; reason: ResortFailReason };

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function classifyError(e: unknown, providerLabel: string): SuggestFailReason {
  if (isProviderError(e)) {
    if (e.status !== undefined) {
      return {
        kind: 'http',
        status: e.status,
        body: e.body ?? '',
        message: e.message,
        provider: providerLabel,
      };
    }
    return { kind: 'parse', message: e.message, body: e.body ?? '' };
  }
  const name = (e as { name?: string }).name;
  if (name === 'AbortError') return { kind: 'timeout' };
  return { kind: 'unknown', message: (e as Error).message ?? String(e) };
}

export function resortReasonMessage(r: ResortFailReason): string {
  switch (r.kind) {
    case 'no-key': return 'No API key set';
    case 'no-features': return 'All AI features disabled';
    case 'no-consent': return 'Data sharing not accepted yet — see Settings';
    case 'http': return `${r.provider} HTTP ${r.status}: ${r.message}`;
    case 'timeout': return 'Request timed out or was cancelled';
    case 'parse': return `Bad model output: ${r.message}`;
    case 'too-many':
      return `Too many bookmarks to resort at once (${r.count}, limit ${MAX_BOOKMARKS}). Resort a folder instead.`;
    case 'empty-skeleton': return 'The model did not propose any folders';
    case 'unknown': return r.message;
  }
}

/** Runs `tasks` with at most `limit` in flight, preserving result order. */
async function pooled<T>(tasks: Array<() => Promise<T>>, limit: number): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    for (;;) {
      const i = next++;
      const task = tasks[i];
      if (!task) return;
      results[i] = await task();
    }
  });
  await Promise.all(workers);
  return results;
}

export async function runResort(args: ResortRunArgs): Promise<ResortRunResult> {
  const provider = args.provider ?? getProvider('openrouter');

  if (args.bookmarks.length > MAX_BOOKMARKS) {
    return { ok: false, reason: { kind: 'too-many', count: args.bookmarks.length } };
  }

  // Pass 1 — skeleton.
  args.onProgress?.({ phase: 'skeleton' });
  let skeleton: Skeleton;
  try {
    const raw = await provider.chatComplete({
      apiKey: args.apiKey,
      model: args.model,
      messages: buildSkeletonMessages({
        folders: args.folders,
        sample: sampleBookmarks(args.bookmarks, SAMPLE_SIZE),
      }),
      signal: args.signal,
    });
    skeleton = parseSkeleton(raw);
  } catch (e) {
    const reason = classifyError(e, provider.label);
    log.error('resort skeleton failed', reason);
    return { ok: false, reason };
  }

  if (skeleton.folders.length === 0) {
    return { ok: false, reason: { kind: 'empty-skeleton' } };
  }

  // Pass 2 — filing, batched.
  const batches = chunk(args.bookmarks, BATCH_SIZE);
  let done = 0;
  const allIds = new Set(args.bookmarks.map((b) => b.id));

  const runBatch = async (batch: BookmarkRef[]): Promise<FilingResult[]> => {
    const messages = buildFilingMessages({ skeleton: skeleton.folders, batch });
    const ids = new Set(batch.map((b) => b.id));
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await provider.chatComplete({
          apiKey: args.apiKey,
          model: args.model,
          messages,
          signal: args.signal,
        });
        return parseFilings(raw, skeleton.folders, ids);
      } catch (e) {
        if (args.signal.aborted) throw e;
        log.warn('resort filing batch failed', {
          attempt,
          reason: classifyError(e, provider.label),
        });
        if (attempt === 1) return [];
      }
    }
    return [];
  };

  let batchResults: FilingResult[][];
  try {
    batchResults = await pooled(
      batches.map((batch) => async () => {
        const out = await runBatch(batch);
        done += batch.length;
        args.onProgress?.({ phase: 'filing', done, total: args.bookmarks.length });
        return out;
      }),
      CONCURRENCY,
    );
  } catch (e) {
    const reason = classifyError(e, provider.label);
    log.error('resort filing aborted', reason);
    return { ok: false, reason };
  }

  const filings = batchResults.flat();
  const filed = new Set(filings.map((f) => f.id));
  const unplannedIds = [...allIds].filter((id) => !filed.has(id));

  log.info('resort plan complete', {
    folders: skeleton.folders.length,
    filed: filings.length,
    unplanned: unplannedIds.length,
  });

  return { ok: true, plan: { skeleton, filings, unplannedIds } };
}

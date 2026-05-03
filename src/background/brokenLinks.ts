import { getDb } from '$lib/storage/db';
import { bookmarks } from '$lib/storage/bookmarks';
import type { Bookmark } from '$lib/types';

const DEFAULT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export async function pickBatch(size: number, cooldownMs: number = DEFAULT_COOLDOWN_MS): Promise<Bookmark[]> {
  const db = await getDb();
  const all = await db.getAll('bookmarks');
  const cutoff = Date.now() - cooldownMs;
  const eligible = all.filter((b) => b.lastCheckedAt === null || b.lastCheckedAt < cutoff);
  eligible.sort((a, b) => (a.lastCheckedAt ?? 0) - (b.lastCheckedAt ?? 0));
  return eligible.slice(0, size);
}

export async function checkOnce(b: Bookmark): Promise<void> {
  let isBroken = false;
  try {
    const res = await fetch(b.url, { method: 'HEAD', redirect: 'follow' });
    isBroken = !res.ok;
  } catch {
    isBroken = true;
  }
  await bookmarks.update(b.id, { isBroken, lastCheckedAt: Date.now() });
}

export async function checkBatch(size = 30, cooldownMs = DEFAULT_COOLDOWN_MS): Promise<{ checked: number }> {
  const batch = await pickBatch(size, cooldownMs);
  for (const b of batch) {
    await checkOnce(b);
  }
  return { checked: batch.length };
}

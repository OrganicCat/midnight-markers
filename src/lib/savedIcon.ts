import { ext } from '$lib/ext';

/**
 * Shared pieces of the "already saved" toolbar icon.
 *
 * The feature reads every tab's URL, which needs the `tabs` permission. That
 * permission is optional (see manifest.json), so the feature is on exactly
 * when the user has granted it. There is no separate setting to drift out of
 * sync, and revoking `tabs` from the browser's own extension page turns it off.
 */
export const SAVED_ICON_PERMISSION: chrome.permissions.Permissions = { permissions: ['tabs'] };

/** Message pages send to wake the background script after a library change. */
export const BOOKMARKS_CHANGED_MESSAGE = 'mm:bookmarks-changed';

export async function savedIconEnabled(): Promise<boolean> {
  try {
    return (await ext?.permissions?.contains(SAVED_ICON_PERMISSION)) ?? false;
  } catch {
    return false;
  }
}

/**
 * The URL in the form used to decide whether two URLs are the same page.
 *
 * Drops the fragment (`#section` is the same page) and a trailing slash on a
 * non-root path (`/docs/` and `/docs` almost always serve the same thing). The
 * query string stays, since it often picks the content. Returns null for
 * anything that isn't http(s), which can't be saved in the first place.
 */
export function normalizeUrl(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  u.hash = '';
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) {
    u.pathname = u.pathname.replace(/\/+$/, '');
  }
  return u.toString();
}

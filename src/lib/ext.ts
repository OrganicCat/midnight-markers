/**
 * The extension API namespace, for whichever browser we're running in.
 *
 * Chrome and Firefox both ship a `chrome.*` namespace, but they don't behave
 * the same way. Chrome's Manifest V3 APIs return promises. Firefox's `chrome.*`
 * is a callback-based porting shim — the promise-returning namespace there is
 * `browser.*`. Since this codebase `await`s its API calls, using `chrome.*`
 * directly would silently resolve to `undefined` on Firefox.
 *
 * See https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Chrome_incompatibilities
 *
 * So: prefer `browser` when it exists, fall back to `chrome`. Both are typed
 * with @types/chrome, which is close enough — the surface we use (storage,
 * tabs, alarms, bookmarks, scripting, runtime) is identical across the two.
 *
 * Can be `undefined` under unit tests, which run in happy-dom with no
 * extension APIs at all. Callers that might run outside an extension page
 * should guard with `ext?.`.
 */
const globals = globalThis as typeof globalThis & {
  browser?: typeof chrome;
  chrome?: typeof chrome;
};

export const ext: typeof chrome = (globals.browser ?? globals.chrome) as typeof chrome;

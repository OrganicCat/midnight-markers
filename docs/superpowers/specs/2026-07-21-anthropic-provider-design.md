# Multi-provider AI: add Anthropic alongside OpenRouter

**Date:** 2026-07-21
**Status:** Approved, implementing

## Goal

Users can enter an Anthropic API key and run every AI feature (save-time
suggestions and Resort) directly against the Anthropic Messages API, instead of
being forced through OpenRouter. OpenRouter remains fully supported and remains
the default; nothing about an existing install changes without user action.

## Non-goals

- No third provider, and no plugin architecture for adding one. Two concrete
  providers behind one interface; generalise later if a third ever appears.
- No per-feature provider selection. One provider is active at a time and it
  serves both suggestions and Resort.
- No proxying, no developer-hosted keys. Requests continue to go from the
  user's browser to the vendor under the user's own key.

## Design

### 1. Settings shape

`Settings.aiKey` today means "the OpenRouter key". That name stops being true
with two providers, so the pair is renamed and a second pair added:

```ts
aiProvider: 'openrouter' | 'anthropic'   // default 'openrouter'
openrouterKey:   string | null
openrouterModel: string                  // default 'anthropic/claude-haiku-4.5'
anthropicKey:    string | null
anthropicModel:  string                  // default 'claude-haiku-4-5'
```

Both keys are sealed independently as `openrouterKeySealed` and
`anthropicKeySealed`, reusing the existing AES-GCM envelope. `crypto.ts` is not
touched — it already seals an arbitrary string, and each key gets its own
envelope.

`settings.get()` gains one migration step, sitting alongside the existing
pre-v0.3 plaintext migration:

- `aiKeySealed` → `openrouterKeySealed`
- legacy plaintext `aiKey` → unseal path → `openrouterKeySealed`
- `aiModel` → `openrouterModel`

The migration is written back in place on first read, exactly as the existing
plaintext migration is, and the legacy field names are deleted from the stored
object so they cannot survive a subsequent write. An install that has only ever
seen the old shape reads back as `aiProvider: 'openrouter'` with its key and
model intact.

**Both keys are retained across a provider switch.** Switching provider changes
only `aiProvider`; it never clears the other provider's key. Switching back does
not require re-pasting.

### 2. Provider abstraction

New `src/lib/ai/provider.ts`:

```ts
export type ProviderId = 'openrouter' | 'anthropic';

export interface ChatProvider {
  id: ProviderId;
  label: string;         // 'OpenRouter' | 'Anthropic' — for UI copy and error messages
  endpointUrl: string;   // recorded in AI-error diagnostics
  chatComplete(args: ChatCompleteArgs): Promise<unknown>;
  validateKey(apiKey: string): Promise<boolean>;
}

export function getProvider(id: ProviderId): ChatProvider;
export function activeProvider(s: Settings): ChatProvider;
export function activeKey(s: Settings): string | null;
export function activeModel(s: Settings): string;
```

`ProviderError` replaces provider-specific error classes as the common type
carrying `status` and `body`. `OpenRouterError` becomes an alias/subclass so the
existing `instanceof` checks in `suggest.ts` and `planner.ts` keep working
during the change and the existing tests stay meaningful.

`openrouter.ts` keeps its current named exports (`chatComplete`, `validateKey`,
`OpenRouterError`) and additionally exports a `ChatProvider` object built from
them. Its behaviour is unchanged.

### 3. Anthropic client

New `src/lib/ai/anthropic.ts`, built on `@anthropic-ai/sdk` (v0.112.4):

```ts
new Anthropic({ apiKey, dangerouslyAllowBrowser: true, fetch })
```

- `dangerouslyAllowBrowser: true` is required — the SDK refuses to construct in
  a browser context otherwise. This is correct here: the key is the user's own,
  entered by them, and never leaves their browser except to Anthropic. The
  extension has no server to proxy through.
- The `fetch` option is the **test seam**. Production passes nothing (global
  fetch); tests inject a mock and assert on the real wire request — same style
  as the existing `openrouter.test.ts`, rather than `vi.mock`-ing the SDK and
  testing a mock's shape instead of the request.

Two shape differences from the OpenRouter path:

- **System prompt.** `buildMessages()` returns a `system`-role message first;
  the Messages API takes `system` as a separate top-level parameter. A small
  adapter in `anthropic.ts` splits the leading system message out. `prompt.ts`,
  `resort/filing.ts`, and `resort/skeleton.ts` are untouched.
- **No `response_format: json_object`.** Structured outputs
  (`output_config.format`) are deliberately **not** used: they are supported
  only on a subset of models, so a user-entered custom model id would 400. The
  existing `parseModelJSON` fence-stripper already handles unfenced and
  ```json-fenced output — it was added for exactly this, a real Claude Haiku
  response — so the Anthropic path sends a plain request and runs the response
  text through the same parser. One code path, one failure mode, already tested.

`validateKey` uses `messages.countTokens()`: it authenticates against the real
API without spending a generation, and returns false on any auth or network
error rather than throwing.

`max_tokens` is required by the Messages API (it is optional/absent on the
OpenRouter path) and is set to a fixed value sized for these JSON responses.

### 4. Call sites

Everything that currently hardcodes OpenRouter becomes provider-aware:

| File | Change |
|---|---|
| `src/lib/ai/suggest.ts` | Route through `activeProvider()`; key/model from active pair; diagnostics `url` from `provider.endpointUrl`; error text uses `provider.label` |
| `src/lib/ai/resort/planner.ts` | Same — two `chatComplete` call sites |
| `src/lib/ai/consent.ts` | `canUseAI` / `whyBlocked` check the *active* provider's key |
| `src/newtab/ResortDialog.svelte` | Active key/model; provider name in the blocked-state copy |
| `src/popup/App.svelte` | Active key/model for the AI banner |
| `src/manifest.json` | Add `https://api.anthropic.com/*` to `host_permissions` |

### 5. Settings UI

- **New `ProviderPicker.svelte`** — segmented control, OpenRouter | Anthropic.
- **`KeyForm.svelte`** — provider-aware label, placeholder (`sk-ant-...`), and
  help link (`console.anthropic.com/settings/keys`). Bound to the active
  provider's key.
- **`ModelPicker.svelte`** — presets switch per provider. Anthropic presets:
  `claude-haiku-4-5`, `claude-sonnet-5`, `claude-opus-4-8`. Custom-id entry
  stays available on both.
- **`PrivacyNote.svelte`** — the disclosure names the active provider and links
  to that vendor's privacy policy. The consent record itself is unchanged
  (`aiConsentAt`): consent is to the *pattern* of sending page data to a
  third-party model provider, and the disclosure text states which one is
  active. Switching provider does not silently re-scope an existing consent —
  see Open question below.

Copy elsewhere that names OpenRouter (`HelpDialog.svelte`,
`newtab/tour/steps.ts`, `README.md`, `PRIVACY.md`, `docs/store-listing.md`) is
updated to describe "OpenRouter or Anthropic".

### 6. Tests

Mirroring the existing OpenRouter coverage, plus the gaps this change opens:

- **`tests/unit/ai/anthropic.test.ts`** (new) — full mirror of the 129-line
  OpenRouter suite, via injected `fetch`: request URL and method; `x-api-key`,
  `anthropic-version`, and `anthropic-dangerous-direct-browser-access` headers;
  model / `max_tokens` / system-split in the body; parsing the first text block;
  fence-stripping; non-OK response → error carrying status and body; empty and
  malformed content; abort signal propagation; `validateKey` ok / auth-fail /
  network-throw.
- **`tests/unit/ai/provider.test.ts`** (new) — `getProvider` routing,
  `activeProvider` / `activeKey` / `activeModel` against a `Settings` object,
  endpoint URLs.
- **`tests/unit/ai/suggest.test.ts`** (extend) — routes to the selected
  provider; `no-key` when the *active* provider's key is absent while the other
  is set; diagnostics URL matches the active provider.
- **`tests/unit/ai/consent.test.ts`** (extend) — gate opens/closes on the active
  provider's key, not the other one's.
- **`tests/unit/storage/settings.test.ts`** (extend) — the new fields default
  and round-trip; both keys persist independently.
- **`tests/unit/storage/settingsSecurity.test.ts`** (extend — this, not
  `settings.test.ts`, is where the key-at-rest coverage lives) — neither key is
  ever written in plaintext; the `aiKeySealed` → `openrouterKeySealed` migration
  preserves the key and scrubs the old field; removing one provider's key leaves
  the other's sealed value intact.
- **`tests/unit/settings/ProviderPicker.test.ts`** (new) and extensions to
  `KeyForm.test.ts`, plus a new `ModelPicker.test.ts`.

Gate: `npm test`, `npm run check`, `npm run lint` all clean.

## Risks

- **Migration is the sharp edge.** It rewrites the field that holds the user's
  key. A bug here loses their key (recoverable — they re-paste) or, worse,
  writes it somewhere unsealed (not recoverable). The
  `settingsSecurity.test.ts` additions exist specifically to pin both.
- **`dangerouslyAllowBrowser`** is accurate naming for a real consideration: it
  exists because embedding a key in a *shipped web page* exposes it to that
  page's visitors. That does not apply here — the key is the user's own, stored
  encrypted in their own browser profile — but it is worth stating plainly in
  PRIVACY.md rather than quietly setting the flag.
- **SDK bundle size** in an extension. **Measured:** imported at module scope,
  the SDK added +162 kB raw / +43 kB gzipped to the shared startup chunk that
  the popup, new tab, and settings pages all load — a cost paid by every user
  including the OpenRouter-only majority. Resolved by loading the SDK through a
  dynamic `import()` inside `anthropic.ts`, which moves it to its own lazy chunk
  fetched only when an Anthropic request actually fires. The shared chunk now
  grows by +5 kB raw / +1.6 kB gzipped. `client()` is async as a result.

## Open question (does not block implementation)

Should switching provider after consent re-prompt for consent? Argument for:
the user consented to data going to a named vendor, and the destination is now
a different company. Argument against: the disclosure describes the category of
data and the user is the one performing the switch, in the same settings page
where the disclosure sits. Implementing the non-re-prompting behaviour for now
(consent persists across a switch, disclosure text updates to name the active
provider) and flagging it for review, since the stricter behaviour is easy to
add later and the looser one cannot be retroactively un-shipped.

## Implementation notes (post-hoc)

Three things the design did not anticipate, recorded because each was a real
defect the tests caught rather than a stylistic choice:

1. **The SDK's abort error is not name-detectable.** `APIUserAbortError` sets
   `name` to plain `"Error"`; only its constructor carries the name. Detecting
   an abort by `e.name === 'AbortError'` therefore misclassified every timeout
   as `unknown`, and the user would have seen a meaningless error instead of
   "Request timed out". `isAbort()` now keys on the `AbortSignal` itself, with
   the name and constructor-name checks as fallbacks. `instanceof` is
   deliberately not used — the class sits behind the dynamic import, and
   importing it eagerly would undo the bundle split. Pinned by a test in both
   `anthropic.test.ts` and `suggest.test.ts`.

2. **`ModelPicker`'s mode effect must key on the preset list, not on `value`.**
   Reacting to `value` snapped the picker back to the dropdown the instant the
   user clicked through to custom entry, because at that moment `value` is still
   a preset. Regression test added.

3. **happy-dom cannot remove a bare `<select>`.** `HTMLSelectElement.remove()`
   is the remove-option-by-index API and shadows `ChildNode.remove()`, so
   Svelte's teardown threw. The select is wrapped in a `div` so the container is
   detached instead. This is a test-environment workaround with no production
   cost, and it is commented as such at the call site.

**Pre-existing, untouched:** `npm run lint` fails on this repo independently of
this change — the ESLint 9 flat-config migration has not been done, and it fails
identically on `main`. Not fixed here to keep the diff scoped; worth its own
change.

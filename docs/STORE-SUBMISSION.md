# Chrome Web Store submission notes

Everything the developer dashboard asks for, written out so it can be pasted
rather than improvised. The permission justifications and the privacy
practices tab are where most extension reviews go wrong, so these are worded
to match what the code actually does.

Regenerate the upload and the listing images with:

    npm run package        # release/midnight-markers-<version>.zip
    npm run store-assets   # release/store/*.png

Upload at <https://chrome.google.com/webstore/devconsole>. The store takes a
**zip**, not a crx — Google signs the crx itself. Crx files are only for
self-hosted or enterprise-deployed extensions.

## Listing basics

- **Name:** Midnight Markers
- **Summary (132 char limit):** A dark, polished bookmark library for Brave
  and Chrome.
- **Category:** Productivity
- **Language:** English

## Single purpose

> Midnight Markers is a bookmark manager. It replaces the new tab page with a
> searchable library of pages you have saved, organised into collections and
> tags, and provides a toolbar popup for saving the current page.

## Permission justifications

The full paste-ready text for every field, each within the dashboard's
1000-character limit, is in [`STORE-PERMISSIONS.txt`](STORE-PERMISSIONS.txt).
Summary of what each permission is actually for:

| Permission | Used for | Where |
|---|---|---|
| `storage` | The last AI error, for the diagnostics panel — nothing else | `src/lib/log.ts` |
| `activeTab` | Reading the current tab's URL/title and capturing a thumbnail, on click | `src/popup/App.svelte`, `src/lib/metadata/thumbnail.ts` |
| `scripting` | One metadata-extraction function in the tab being saved | `src/popup/App.svelte:123` |
| `bookmarks` | Read-only `getTree()` for the optional import | `src/lib/native/importBookmarks.ts` |
| `alarms` | The single daily broken-link alarm | `src/background/service-worker.ts` |

One correction worth keeping straight, because it is easy to get wrong and a
reviewer can check it: `storage` is **not** where the extension keeps its
data. Bookmarks, collections, tags, preferences and the encrypted API key all
live in IndexedDB, which needs no permission. `chrome.storage.local` holds
only the most recent AI error record.

There is no `<all_urls>` and no broad host access. The two AI endpoints are
the only hosts the extension can reach, and the `tabs` permission was
deliberately dropped in favour of `activeTab`.

## Privacy practices tab

**Does your extension collect user data?** Yes — declare the categories below.

This trips people up, so the reasoning is worth keeping. "Local-only" is a
true statement about this extension, but it is not an exemption from the
form. Per the
[user data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq):

> Extensions are required to disclose how they handle user data, even when
> data is processed or stored locally on a user's device and is not
> transmitted to external servers or third parties.

and "handle" there means "collecting, transmitting, using, or sharing user
data". So three categories get ticked even though the developer receives
nothing, there is no backend, and there is no analytics.

Ticking them does not put "sends your browsing to the developer" on the
listing. The public page shows the categories alongside the certifications
below; the privacy policy is what explains that the data stays on the device.

Tick these categories:

- **Personally identifiable information** — no
- **Health information** — no
- **Financial and payment information** — no
- **Authentication information** — yes. The user's own AI provider API key,
  stored encrypted on their device and sent only to that provider.
- **Personal communications** — no
- **Location** — no. A provider sees an IP address when a request is made,
  but that is their server log, not something this extension collects.
- **Web history** — yes. The form defines this as "the list of web pages a
  user has visited, as well as associated data such as page title and time of
  visit", which describes a bookmark library exactly. The optional import
  also reads the browser's existing bookmark tree. Stored in IndexedDB.
- **User activity** — no. No click, scroll, mouse-position or keystroke
  logging, and no network monitoring. Keyboard shortcuts are not keylogging.
- **Website content** — yes. Page title, meta description, a text excerpt and
  a thumbnail of saved pages, stored locally, and sent to the user's chosen
  AI provider only if they enable AI features.

**Certifications** — all three can be checked truthfully:

- Not being sold to third parties ✅
- Not being used or transferred for purposes unrelated to the item's single
  purpose ✅
- Not being used or transferred to determine creditworthiness or for lending
  purposes ✅

**Remote code:** **No.** Everything executable ships inside the zip. The
Anthropic SDK is bundled at build time by Vite; nothing is fetched and
evaluated at runtime, and there is no `eval` or `new Function` in the source.

**Privacy policy URL:**

    https://organiccat.github.io/midnight-markers/privacy/

## What is sent off the device, precisely

Worth having to hand if a reviewer asks. AI requests are gated by
`canUseAI()` in `src/lib/ai/consent.ts`, which is the single chokepoint every
outbound request passes through. It returns false unless *all* of these hold:

1. the user accepted the in-product data-sharing disclosure (`aiConsentAt`),
2. an API key exists for the currently selected provider, and
3. at least one AI feature is switched on.

When it does fire, the request body contains only: the page title, its URL,
its meta description, a content excerpt capped at 500 characters, and the
names of the user's existing tags and collections. Nothing else — no browsing
history, no other bookmarks, no identifiers.

## Privacy policy hosting

Done. The repo is public at
<https://github.com/OrganicCat/midnight-markers> and GitHub Pages serves it
from `main` at the root:

- Site: <https://organiccat.github.io/midnight-markers/>
- Policy: <https://organiccat.github.io/midnight-markers/privacy/>

Worth knowing if the policy ever stops rendering: Pages runs Jekyll, and
Jekyll only converts Markdown that carries YAML front matter. `PRIVACY.md`
has front matter and a `/privacy/` permalink for exactly that reason. Strip
it and the file reverts to a raw download, which is not an acceptable
privacy policy URL.

## Listing images

Produced by `npm run store-assets` into `release/store/`:

| File | Size | Required |
|---|---|---|
| `promo-tile-440x280.png` | 440x280 | Yes |
| `screenshot-1-library-grid.png` | 1280x800 | At least one |
| `screenshot-2-list-view.png` | 1280x800 | |
| `screenshot-3-search.png` | 1280x800 | |
| `screenshot-4-settings.png` | 1280x800 | |

The 128px icon the store also requires is inside the zip, declared in the
manifest.

The screenshots are captured from the real extension driven by Playwright,
against a seeded demo library — no real bookmarks are shown. Capture needs a
display server, since MV3 extensions do not load in old headless Chromium.

## Before you upload

1. `npm test && npm run check && npm run lint`
2. `npm run package`
3. Extract the zip somewhere clean and load *that folder* as an unpacked
   extension. This tests the exact bytes being uploaded, which is the whole
   point — a build that works and a package that works are different claims.
4. Expect review to take anywhere from a few hours to a couple of weeks. The
   `bookmarks` permission and the AI host permissions are the parts most
   likely to draw a manual look, which is what the justifications above are
   for.

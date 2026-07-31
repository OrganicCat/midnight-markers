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

Paste each into the matching field. Every permission below is used; there is
nothing declared speculatively.

**storage** — Stores the user's preferences (theme scale, default view,
selected AI model) and the encrypted API key. Also holds the last AI error so
the diagnostics panel can display it.

**activeTab** — Lets the toolbar popup read the page the user is currently
looking at, at the moment they click Save. Access is limited to that one tab
and only in response to that click.

**scripting** — Runs a single metadata extraction function in the active tab
when the user clicks Save, to read the page title, meta description, og:image
and a short text excerpt. It is a static function, not injected code, and it
does not run on any page the user has not explicitly saved.

**bookmarks** — Powers the one-click "Import browser bookmarks" feature, which
copies the user's existing bookmark tree into the extension's own library and
turns folder names into collections. Read-only, and only when the user starts
the import.

**alarms** — Schedules the daily broken-link check, which revisits saved URLs
in the background and flags ones that no longer resolve.

**Host permission: `https://openrouter.ai/*`** — Sends bookmark metadata to
OpenRouter for AI tag and title suggestions, using the user's own API key,
only after they have opted in.

**Host permission: `https://api.anthropic.com/*`** — Same as above for users
who choose Anthropic as their provider instead.

Note there is no `<all_urls>` and no broad host access. The two hosts are the
only AI endpoints the extension can reach.

## Privacy practices tab

**Does your extension collect user data?** Yes — declare the categories below.
The developer receives none of it; there is no backend and no analytics. The
declaration covers data the extension *handles*, which is what the form asks.

Tick these categories:

- **Personally identifiable information** — no
- **Health information** — no
- **Financial and payment information** — no
- **Authentication information** — yes. The user's own AI provider API key,
  stored encrypted on their device and sent only to that provider.
- **Personal communications** — no
- **Location** — no
- **Web history** — yes. Bookmarks the user saves are, by definition, pages
  they visited. Stored locally in IndexedDB.
- **User activity** — no
- **Website content** — yes. Page title, meta description and a text excerpt
  of saved pages, stored locally, and sent to the user's chosen AI provider
  only if they enable AI features.

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

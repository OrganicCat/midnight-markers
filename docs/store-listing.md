# Chrome Web Store submission copy

Everything the dashboard asks for, ready to paste. Fill the two `TODO` values
before submitting.

- **Privacy policy URL:** `TODO` — must be a live public URL serving
  `PRIVACY.md`. See "Hosting the privacy policy" below.
- **Support email:** lee.delarm@gmail.com (must be verified in the dashboard)

---

## Single purpose

Paste verbatim into the "Single purpose" field:

> midnight-markers is a bookmark manager: it saves web pages to a local library
> and helps you organise them into collections and tags, including optional
> AI-assisted suggestions for how to tag and file them.

This is deliberately one sentence describing one capability. Do not reword it
as "a bookmark manager **and** an AI assistant" — two purposes invites a
single-purpose rejection and undermines the Limited Use justification for
sending page content off-device.

## Short description (132 char limit)

> A dark, polished bookmark library for Chrome and Brave, with optional
> AI-assisted tagging and filing using your own API key.

(123 characters.)

## Detailed description

> midnight-markers replaces your new tab with a fast, dark bookmark library.
>
> • Save any page in one click, with thumbnail, description and excerpt
> • Organise into nested collections and tags, with drag-to-nest
> • Instant fuzzy search across your whole library
> • Smart views: recent, unread, starred, untagged, broken links
> • Import your existing browser bookmarks
> • Export everything to JSON at any time
>
> OPTIONAL AI ASSISTANCE
>
> If you want it, midnight-markers can suggest tags, a cleaner title, and which
> collection a page belongs in — and can reorganise a whole folder or your
> entire library at once, showing you a preview of every proposed change before
> anything is applied.
>
> AI features are OFF by default and require your own OpenRouter API key. When
> enabled, the page title, URL, description, a short excerpt, and your existing
> tag and collection names are sent directly from your browser to OpenRouter
> under your own key and billed to your own account. Nothing passes through any
> server we operate. You are shown exactly what is sent and must accept it
> before anything is transmitted, and you can withdraw consent at any time.
>
> Everything else stays on your device.

## Permission justifications

Paste each into the matching field on the Privacy tab.

**storage**
> Stores the user's bookmark library, collections, tags and preferences locally
> in the browser. No data is sent to any server by this permission.

**activeTab**
> When the user clicks the extension's toolbar button to save the current page,
> this grants temporary access to that one tab so the extension can read its
> URL and title and capture a thumbnail. Access is limited to the tab the user
> invoked the extension on and is revoked when they navigate away.

**scripting**
> Injects a small script into the active tab, only when the user clicks the
> toolbar button, to read the page's title, meta description and a short text
> excerpt so the bookmark can be saved with useful metadata. No script is
> injected without that explicit user action.

**bookmarks**
> Powers the optional "Import browser bookmarks" feature, which reads the
> user's existing browser bookmark tree so it can be copied into the
> extension's own library. Bookmark data is read locally and is never
> transmitted off the device.

**alarms**
> Schedules a once-daily background check for broken links in the user's saved
> bookmarks, so dead pages can be flagged. Used for no other purpose.

**Host permission — https://openrouter.ai/\***
> Required to send optional AI suggestion requests to the OpenRouter API using
> the user's own API key. This is the only external host the extension ever
> contacts, and requests are only made when the user has enabled AI features
> and accepted the in-product data-sharing disclosure.

## Data-practices disclosures

Tick exactly these, and no others:

- [x] **Personally identifiable information** — no
- [x] **Health information** — no
- [x] **Financial and payment information** — no
- [x] **Authentication information** — **YES** (the user's OpenRouter API key
      is stored locally)
- [x] **Personal communications** — no
- [x] **Location** — no
- [x] **Web history** — **YES** (URLs and titles of pages the user chooses to
      save; sent to OpenRouter only when AI features are enabled)
- [x] **User activity** — no
- [x] **Website content** — **YES** (page description and up to 500 characters
      of text, sent to OpenRouter only when AI features are enabled)

Then affirm all three certifications:

- Not being sold to third parties, outside of approved use cases
- Not being used or transferred for purposes unrelated to the item's single purpose
- Not being used or transferred to determine creditworthiness or for lending purposes

## Test instructions for reviewers

The Test Instructions field is not optional for this extension — it is inert
without an API key, and "functionality not working" is the most common
rejection for bring-your-own-key extensions.

> The core bookmark features (save, organise, search, import, export) work
> immediately with no configuration — open a new tab to see the library, or
> click the toolbar icon on any page to save it.
>
> The optional AI features require an OpenRouter API key. To review them:
> 1. Open the extension's Settings page.
> 2. Under "Privacy & data sharing", click "I understand — enable AI features".
> 3. Paste this test key: TODO_INSERT_REVIEWER_TEST_KEY
> 4. Enable one or more toggles under "AI features".
> 5. Save any page via the toolbar button to see suggested tags/title/collection,
>    or open a new tab and click "✦ Resort" to see the bulk reorganisation
>    preview.
>
> Note that AI features are deliberately disabled until step 2 is completed;
> this is the affirmative consent gate. No network request is made to
> OpenRouter before consent is recorded.

**Before submitting:** create a *dedicated* OpenRouter key for review with a low
spending cap, and revoke it after the extension is approved.

## Graphic assets checklist

| Asset | Spec | Status |
| --- | --- | --- |
| Store icon | 128×128 PNG | have `icons/icon-128.png` — verify it renders on both light and dark store backgrounds |
| Screenshots | 1280×800, 1–5 | TODO — suggest: library grid, Resort preview, settings/consent, search |
| Small promo tile | 440×280 | TODO |
| Marquee promo tile | 1400×560 | optional |

## Hosting the privacy policy

The policy must be at a stable public URL. Cheapest options:

1. **GitHub Pages** — push this repo (or a docs-only repo) to GitHub, enable
   Pages, and link to the rendered `PRIVACY.md`.
2. **A GitHub Gist** — fastest, but a less stable-looking URL.
3. Any static host you already own.

Whichever you choose, the URL must stay live for as long as the extension is
published; a dead policy URL is grounds for removal.

## Pre-submission checklist

- [ ] Privacy policy live at a public URL, and that URL entered in the dashboard
- [ ] Reviewer test key created (low spending cap) and pasted into Test Instructions
- [ ] Screenshots and promo tile produced
- [ ] Developer account: 2-Step Verification enabled
- [ ] Trader / Non-Trader declaration completed
- [ ] `version` bumped in `src/manifest.json`
- [ ] Built with `npm run build`, then zip the **contents** of `dist/` so
      `manifest.json` sits at the zip root — not the `dist` folder itself
- [ ] Manually smoke-tested the packed build in both Chrome and Brave

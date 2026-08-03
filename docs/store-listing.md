# Store submission

Everything the Chrome Web Store dashboard asks for, plus the extra steps
addons.mozilla.org needs. Most of it — the description, the permission
justifications, the privacy answers — is the same text for both.

Everything below applies to both stores unless a section says otherwise.
Paste-ready text for the two longest fields lives alongside this file:

- [`STORE-LISTING.txt`](STORE-LISTING.txt) — the item description
- [`STORE-PERMISSIONS.txt`](STORE-PERMISSIONS.txt) — every permission
  justification and the remote-code answer, each inside the 1000-char limit

Build the uploads and the images with:

    npm run package        # release/midnight-markers-<version>-{chrome,firefox,source}.zip
    npm run store-assets   # release/store/*.png

Both stores take a **zip**. Google signs the crx and Mozilla signs the xpi on
their own side, so you never upload a signed package. Crx is only for
self-hosted or enterprise-deployed extensions.

## Listing basics

- **Name:** Midnight Markers (from the manifest)
- **Category:** Productivity
- **Language:** English (United States)
- **Support email:** lee.delarm@gmail.com — must be verified in the dashboard
- **Homepage URL:** <https://organiccat.github.io/midnight-markers/>
- **Privacy policy URL:** <https://organiccat.github.io/midnight-markers/privacy/>

Official URL can stay "None" — that dropdown wants a domain verified in
Google Search Console, and the Homepage URL field covers it.

### Short description (132 char limit)

Taken from the manifest `description`, currently:

> A dark, polished bookmark library for Brave and Chrome.

An alternative that uses more of the budget, if you want the AI angle in the
summary (123 characters):

> A dark, polished bookmark library for Chrome and Brave, with optional
> AI-assisted tagging and filing using your own API key.

### Single purpose

Paste verbatim:

> Midnight Markers is a bookmark manager: it saves web pages to a local
> library and helps you organise them into collections and tags, including
> optional AI-assisted suggestions for how to tag and file them.

Deliberately one sentence describing one capability. Do not reword it as "a
bookmark manager **and** an AI assistant" — two purposes invites a
single-purpose rejection and undermines the Limited Use justification for
sending page content off-device.

## Test instructions for reviewers

**Do not skip this field.** The extension is inert without an API key, and
"functionality not working" is the most common rejection for
bring-your-own-key extensions.

> The core bookmark features (save, organise, search, import, export) work
> immediately with no configuration — open a new tab to see the library, or
> click the toolbar icon on any page to save it.
>
> The optional AI features require an OpenRouter or Anthropic API key. To
> review them:
> 1. Open the extension's Settings page.
> 2. Under "Privacy & data sharing", click "I understand — enable AI features".
> 3. Paste this test key: TODO_INSERT_REVIEWER_TEST_KEY
> 4. Enable one or more toggles under "AI features".
> 5. Save any page via the toolbar button to see suggested tags/title/collection,
>    or open a new tab and click "✦ Resort" to see the bulk reorganisation
>    preview.
>
> Note that AI features are deliberately disabled until step 2 is completed;
> this is the affirmative consent gate. No network request is made to either
> provider before consent is recorded.

**Before submitting:** create a *dedicated* key for review with a low
spending cap, and revoke it once the extension is approved.

## Permission justifications

Full text in [`STORE-PERMISSIONS.txt`](STORE-PERMISSIONS.txt). What each
permission is actually for:

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

## Data disclosures

This trips people up. "Local-only" is a true statement about this extension,
but it is not an exemption from the form. Per the
[user data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq):

> Extensions are required to disclose how they handle user data, even when
> data is processed or stored locally on a user's device and is not
> transmitted to external servers or third parties.

and "handle" means "collecting, transmitting, using, or sharing user data".
So three categories get ticked even though the developer receives nothing,
there is no backend, and there is no analytics.

Ticking them does not put "sends your browsing to the developer" on the
listing. The public page shows the categories alongside the certifications
below; the privacy policy explains that the data stays on the device.

Tick exactly these three:

- **Authentication information** — the user's OpenRouter and/or Anthropic API
  key, stored encrypted on their device and sent only to the provider it
  belongs to.
- **Web history** — the form defines this as "the list of web pages a user
  has visited, as well as associated data such as page title and time of
  visit", which describes a bookmark library exactly. The optional import
  also reads the browser's existing bookmark tree.
- **Website content** — page title, meta description, a text excerpt and a
  thumbnail of saved pages.

Leave these unticked:

- **Personally identifiable information** — no name, address, email, age or ID.
- **Health information** — none.
- **Financial and payment information** — none.
- **Personal communications** — no emails, texts or chat messages.
- **Location** — none. A provider sees an IP address when a request is made,
  but that is their server log, not something this extension collects.
- **User activity** — no click, scroll, mouse-position or keystroke logging,
  and no network monitoring. Keyboard shortcuts are not keylogging.

Then affirm all three certifications, each of which is truthful:

- Not being sold to third parties, outside of approved use cases
- Not being used or transferred for purposes unrelated to the item's single purpose
- Not being used or transferred to determine creditworthiness or for lending purposes

**Remote code: No.** Everything executable ships inside the zip; the
Anthropic SDK is bundled at build time, not fetched at runtime. Justification
text is in `STORE-PERMISSIONS.txt`.

## What is sent off the device, precisely

Worth having to hand if a reviewer asks. AI requests are gated by
`canUseAI()` in `src/lib/ai/consent.ts`, the single chokepoint every outbound
request passes through. It returns false unless all of these hold:

1. the user accepted the in-product data-sharing disclosure (`aiConsentAt`),
2. an API key exists for the currently selected provider, and
3. at least one AI feature is switched on.

When it does fire, the request contains only: the page title, its URL, its
meta description, a content excerpt capped at 500 characters, and the names
of the user's existing tags and collections. No browsing history, no other
bookmarks, no identifiers.

## Graphic assets

All generated by `npm run store-assets` into `release/store/`.

| Asset | Spec | File |
|---|---|---|
| Store icon | 128x128, 96x96 art + transparent padding | `store-icon-128.png` |
| Screenshots | 1280x800, 1–5, no alpha | `screenshot-1..4-*.png` |
| Small promo tile | 440x280, no alpha | `promo-tile-440x280.png` |
| Marquee promo tile | 1400x560, no alpha | `marquee-promo-1400x560.png` |

The store icon is **not** the icon in the zip. The image guidelines require
96x96 artwork centred in a 128x128 canvas with the surrounding 16px
transparent; the in-manifest icon is full-bleed, which is correct for the
toolbar and wrong for the listing. Tiles and screenshots must be JPEG or
24-bit PNG with no alpha, so the script flattens them and asserts the alpha
state of every asset.

## Developer account

- **Trader/Non-Trader declaration** — mandatory for every developer since the
  EU began requiring marketplaces to identify traders. You must self-declare;
  Google will not decide for you. See the
  [trader disclosure policy](https://developer.chrome.com/docs/webstore/program-policies/trader-disclosure).
  A free, non-commercial extension published by an individual is normally
  non-trader, but the determination is yours to make.
- **2-Step Verification** must be enabled on the account.

## Firefox (addons.mozilla.org)

The listing text, permission justifications and privacy answers above are all
reusable. These are the parts AMO handles differently.

### What the Firefox build changes

`npm run package` produces the Firefox zip from the same source, with three
manifest differences resolved from the `{{firefox}}.`-prefixed keys in
`src/manifest.json`:

- **Background.** Firefox has never shipped extension service workers
  ([bug 1573659](https://bugzilla.mozilla.org/show_bug.cgi?id=1573659)), so the
  Firefox build declares `background.scripts` — an event page — where the
  Chrome build declares `background.service_worker`. Same file, same code.
- **Add-on ID.** `browser_specific_settings.gecko.id` is
  `midnight-markers@organiccat.github.io`. AMO requires a stable ID to publish
  under, and it must never change once the first version is accepted.
- **Minimum version.** `strict_min_version` is `140.0`, which is what the data
  collection key below requires.

The extension code calls `browser.*` when it exists and falls back to
`chrome.*` (see `src/lib/ext.ts`). Firefox's `chrome.*` namespace is a
callback-based porting shim, so awaiting it would silently yield `undefined`.

### Data collection permissions

Since 3 November 2025, every new Firefox extension must declare what personal
data it collects in the manifest. Midnight Markers declares:

    "data_collection_permissions": {
      "required": ["none"],
      "optional": ["websiteContent", "bookmarksInfo"]
    }

`required: ["none"]` is accurate because the extension transmits nothing as
part of its basic function — bookmarks live in local IndexedDB. The optional
entries cover the AI features, which are off by default and send page content
and the user's tag and collection names to the provider the user chose, using
the user's own API key. This matches [`PRIVACY.md`](../PRIVACY.md); if one
changes, change the other.

### Source code submission

AMO requires the original source for any extension built with a bundler, and
will reject a submission without it. `npm run package` writes
`release/midnight-markers-<version>-source.zip` from `git archive HEAD` for
exactly this. Paste these build instructions into the source code field:

    Environment: Linux or macOS, Node.js 24.x, npm 11.x
    Build:
      npm ci
      npm run package firefox
    Output: dist-firefox/ — the contents of the submitted zip.

Note that the source archive contains only committed files, so commit before
packaging or the reviewer's rebuild will not match.

### Before uploading

Run AMO's own validator against the built extension:

    npx web-ext lint --source-dir dist-firefox

It should report zero errors. Two warnings are expected and do not block
review: an `innerHTML` assignment inside the bundled Svelte runtime, and a
note that the Android minimum version predates the data collection key —
this extension replaces the new tab page and is not aimed at Firefox for
Android.

### Host permissions

Since Firefox 127, host permissions listed in the manifest are shown in the
install prompt and granted on installation, as they are in Chrome. Users can
still revoke them afterwards, so the AI code paths need to fail gracefully
when a request is blocked — which is the same handling they already have for
an invalid key or a network error.

## Pre-submission checklist

- [x] Privacy policy live at a public URL, and that URL entered in the dashboard
- [x] Screenshots, promo tile and marquee tile produced
- [x] Store icon generated with the padding the guidelines require
- [x] `version` in `src/manifest.json` matches `package.json`
- [x] Packaged with `npm run package`, which zips the **contents** of each
      build directory so `manifest.json` sits at the zip root — not the folder
      itself
- [ ] Reviewer test key created (low spending cap) and pasted into Test Instructions
- [ ] Developer account: 2-Step Verification enabled
- [ ] Trader / Non-Trader declaration completed
- [ ] Extract each zip to a clean folder and load *that* as an unpacked
      extension in Chrome, Brave and Firefox — this tests the exact bytes being
      uploaded, which a working build directory does not
- [ ] `npx web-ext lint --source-dir dist-firefox` reports zero errors
- [ ] Everything committed before packaging, so the AMO source archive matches
- [ ] AMO: source zip uploaded with the build instructions above

Expect review to take anywhere from a few hours to a couple of weeks. The
`bookmarks` permission and the AI host permissions are the parts most likely
to draw a manual look, which is what the justifications are for.

---
title: Privacy Policy
permalink: /privacy/
---

# Privacy Policy — Midnight Markers

**Last updated: 20 July 2026**

Midnight Markers is a bookmark manager browser extension. This policy explains
exactly what data it handles, where that data goes, and what it never does.

## Short version

Your bookmarks stay on your own device. The only time anything leaves it is
when *you* turn on the optional AI features, and then only the specific fields
listed below, sent directly to your chosen AI provider using *your own* API
key. The
developer of Midnight Markers operates no servers and never receives your data.

## Who we are

Midnight Markers is a free browser extension. There is no company, no backend
service, and no analytics.

Contact: **lee.delarm@gmail.com**

## What is stored on your device

All of the following is stored locally in your browser's IndexedDB storage and
is never transmitted anywhere by this extension:

- Bookmarks you save: URL, page title, domain, meta description, a content
  excerpt (up to 500 characters), a thumbnail image, notes, and read/starred
  status.
- Collections (folders) and tags you create.
- Your preferences: theme scale, default view, chosen AI model.
- Your OpenRouter and/or Anthropic API key, if you choose to provide one.

If you use the "Import browser bookmarks" feature, the extension reads your
browser's existing bookmark tree to copy it into its own local library. That
data is read locally and is not transmitted.

## What is sent off your device, and when

**Nothing is transmitted unless you explicitly enable AI features.** They are
switched off by default. Enabling them requires you to read an in-product
disclosure and take an affirmative action to accept it. You may withdraw that
consent at any time in Settings, which immediately disables all AI features.

When AI features are enabled, the following is sent to **the AI provider you
have selected** each time you save a page or run the Resort feature:

- the page **title** and **URL**
- the page's **meta description** and up to **500 characters** of page text
- the **names of your existing tags and collections**, so suggestions can reuse
  them rather than inventing duplicates

You choose the provider in Settings. Exactly one is active at a time, and the
in-product disclosure names the active one. The two supported providers are:

| Provider | Endpoint | Privacy policy |
|---|---|---|
| OpenRouter | `https://openrouter.ai` | <https://openrouter.ai/privacy> |
| Anthropic | `https://api.anthropic.com` | <https://www.anthropic.com/legal/privacy> |

This is sent directly from your browser to that provider, authenticated with
the API key you supplied, and billed to your own account with them. It does not
pass through any server operated by the developer. Their handling of this data
is governed by their own privacy policy, linked above.

No other destination ever receives your data. The extension declares host
permissions for `https://openrouter.ai/*` and `https://api.anthropic.com/*` and
no other host, so the browser itself blocks requests elsewhere. Data is only
ever sent to the provider you have selected — selecting one does not send
anything to the other.

## How your API key is protected

Each API key you save is encrypted at rest using AES-256-GCM, in its own
separate envelope. Keys for both providers may be stored at once so that
switching between them does not require re-entering a key; only the active
provider's key is ever transmitted. The encryption
key is generated inside your browser as a **non-extractable** WebCrypto key:
the raw key material is held by the browser and cannot be read back out by
JavaScript, including by this extension's own code, by browser developer tools,
or by any other extension.

**Honest limitation:** a browser extension has no access to an operating-system
keystore. This protects the key against extraction from extension storage, but
it does not protect against an attacker who has full read access to your
browser profile directory on disk, or who controls your machine. We state this
plainly rather than implying stronger protection than exists.

The API key is additionally:

- transmitted only over HTTPS, and only to the provider it belongs to — the
  OpenRouter key only to openrouter.ai (in an `Authorization` header), the
  Anthropic key only to api.anthropic.com (in an `x-api-key` header);
- never written to logs or diagnostic output;
- excluded from the extension's export/backup file, so sharing a backup cannot
  leak it;
- deletable at any time from Settings.

## What we never do

- We do not collect, transmit, or sell your personal information.
- We do not use analytics, telemetry, tracking pixels, or advertising.
- We do not operate a server that receives your data.
- We do not read pages in the background. Page content is read only from the
  tab you are actively on, at the moment you click the extension's toolbar
  button.
- We do not transfer user data to third parties except the AI provider you have
  selected, as described above, and only when you have enabled AI features.
- We do not use your data to train any model. (Whether your selected provider
  does so is governed by their policies and your account settings with them.)

## Limited Use disclosure

Midnight Markers' use of information received from Google APIs and from the
Chrome Web Store adheres to the
[Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq),
including the Limited Use requirements. Data is used solely to provide the
single user-facing purpose described in the store listing — saving and
organising bookmarks, including optional AI-assisted tagging and filing — and
is not used or transferred for any other purpose.

## Changes to data practices

If a future version changes what data is collected or where it is sent, the
extension will surface a notice in-product and require renewed consent before
the new behaviour takes effect.

## Your control

- AI features: off by default; opt in and opt out at any time in Settings.
- Export: download your entire library as JSON at any time.
- Deletion: uninstalling the extension removes all locally stored data. You can
  also delete the API key alone from Settings.

## A note on direct browser access

Requests to Anthropic are made from the extension itself using the Anthropic
SDK's `dangerouslyAllowBrowser` option. That option carries a blunt name
because the usual reason to send API requests from a browser is a public web
page, where the key would be exposed to every visitor. That is not the case
here: the key is your own, you entered it yourself, it is sealed in your own
browser profile, and it is sent only to Anthropic. A browser extension has no
server to proxy through, which is the same reason the OpenRouter path has
always called the API directly too.

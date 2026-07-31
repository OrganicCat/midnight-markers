---
title: Midnight Markers
---

# Midnight Markers

A bookmark manager for Brave and Chrome that replaces your new tab page with a
searchable library of the pages you've saved. Dark by default, local by
default, and it works fine without ever touching an AI provider.

## What it does

- **Your new tab is the library.** Card grid or a dense tree-structured list,
  organised into collections and tags.
- **One-tap save** from the toolbar, with a star, tags, and a collection
  picker.
- **Search that keeps up**, plus keyboard navigation throughout — ⌘K to
  search, J/K to move, ↵ to open, S to star.
- **Import your existing bookmarks** in one click. Folder names become
  collections.
- **Optional AI suggestions** for titles, tags, and filing, using your own
  OpenRouter or Anthropic key. Off until you turn it on.
- **Daily broken-link checking** in the background.
- **JSON export and import**, so your library is yours to take elsewhere.

## Where your data goes

Nowhere, unless you ask it to. Bookmarks live in your browser's own IndexedDB
storage. There's no account, no server, and no analytics — the developer
operates no backend and never receives your data.

The one exception is the optional AI features. Turn those on and the page
title, URL, meta description, and a 500-character excerpt go directly from
your browser to the provider you picked, using your own API key. Nothing else
is sent, and nothing is sent at all until you accept an in-product disclosure.

Full details in the [privacy policy](./privacy/).

## Install

Not on the Chrome Web Store yet — the listing is in review. In the meantime
you can build it yourself:

```
git clone https://github.com/OrganicCat/midnight-markers
cd midnight-markers
npm install
npm run build
```

Then open Brave or Chrome → Extensions → enable Developer mode → Load unpacked
→ pick the `dist/` folder.

## Source

[github.com/OrganicCat/midnight-markers](https://github.com/OrganicCat/midnight-markers)

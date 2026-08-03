# midnight-markers

A dark, polished bookmark extension for Brave & Chrome — Raindrop-flavored, midnight-themed, AI-optional.

Site: <https://organiccat.github.io/midnight-markers/> ·
Privacy policy: <https://organiccat.github.io/midnight-markers/privacy/>

## Features

- **New tab page** as your bookmark library: card grid (default) or dense list.
- **Toolbar popup** for one-tap save with star, tags, collection, AI suggestions.
- **AI suggestions** via OpenRouter or Anthropic (BYOK): friendlier title, tag picks, collection routing.
- **Native bookmarks import** in one click (folder names → collections).
- **JSON export/import** for portable backups.
- **Broken-link checker** runs daily in the background.
- **Drag-and-drop** bookmarks into collections.
- **Keyboard-first**: ⌘K search · J/K or ↑/↓ navigate · ↵ open · S star · ⌫ delete · 1/2 grid/list · ? help.
- **Guided tour** on first run, replayable any time from the ? button in the toolbar.
- **Local-only** storage (IndexedDB). No account, no cloud, no telemetry.

## Dev

    npm install
    npm run dev          # vite dev mode
    npm run build        # outputs dist/ — load as unpacked extension
    npm run build:firefox # outputs dist-firefox/ — the Firefox build
    npm test             # unit suite
    npm run test:e2e     # playwright smoke
    npm run check        # svelte-check
    npm run package      # store-ready zips (both browsers) in release/
    npm run store-assets # promo tile + screenshots in release/store/

## Loading the unpacked extension

1. `npm run build` (or `npm run build:firefox`)
2. Brave/Chrome → Extensions → enable Developer mode → Load unpacked → pick `dist/`.
   Firefox → `about:debugging` → This Firefox → Load Temporary Add-on → pick
   `dist-firefox/manifest.json`.
3. Right-click the toolbar icon → Options to pick a provider and add an OpenRouter or Anthropic API key (optional, enables AI).

## Publishing

`npm run package` produces two release builds with sourcemaps stripped:

- `release/midnight-markers-<version>-chrome.zip` for the Chrome Web Store
- `release/midnight-markers-<version>-firefox.zip` for addons.mozilla.org

Each is checked before its zip is written for the things that get an upload
rejected — manifest at the archive root, no underscore-prefixed paths, no
filenames Windows can't handle, and the right background entry point for the
browser in question. Add `chrome` or `firefox` as an argument to build just
one.

Both stores take a zip and sign the package themselves; you never upload a
crx or a signed xpi. Before submitting to AMO it's worth running
`npx web-ext lint --source-dir dist-firefox`, which is the same validator the
AMO upload runs. See [`docs/store-listing.md`](docs/store-listing.md) for
the permission justifications and privacy answers the dashboard asks for.

## Docs

- Design: [`docs/superpowers/specs/2026-05-03-midnight-markers-design.md`](docs/superpowers/specs/2026-05-03-midnight-markers-design.md)
- Plans: [`docs/superpowers/plans/`](docs/superpowers/plans/)

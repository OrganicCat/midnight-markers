# midnight-markers

A dark, polished bookmark extension for Brave & Chrome — Raindrop-flavored, midnight-themed, AI-optional.

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
    npm test             # unit suite
    npm run test:e2e     # playwright smoke
    npm run check        # svelte-check
    npm run package      # store-ready zip in release/
    npm run store-assets # promo tile + screenshots in release/store/

## Loading the unpacked extension

1. `npm run build`
2. Brave/Chrome → Extensions → enable Developer mode → Load unpacked → pick `dist/`.
3. Right-click the toolbar icon → Options to pick a provider and add an OpenRouter or Anthropic API key (optional, enables AI).

## Publishing

`npm run package` produces `release/midnight-markers-<version>.zip` — a
release build with sourcemaps stripped, checked for the things that get an
upload rejected (manifest at the archive root, no underscore-prefixed paths,
no filenames Windows can't handle) before the zip is written.

The Chrome Web Store takes that zip and signs the crx itself; you never
upload a crx. See [`docs/STORE-SUBMISSION.md`](docs/STORE-SUBMISSION.md) for
the permission justifications and privacy answers the dashboard asks for.

## Docs

- Design: [`docs/superpowers/specs/2026-05-03-midnight-markers-design.md`](docs/superpowers/specs/2026-05-03-midnight-markers-design.md)
- Plans: [`docs/superpowers/plans/`](docs/superpowers/plans/)

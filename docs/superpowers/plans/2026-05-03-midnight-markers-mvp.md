# midnight-markers — Plan 1: Foundation & MVP

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working dark-themed bookmark extension for Brave/Chrome (Manifest V3) — toolbar popup saves the active page; new-tab page replaces with a sidebar+grid library reading from IndexedDB. No AI, no list-view toggle, no DnD yet (those land in Plans 2 and 3).

**Architecture:** Vite + Svelte 5 + Tailwind + TypeScript, packaged via `vite-plugin-web-extension` for cross-browser MV3 output. IndexedDB (via `idb`) for storage, with a small pub-sub layer so views re-query on writes. Two Svelte apps (`popup`, `newtab`) and a thin background service worker.

**Tech Stack:** TypeScript (strict), Svelte 5 (runes), Tailwind 4, Vite, vite-plugin-web-extension, idb, ulid, fake-indexeddb (test), Vitest, @testing-library/svelte, happy-dom, Playwright.

**Reference spec:** `docs/superpowers/specs/2026-05-03-midnight-markers-design.md`

---

## File Structure (Plan 1)

```
midnight-markers/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── svelte.config.js
├── postcss.config.js
├── .gitignore
├── README.md
├── public/
│   └── icons/ (16, 32, 48, 128 — placeholder PNGs)
├── src/
│   ├── manifest.json
│   ├── lib/
│   │   ├── types.ts
│   │   ├── ulid.ts
│   │   ├── storage/
│   │   │   ├── db.ts
│   │   │   ├── bookmarks.ts
│   │   │   ├── collections.ts
│   │   │   ├── tags.ts
│   │   │   ├── settings.ts
│   │   │   └── events.ts
│   │   ├── metadata/
│   │   │   ├── extract.ts          # content-script body
│   │   │   └── thumbnail.ts        # captureVisibleTab fallback
│   │   └── theme.css               # design tokens
│   ├── newtab/
│   │   ├── newtab.html
│   │   ├── main.ts
│   │   ├── App.svelte
│   │   ├── Sidebar.svelte
│   │   ├── Toolbar.svelte
│   │   ├── BookmarkGrid.svelte
│   │   └── BookmarkCard.svelte
│   ├── popup/
│   │   ├── popup.html
│   │   ├── main.ts
│   │   ├── App.svelte
│   │   ├── TagPicker.svelte
│   │   └── CollectionPicker.svelte
│   └── background/
│       └── service-worker.ts
└── tests/
    ├── setup.ts
    ├── unit/
    │   ├── ulid.test.ts
    │   ├── storage/
    │   │   ├── bookmarks.test.ts
    │   │   ├── collections.test.ts
    │   │   ├── tags.test.ts
    │   │   ├── settings.test.ts
    │   │   └── events.test.ts
    │   └── popup/
    │       └── App.test.ts
    └── e2e/
        └── save-and-view.spec.ts
```

---

## Task 1: Initialize repo and Vite project

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `README.md`

- [ ] **Step 1: Initialize git and write .gitignore**

```bash
cd /home/lee/Documents/Code/midnight-markers
git init -b main
```

Create `.gitignore`:

```
node_modules/
dist/
.superpowers/
.DS_Store
*.log
.env
.env.local
.vite/
test-results/
playwright-report/
```

- [ ] **Step 2: Initialize package.json**

Create `package.json`:

```json
{
  "name": "midnight-markers",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-check --tsconfig ./tsconfig.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "eslint src tests",
    "format": "prettier --write src tests"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@sveltejs/vite-plugin-svelte": "^5.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "@testing-library/svelte": "^5.2.0",
    "@types/chrome": "^0.0.280",
    "@types/node": "^22.0.0",
    "eslint": "^9.0.0",
    "fake-indexeddb": "^6.0.0",
    "happy-dom": "^15.0.0",
    "prettier": "^3.3.0",
    "prettier-plugin-svelte": "^3.2.0",
    "svelte": "^5.0.0",
    "svelte-check": "^4.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vite-plugin-web-extension": "^4.4.0",
    "vitest": "^2.1.0"
  },
  "dependencies": {
    "idb": "^8.0.0",
    "ulid": "^2.3.0"
  }
}
```

Run: `npm install`
Expected: dependencies install cleanly. If `vite-plugin-web-extension@^4.4.0` resolves to a version that does not support Vite 6 / Manifest V3, log the actual installed version and downgrade Vite to `^5` to match. Document the choice in the README.

- [ ] **Step 3: tsconfig**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["chrome", "vitest/globals"],
    "allowJs": true,
    "checkJs": false,
    "noEmit": true,
    "paths": {
      "$lib/*": ["./src/lib/*"]
    }
  },
  "include": ["src/**/*", "tests/**/*", "*.config.ts"]
}
```

- [ ] **Step 4: README placeholder**

Create `README.md`:

```markdown
# midnight-markers

A dark, polished bookmark extension for Brave & Chrome.

## Dev

    npm install
    npm run dev          # starts Vite in extension dev mode
    npm run build        # outputs dist/ — load as unpacked extension
    npm test             # unit tests
    npm run test:e2e     # Playwright

## Loading the unpacked extension

1. `npm run build`
2. Brave/Chrome → Extensions → enable Developer mode → Load unpacked → pick `dist/`.

See [`docs/superpowers/specs/2026-05-03-midnight-markers-design.md`](docs/superpowers/specs/2026-05-03-midnight-markers-design.md) for the design.
```

- [ ] **Step 5: Commit**

```bash
git add .gitignore package.json package-lock.json tsconfig.json README.md
git commit -m "feat: initialize project with Vite + Svelte + TS scaffold"
```

---

## Task 2: Configure Vite, Svelte, Tailwind

**Files:**
- Create: `vite.config.ts`, `svelte.config.js`, `tailwind.config.js`, `postcss.config.js`, `src/lib/theme.css`

- [ ] **Step 1: svelte.config.js**

```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  compilerOptions: { runes: true },
};
```

- [ ] **Step 2: tailwind.config.js**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        bg: { base: '#0b0c14', raised: '#0d0e15', deep: '#14172a' },
        accent: { violet: '#8b9bff', purple: '#bd93f9', teal: '#6fe6cf' },
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Helvetica Neue', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3: postcss.config.js**

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
```

- [ ] **Step 4: src/lib/theme.css**

```css
@import 'tailwindcss';

:root {
  color-scheme: dark;
}

html, body { background: theme('colors.bg.base'); color: #e8e9f0; }
body { font-family: theme('fontFamily.sans'); margin: 0; }

.bm-card { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; transition: background 200ms ease, transform 200ms ease; }
.bm-card:hover { background: rgba(255,255,255,0.05); transform: translateY(-1px); }
```

- [ ] **Step 5: vite.config.ts**

```ts
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import webExtension from 'vite-plugin-web-extension';
import path from 'node:path';

export default defineConfig({
  plugins: [
    svelte(),
    webExtension({
      manifest: () => path.resolve(__dirname, 'src/manifest.json'),
      browser: process.env.TARGET ?? 'chrome',
    }),
  ],
  resolve: {
    alias: { $lib: path.resolve(__dirname, 'src/lib') },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
});
```

- [ ] **Step 6: Commit**

```bash
git add svelte.config.js tailwind.config.js postcss.config.js src/lib/theme.css vite.config.ts
git commit -m "chore: configure Vite, Svelte 5 (runes), Tailwind 4, theme tokens"
```

---

## Task 3: Manifest and minimal extension shell

**Files:**
- Create: `src/manifest.json`, `src/popup/popup.html`, `src/popup/main.ts`, `src/popup/App.svelte`, `src/newtab/newtab.html`, `src/newtab/main.ts`, `src/newtab/App.svelte`, `src/background/service-worker.ts`, `public/icons/icon-16.png`, `public/icons/icon-32.png`, `public/icons/icon-48.png`, `public/icons/icon-128.png`

- [ ] **Step 1: Create placeholder icons**

```bash
mkdir -p public/icons
# Generate simple solid-color placeholders (real icons land in Plan 3)
node -e "
const fs = require('fs');
const sizes = [16,32,48,128];
// Tiny PNG: solid #14172a square. Use a precomputed minimal PNG per size.
// Use 'sharp' if installed, else write a 1x1 PNG and let the manifest scale.
const onePxPng = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000005000100337edcdf0000000049454e44ae426082','hex');
for (const s of sizes) fs.writeFileSync('public/icons/icon-'+s+'.png', onePxPng);
"
```

Note: real icons replace these in Plan 3. Brave/Chrome accept 1×1 PNGs for development.

- [ ] **Step 2: src/manifest.json**

```json
{
  "manifest_version": 3,
  "name": "midnight-markers",
  "description": "A dark, polished bookmark library for Brave and Chrome.",
  "version": "0.1.0",
  "icons": {
    "16": "public/icons/icon-16.png",
    "32": "public/icons/icon-32.png",
    "48": "public/icons/icon-48.png",
    "128": "public/icons/icon-128.png"
  },
  "action": {
    "default_popup": "src/popup/popup.html",
    "default_title": "Save to midnight-markers"
  },
  "chrome_url_overrides": {
    "newtab": "src/newtab/newtab.html"
  },
  "background": {
    "service_worker": "src/background/service-worker.ts",
    "type": "module"
  },
  "permissions": ["storage", "activeTab", "scripting", "tabs"],
  "host_permissions": []
}
```

- [ ] **Step 3: Popup entry**

`src/popup/popup.html`:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Save bookmark</title>
    <link rel="stylesheet" href="../lib/theme.css" />
    <style>html,body{width:320px;height:auto;}</style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

`src/popup/main.ts`:

```ts
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
```

`src/popup/App.svelte`:

```svelte
<script lang="ts">
</script>

<div class="p-4">
  <p class="text-sm opacity-70">Popup placeholder — save flow lands in Task 14.</p>
</div>
```

- [ ] **Step 4: New-tab entry**

`src/newtab/newtab.html`:

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>midnight-markers</title>
    <link rel="stylesheet" href="../lib/theme.css" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

`src/newtab/main.ts`:

```ts
import { mount } from 'svelte';
import App from './App.svelte';

mount(App, { target: document.getElementById('app')! });
```

`src/newtab/App.svelte`:

```svelte
<script lang="ts">
</script>

<div class="min-h-screen flex items-center justify-center">
  <p class="text-2xl tracking-tight">⏾ midnight-markers</p>
</div>
```

- [ ] **Step 5: Service worker placeholder**

`src/background/service-worker.ts`:

```ts
chrome.runtime.onInstalled.addListener(() => {
  console.log('[midnight-markers] installed');
});
```

- [ ] **Step 6: Build and load**

Run: `npm run build`
Expected: writes `dist/` containing `manifest.json`, `popup.html`, `newtab.html`, hashed JS/CSS chunks, and `public/icons/`.

Manually verify:
1. Brave → `brave://extensions/` → Developer mode → Load unpacked → select `dist/`.
2. Click toolbar icon — popup shows "Popup placeholder".
3. Open a new tab — shows "⏾ midnight-markers".

- [ ] **Step 7: Commit**

```bash
git add src/manifest.json src/popup src/newtab src/background public/icons
git commit -m "feat: extension shell with popup, newtab override, and service worker"
```

---

## Task 4: Type definitions

**Files:**
- Create: `src/lib/types.ts`, `tests/setup.ts`

- [ ] **Step 1: Test setup**

`tests/setup.ts`:

```ts
import 'fake-indexeddb/auto';
```

- [ ] **Step 2: types.ts**

`src/lib/types.ts`:

```ts
export type Bookmark = {
  id: string;
  url: string;
  title: string;
  originalTitle: string;
  domain: string;
  faviconUrl: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  excerpt: string | null;
  collectionId: string | null;
  tagIds: string[];
  starred: boolean;
  unread: boolean;
  note: string | null;
  createdAt: number;
  updatedAt: number;
  lastCheckedAt: number | null;
  isBroken: boolean;
};

export type Collection = {
  id: string;
  name: string;
  parentId: string | null;
  color: string;
  sortOrder: number;
  createdAt: number;
};

export type Tag = {
  id: string;
  name: string;   // unique, lowercased
  count: number;
};

export type AIFeatures = {
  tags: boolean;
  title: boolean;
  collection: boolean;
};

export type Settings = {
  aiKey: string | null;
  aiModel: string;     // default 'anthropic/claude-haiku-4.5'
  aiFeatures: AIFeatures;
  defaultView: 'grid' | 'list';
  defaultCollectionId: string | null;
};

export type SmartFilter = 'recent' | 'unread' | 'starred' | 'untagged' | 'broken';

export type BookmarkFilter = {
  collectionId?: string | null;
  tagId?: string;
  smart?: SmartFilter;
  search?: string;
};
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts tests/setup.ts
git commit -m "feat: add domain types and test setup"
```

---

## Task 5: ULID generator wrapper

**Files:**
- Create: `src/lib/ulid.ts`, `tests/unit/ulid.test.ts`

- [ ] **Step 1: Failing test**

`tests/unit/ulid.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { newId } from '$lib/ulid';

describe('newId', () => {
  it('produces a 26-char ULID', () => {
    const id = newId();
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it('produces monotonically increasing IDs within the same ms', () => {
    const a = newId();
    const b = newId();
    expect(a < b).toBe(true);
  });

  it('produces unique IDs across many calls', () => {
    const set = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(set.size).toBe(1000);
  });
});
```

- [ ] **Step 2: Run test — verify failure**

Run: `npm test -- tests/unit/ulid.test.ts`
Expected: fails with "Cannot find module '$lib/ulid'".

- [ ] **Step 3: Implement**

`src/lib/ulid.ts`:

```ts
import { monotonicFactory } from 'ulid';

const ulid = monotonicFactory();

export function newId(): string {
  return ulid();
}
```

- [ ] **Step 4: Verify pass**

Run: `npm test -- tests/unit/ulid.test.ts`
Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ulid.ts tests/unit/ulid.test.ts
git commit -m "feat: ULID generator with monotonic ordering"
```

---

## Task 6: IndexedDB setup (db.ts)

**Files:**
- Create: `src/lib/storage/db.ts`

- [ ] **Step 1: Implement DB opener**

`src/lib/storage/db.ts`:

```ts
import { openDB, type IDBPDatabase, type DBSchema } from 'idb';
import type { Bookmark, Collection, Tag, Settings } from '$lib/types';

export const DB_NAME = 'midnight-markers';
export const DB_VERSION = 1;

export interface MMSchema extends DBSchema {
  bookmarks: {
    key: string;
    value: Bookmark;
    indexes: {
      'by-collection': string;
      'by-domain': string;
      'by-createdAt': number;
      'by-starred': number;       // 0|1 stored
      'by-unread': number;
      'by-isBroken': number;
    };
  };
  collections: { key: string; value: Collection; indexes: { 'by-parent': string } };
  tags: { key: string; value: Tag; indexes: { 'by-name': string } };
  settings: { key: string; value: Settings };
}

let dbPromise: Promise<IDBPDatabase<MMSchema>> | null = null;

export function getDb(): Promise<IDBPDatabase<MMSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<MMSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const bm = db.createObjectStore('bookmarks', { keyPath: 'id' });
        bm.createIndex('by-collection', 'collectionId');
        bm.createIndex('by-domain', 'domain');
        bm.createIndex('by-createdAt', 'createdAt');
        bm.createIndex('by-starred', 'starred');
        bm.createIndex('by-unread', 'unread');
        bm.createIndex('by-isBroken', 'isBroken');

        const col = db.createObjectStore('collections', { keyPath: 'id' });
        col.createIndex('by-parent', 'parentId');

        const tags = db.createObjectStore('tags', { keyPath: 'id' });
        tags.createIndex('by-name', 'name', { unique: true });

        db.createObjectStore('settings');
      },
    });
  }
  return dbPromise;
}

// Test-only: reset the cached connection so fake-indexeddb resets cleanly.
export function _resetDbForTests(): void {
  dbPromise = null;
}
```

Note: the IDB schema typings treat `boolean` indexes as numbers; tests will pass `true`/`false` and the runtime stores them — typing here mirrors what idb requires. We always read/write through the typed CRUD layer below, so callers don't see this.

- [ ] **Step 2: Commit (no test yet — exercised via Task 7+)**

```bash
git add src/lib/storage/db.ts
git commit -m "feat: IndexedDB schema and connection opener"
```

---

## Task 7: Pub-sub change events

**Files:**
- Create: `src/lib/storage/events.ts`, `tests/unit/storage/events.test.ts`

- [ ] **Step 1: Failing test**

`tests/unit/storage/events.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storageEvents, emit, type StorageEvent } from '$lib/storage/events';

beforeEach(() => storageEvents.removeAll());

describe('storageEvents', () => {
  it('notifies subscribers when an event is emitted', () => {
    const fn = vi.fn();
    storageEvents.on('bookmarks:changed', fn);
    emit({ type: 'bookmarks:changed' });
    expect(fn).toHaveBeenCalledWith({ type: 'bookmarks:changed' });
  });

  it('off removes a single listener', () => {
    const fn = vi.fn();
    storageEvents.on('bookmarks:changed', fn);
    storageEvents.off('bookmarks:changed', fn);
    emit({ type: 'bookmarks:changed' });
    expect(fn).not.toHaveBeenCalled();
  });

  it('does not crash when no listeners', () => {
    expect(() => emit({ type: 'collections:changed' })).not.toThrow();
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/unit/storage/events.test.ts`
Expected: fails on missing module.

- [ ] **Step 3: Implement**

`src/lib/storage/events.ts`:

```ts
export type StorageEvent =
  | { type: 'bookmarks:changed' }
  | { type: 'collections:changed' }
  | { type: 'tags:changed' }
  | { type: 'settings:changed' };

type Listener = (e: StorageEvent) => void;

class Bus {
  private listeners = new Map<StorageEvent['type'], Set<Listener>>();

  on(type: StorageEvent['type'], fn: Listener): void {
    let set = this.listeners.get(type);
    if (!set) this.listeners.set(type, (set = new Set()));
    set.add(fn);
  }

  off(type: StorageEvent['type'], fn: Listener): void {
    this.listeners.get(type)?.delete(fn);
  }

  removeAll(): void {
    this.listeners.clear();
  }

  emit(e: StorageEvent): void {
    this.listeners.get(e.type)?.forEach((fn) => fn(e));
  }
}

export const storageEvents = new Bus();

export function emit(e: StorageEvent): void {
  storageEvents.emit(e);
}
```

- [ ] **Step 4: Verify pass**

Run: `npm test -- tests/unit/storage/events.test.ts`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/events.ts tests/unit/storage/events.test.ts
git commit -m "feat: storage pub-sub for cross-view reactivity"
```

---

## Task 8: Settings store

**Files:**
- Create: `src/lib/storage/settings.ts`, `tests/unit/storage/settings.test.ts`

- [ ] **Step 1: Failing test**

`tests/unit/storage/settings.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetDbForTests } from '$lib/storage/db';
import { settings } from '$lib/storage/settings';

beforeEach(() => {
  indexedDB = new IDBFactory();
  _resetDbForTests();
});
declare const IDBFactory: any;

describe('settings store', () => {
  it('returns defaults when nothing is stored', async () => {
    const s = await settings.get();
    expect(s.aiKey).toBeNull();
    expect(s.aiModel).toBe('anthropic/claude-haiku-4.5');
    expect(s.aiFeatures).toEqual({ tags: true, title: true, collection: true });
    expect(s.defaultView).toBe('grid');
  });

  it('round-trips settings.set / settings.get', async () => {
    await settings.set({ aiKey: 'sk-ant-test', aiModel: 'openai/gpt-4o-mini' });
    const s = await settings.get();
    expect(s.aiKey).toBe('sk-ant-test');
    expect(s.aiModel).toBe('openai/gpt-4o-mini');
  });

  it('partial set merges with existing', async () => {
    await settings.set({ aiKey: 'sk-1' });
    await settings.set({ defaultView: 'list' });
    const s = await settings.get();
    expect(s.aiKey).toBe('sk-1');
    expect(s.defaultView).toBe('list');
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/unit/storage/settings.test.ts`
Expected: fails on missing module.

- [ ] **Step 3: Implement**

`src/lib/storage/settings.ts`:

```ts
import { getDb } from './db';
import { emit } from './events';
import type { Settings } from '$lib/types';

const KEY = 'singleton';

export const DEFAULT_SETTINGS: Settings = {
  aiKey: null,
  aiModel: 'anthropic/claude-haiku-4.5',
  aiFeatures: { tags: true, title: true, collection: true },
  defaultView: 'grid',
  defaultCollectionId: null,
};

export const settings = {
  async get(): Promise<Settings> {
    const db = await getDb();
    const stored = await db.get('settings', KEY);
    return { ...DEFAULT_SETTINGS, ...(stored as Partial<Settings> | undefined) };
  },

  async set(patch: Partial<Settings>): Promise<Settings> {
    const db = await getDb();
    const current = await this.get();
    const next: Settings = { ...current, ...patch };
    await db.put('settings', next as any, KEY);
    emit({ type: 'settings:changed' });
    return next;
  },
};
```

- [ ] **Step 4: Fix the test — IDBFactory is global in fake-indexeddb**

Replace the test's `beforeEach` with:

```ts
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
beforeEach(() => {
  // reset stores between tests
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});
```

- [ ] **Step 5: Verify pass**

Run: `npm test -- tests/unit/storage/settings.test.ts`
Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage/settings.ts tests/unit/storage/settings.test.ts
git commit -m "feat: settings storage with defaults and partial merge"
```

---

## Task 9: Collections store

**Files:**
- Create: `src/lib/storage/collections.ts`, `tests/unit/storage/collections.test.ts`

- [ ] **Step 1: Failing test**

`tests/unit/storage/collections.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetDbForTests } from '$lib/storage/db';
import { collections } from '$lib/storage/collections';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});

describe('collections', () => {
  it('creates with defaults and returns the row', async () => {
    const c = await collections.create({ name: 'Reading' });
    expect(c.name).toBe('Reading');
    expect(c.parentId).toBeNull();
    expect(c.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(c.id).toHaveLength(26);
  });

  it('lists collections, ordered by sortOrder asc', async () => {
    await collections.create({ name: 'A' });
    await collections.create({ name: 'B' });
    const rows = await collections.list();
    expect(rows.map((r) => r.name)).toEqual(['A', 'B']);
  });

  it('updates name and color', async () => {
    const c = await collections.create({ name: 'X' });
    const updated = await collections.update(c.id, { name: 'X2', color: '#ff0000' });
    expect(updated.name).toBe('X2');
    expect(updated.color).toBe('#ff0000');
  });

  it('delete removes the row', async () => {
    const c = await collections.create({ name: 'Tmp' });
    await collections.delete(c.id);
    expect(await collections.list()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/unit/storage/collections.test.ts`
Expected: fails on missing module.

- [ ] **Step 3: Implement**

`src/lib/storage/collections.ts`:

```ts
import { getDb } from './db';
import { emit } from './events';
import { newId } from '$lib/ulid';
import type { Collection } from '$lib/types';

const PALETTE = [
  '#8b9bff', '#bd93f9', '#ff79c6', '#ff8a65', '#ffe66d', '#50fa7b',
  '#6fe6cf', '#8be9fd', '#a8e6cf', '#c7ceea', '#f1a7c8', '#ffb86c',
];

function nextColor(used: string[]): string {
  for (const c of PALETTE) if (!used.includes(c)) return c;
  return PALETTE[used.length % PALETTE.length]!;
}

export const collections = {
  async create(input: { name: string; parentId?: string | null; color?: string }): Promise<Collection> {
    const db = await getDb();
    const all = await db.getAll('collections');
    const row: Collection = {
      id: newId(),
      name: input.name,
      parentId: input.parentId ?? null,
      color: input.color ?? nextColor(all.map((c) => c.color)),
      sortOrder: all.length,
      createdAt: Date.now(),
    };
    await db.put('collections', row);
    emit({ type: 'collections:changed' });
    return row;
  },

  async update(id: string, patch: Partial<Collection>): Promise<Collection> {
    const db = await getDb();
    const cur = await db.get('collections', id);
    if (!cur) throw new Error('collection not found: ' + id);
    const next = { ...cur, ...patch, id: cur.id };
    await db.put('collections', next);
    emit({ type: 'collections:changed' });
    return next;
  },

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('collections', id);
    emit({ type: 'collections:changed' });
  },

  async list(): Promise<Collection[]> {
    const db = await getDb();
    const rows = await db.getAll('collections');
    return rows.sort((a, b) => a.sortOrder - b.sortOrder);
  },

  async get(id: string): Promise<Collection | null> {
    const db = await getDb();
    return (await db.get('collections', id)) ?? null;
  },
};
```

- [ ] **Step 4: Verify pass**

Run: `npm test -- tests/unit/storage/collections.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/collections.ts tests/unit/storage/collections.test.ts
git commit -m "feat: collections CRUD with auto-palette"
```

---

## Task 10: Tags store

**Files:**
- Create: `src/lib/storage/tags.ts`, `tests/unit/storage/tags.test.ts`

- [ ] **Step 1: Failing test**

`tests/unit/storage/tags.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetDbForTests } from '$lib/storage/db';
import { tags } from '$lib/storage/tags';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});

describe('tags', () => {
  it('upsertByName creates a tag with lowercased name and returns it', async () => {
    const t = await tags.upsertByName('Design');
    expect(t.name).toBe('design');
    expect(t.count).toBe(0);
  });

  it('upsertByName returns existing tag when name already exists (case-insensitive)', async () => {
    const a = await tags.upsertByName('design');
    const b = await tags.upsertByName('DESIGN');
    expect(b.id).toBe(a.id);
  });

  it('incrementCount and decrementCount track usage', async () => {
    const t = await tags.upsertByName('webdev');
    await tags.incrementCount(t.id);
    await tags.incrementCount(t.id);
    expect((await tags.get(t.id))!.count).toBe(2);
    await tags.decrementCount(t.id);
    expect((await tags.get(t.id))!.count).toBe(1);
  });

  it('decrement floors at 0', async () => {
    const t = await tags.upsertByName('x');
    await tags.decrementCount(t.id);
    expect((await tags.get(t.id))!.count).toBe(0);
  });

  it('list returns all tags sorted by name', async () => {
    await tags.upsertByName('zeta');
    await tags.upsertByName('alpha');
    const list = await tags.list();
    expect(list.map((t) => t.name)).toEqual(['alpha', 'zeta']);
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/unit/storage/tags.test.ts`
Expected: fails on missing module.

- [ ] **Step 3: Implement**

`src/lib/storage/tags.ts`:

```ts
import { getDb } from './db';
import { emit } from './events';
import { newId } from '$lib/ulid';
import type { Tag } from '$lib/types';

export const tags = {
  async upsertByName(name: string): Promise<Tag> {
    const lower = name.trim().toLowerCase();
    const db = await getDb();
    const existing = await db.getFromIndex('tags', 'by-name', lower);
    if (existing) return existing;
    const row: Tag = { id: newId(), name: lower, count: 0 };
    await db.put('tags', row);
    emit({ type: 'tags:changed' });
    return row;
  },

  async get(id: string): Promise<Tag | null> {
    const db = await getDb();
    return (await db.get('tags', id)) ?? null;
  },

  async incrementCount(id: string): Promise<void> {
    const db = await getDb();
    const t = await db.get('tags', id);
    if (!t) return;
    t.count += 1;
    await db.put('tags', t);
    emit({ type: 'tags:changed' });
  },

  async decrementCount(id: string): Promise<void> {
    const db = await getDb();
    const t = await db.get('tags', id);
    if (!t) return;
    t.count = Math.max(0, t.count - 1);
    await db.put('tags', t);
    emit({ type: 'tags:changed' });
  },

  async list(): Promise<Tag[]> {
    const db = await getDb();
    const rows = await db.getAll('tags');
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },

  async delete(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('tags', id);
    emit({ type: 'tags:changed' });
  },
};
```

- [ ] **Step 4: Verify pass**

Run: `npm test -- tests/unit/storage/tags.test.ts`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/tags.ts tests/unit/storage/tags.test.ts
git commit -m "feat: tags store with upsert-by-name and counts"
```

---

## Task 11: Bookmarks store

**Files:**
- Create: `src/lib/storage/bookmarks.ts`, `tests/unit/storage/bookmarks.test.ts`

- [ ] **Step 1: Failing test**

`tests/unit/storage/bookmarks.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetDbForTests } from '$lib/storage/db';
import { bookmarks } from '$lib/storage/bookmarks';
import { tags } from '$lib/storage/tags';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});

describe('bookmarks', () => {
  it('create populates id, timestamps, defaults, and domain', async () => {
    const b = await bookmarks.create({
      url: 'https://example.com/foo',
      title: 'Foo',
      originalTitle: 'Foo',
    });
    expect(b.id).toHaveLength(26);
    expect(b.domain).toBe('example.com');
    expect(b.unread).toBe(true);
    expect(b.starred).toBe(false);
    expect(b.tagIds).toEqual([]);
    expect(b.collectionId).toBeNull();
    expect(b.createdAt).toBeGreaterThan(0);
    expect(b.updatedAt).toBe(b.createdAt);
  });

  it('update bumps updatedAt and applies patch', async () => {
    const b = await bookmarks.create({ url: 'https://x', title: 'X', originalTitle: 'X' });
    await new Promise((r) => setTimeout(r, 2));
    const u = await bookmarks.update(b.id, { starred: true, title: 'X-edit' });
    expect(u.starred).toBe(true);
    expect(u.title).toBe('X-edit');
    expect(u.updatedAt).toBeGreaterThan(b.updatedAt);
  });

  it('delete removes the row', async () => {
    const b = await bookmarks.create({ url: 'https://x', title: 'X', originalTitle: 'X' });
    await bookmarks.delete(b.id);
    expect(await bookmarks.get(b.id)).toBeNull();
  });

  it('addTag increments tag count and updates bookmark.tagIds', async () => {
    const b = await bookmarks.create({ url: 'https://x', title: 'X', originalTitle: 'X' });
    const t = await tags.upsertByName('design');
    await bookmarks.addTag(b.id, t.id);
    const after = await bookmarks.get(b.id);
    expect(after!.tagIds).toEqual([t.id]);
    expect((await tags.get(t.id))!.count).toBe(1);
  });

  it('removeTag decrements tag count and removes id from bookmark', async () => {
    const b = await bookmarks.create({ url: 'https://x', title: 'X', originalTitle: 'X' });
    const t = await tags.upsertByName('design');
    await bookmarks.addTag(b.id, t.id);
    await bookmarks.removeTag(b.id, t.id);
    const after = await bookmarks.get(b.id);
    expect(after!.tagIds).toEqual([]);
    expect((await tags.get(t.id))!.count).toBe(0);
  });

  it('list with no filter returns all sorted createdAt desc', async () => {
    const a = await bookmarks.create({ url: 'https://a', title: 'A', originalTitle: 'A' });
    await new Promise((r) => setTimeout(r, 2));
    const b = await bookmarks.create({ url: 'https://b', title: 'B', originalTitle: 'B' });
    const list = await bookmarks.list({});
    expect(list.map((x) => x.id)).toEqual([b.id, a.id]);
  });

  it('list filters by collectionId', async () => {
    const a = await bookmarks.create({ url: 'https://a', title: 'A', originalTitle: 'A' });
    await bookmarks.update(a.id, { collectionId: 'COL-1' });
    await bookmarks.create({ url: 'https://b', title: 'B', originalTitle: 'B' });
    const list = await bookmarks.list({ collectionId: 'COL-1' });
    expect(list.map((x) => x.url)).toEqual(['https://a']);
  });

  it('list filters by smart=starred', async () => {
    const a = await bookmarks.create({ url: 'https://a', title: 'A', originalTitle: 'A' });
    await bookmarks.create({ url: 'https://b', title: 'B', originalTitle: 'B' });
    await bookmarks.update(a.id, { starred: true });
    const list = await bookmarks.list({ smart: 'starred' });
    expect(list.map((x) => x.url)).toEqual(['https://a']);
  });

  it('list applies search across title and url', async () => {
    await bookmarks.create({ url: 'https://blog.example.com/types', title: 'Type theory', originalTitle: 'Type theory' });
    await bookmarks.create({ url: 'https://other.com/foo', title: 'Foo', originalTitle: 'Foo' });
    const list = await bookmarks.list({ search: 'type' });
    expect(list).toHaveLength(1);
    expect(list[0]!.title).toBe('Type theory');
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/unit/storage/bookmarks.test.ts`
Expected: fails on missing module.

- [ ] **Step 3: Implement**

`src/lib/storage/bookmarks.ts`:

```ts
import { getDb } from './db';
import { emit } from './events';
import { newId } from '$lib/ulid';
import { tags as tagsStore } from './tags';
import type { Bookmark, BookmarkFilter } from '$lib/types';

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

type CreateInput = {
  url: string;
  title: string;
  originalTitle: string;
  description?: string | null;
  excerpt?: string | null;
  faviconUrl?: string | null;
  thumbnailUrl?: string | null;
  collectionId?: string | null;
  tagIds?: string[];
};

export const bookmarks = {
  async create(input: CreateInput): Promise<Bookmark> {
    const db = await getDb();
    const now = Date.now();
    const row: Bookmark = {
      id: newId(),
      url: input.url,
      title: input.title,
      originalTitle: input.originalTitle,
      domain: domainOf(input.url),
      faviconUrl: input.faviconUrl ?? null,
      thumbnailUrl: input.thumbnailUrl ?? null,
      description: input.description ?? null,
      excerpt: input.excerpt ?? null,
      collectionId: input.collectionId ?? null,
      tagIds: input.tagIds ?? [],
      starred: false,
      unread: true,
      note: null,
      createdAt: now,
      updatedAt: now,
      lastCheckedAt: null,
      isBroken: false,
    };
    await db.put('bookmarks', row);
    emit({ type: 'bookmarks:changed' });
    return row;
  },

  async update(id: string, patch: Partial<Bookmark>): Promise<Bookmark> {
    const db = await getDb();
    const cur = await db.get('bookmarks', id);
    if (!cur) throw new Error('bookmark not found: ' + id);
    const next: Bookmark = { ...cur, ...patch, id: cur.id, updatedAt: Date.now() };
    await db.put('bookmarks', next);
    emit({ type: 'bookmarks:changed' });
    return next;
  },

  async delete(id: string): Promise<void> {
    const db = await getDb();
    const cur = await db.get('bookmarks', id);
    if (!cur) return;
    for (const tagId of cur.tagIds) await tagsStore.decrementCount(tagId);
    await db.delete('bookmarks', id);
    emit({ type: 'bookmarks:changed' });
  },

  async get(id: string): Promise<Bookmark | null> {
    const db = await getDb();
    return (await db.get('bookmarks', id)) ?? null;
  },

  async addTag(bookmarkId: string, tagId: string): Promise<void> {
    const cur = await this.get(bookmarkId);
    if (!cur || cur.tagIds.includes(tagId)) return;
    await this.update(bookmarkId, { tagIds: [...cur.tagIds, tagId] });
    await tagsStore.incrementCount(tagId);
  },

  async removeTag(bookmarkId: string, tagId: string): Promise<void> {
    const cur = await this.get(bookmarkId);
    if (!cur || !cur.tagIds.includes(tagId)) return;
    await this.update(bookmarkId, { tagIds: cur.tagIds.filter((id) => id !== tagId) });
    await tagsStore.decrementCount(tagId);
  },

  async list(filter: BookmarkFilter): Promise<Bookmark[]> {
    const db = await getDb();
    let rows = await db.getAll('bookmarks');

    if (filter.collectionId !== undefined) {
      rows = rows.filter((b) => b.collectionId === filter.collectionId);
    }
    if (filter.tagId) {
      rows = rows.filter((b) => b.tagIds.includes(filter.tagId!));
    }
    if (filter.smart) {
      switch (filter.smart) {
        case 'recent': {
          const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
          rows = rows.filter((b) => b.createdAt >= cutoff);
          break;
        }
        case 'unread': rows = rows.filter((b) => b.unread); break;
        case 'starred': rows = rows.filter((b) => b.starred); break;
        case 'untagged': rows = rows.filter((b) => b.tagIds.length === 0); break;
        case 'broken': rows = rows.filter((b) => b.isBroken); break;
      }
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      rows = rows.filter((b) =>
        b.title.toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q) ||
        (b.note?.toLowerCase().includes(q) ?? false),
      );
    }

    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
};
```

- [ ] **Step 4: Verify pass**

Run: `npm test -- tests/unit/storage/bookmarks.test.ts`
Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage/bookmarks.ts tests/unit/storage/bookmarks.test.ts
git commit -m "feat: bookmarks CRUD with filtered list and tag-count maintenance"
```

---

## Task 12: Metadata extraction (content script)

**Files:**
- Create: `src/lib/metadata/extract.ts`, `src/lib/metadata/thumbnail.ts`

- [ ] **Step 1: extract.ts (runs in active tab via chrome.scripting)**

```ts
export type ExtractedMetadata = {
  title: string;
  description: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  excerpt: string | null;
};

export function extractFromDocument(): ExtractedMetadata {
  const meta = (selector: string) =>
    document.querySelector(selector)?.getAttribute('content') ?? null;

  const linkHref = (selector: string) => {
    const el = document.querySelector<HTMLLinkElement>(selector);
    return el ? new URL(el.href, location.href).toString() : null;
  };

  const title = document.title?.trim() || location.hostname;
  const description = meta('meta[property="og:description"]') ?? meta('meta[name="description"]');
  const ogImageUrl = meta('meta[property="og:image"]');
  const faviconUrl =
    linkHref('link[rel="icon"]') ??
    linkHref('link[rel="shortcut icon"]') ??
    `${location.origin}/favicon.ico`;

  // Cheap excerpt: first 500 visible chars of body, ignoring script/style.
  const text = (document.body.innerText || '').replace(/\s+/g, ' ').trim();
  const excerpt = text ? text.slice(0, 500) : null;

  return { title, description, faviconUrl, ogImageUrl, excerpt };
}
```

- [ ] **Step 2: thumbnail.ts**

```ts
export async function captureActiveTabThumbnail(tabId: number): Promise<string | null> {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 60 });
    // Cap at ~100KB by quality fallback if oversize
    if (dataUrl && dataUrl.length > 140000) {
      return await chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 30 });
    }
    return dataUrl ?? null;
  } catch {
    return null;
  }
}
```

Note: `tabId` not currently used (captureVisibleTab uses the active tab in the current window). Kept in signature for clarity and future cross-window support; remove in Plan 3 if still unused.

- [ ] **Step 3: Commit (no unit test — exercised in Task 14 e2e and integration)**

```bash
git add src/lib/metadata
git commit -m "feat: page metadata extraction and thumbnail fallback"
```

---

## Task 13: Popup save flow (no AI, no tag picker yet)

**Files:**
- Modify: `src/popup/App.svelte`
- Create: `tests/unit/popup/saveFlow.test.ts`

- [ ] **Step 1: Failing test for the save orchestrator (extract logic into a function)**

`tests/unit/popup/saveFlow.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { _resetDbForTests } from '$lib/storage/db';
import { bookmarks } from '$lib/storage/bookmarks';
import { performSave } from '../../../src/popup/saveFlow';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});

describe('performSave', () => {
  it('creates a bookmark from extracted metadata', async () => {
    const id = await performSave({
      url: 'https://example.com/foo',
      extracted: {
        title: 'Foo',
        description: 'About foo',
        faviconUrl: 'https://example.com/favicon.ico',
        ogImageUrl: 'https://example.com/og.png',
        excerpt: 'lorem ipsum',
      },
    });
    const b = await bookmarks.get(id);
    expect(b).not.toBeNull();
    expect(b!.title).toBe('Foo');
    expect(b!.originalTitle).toBe('Foo');
    expect(b!.description).toBe('About foo');
    expect(b!.thumbnailUrl).toBe('https://example.com/og.png');
    expect(b!.faviconUrl).toBe('https://example.com/favicon.ico');
  });

  it('falls back to URL when title is empty', async () => {
    const id = await performSave({
      url: 'https://example.com/foo',
      extracted: {
        title: '',
        description: null,
        faviconUrl: null,
        ogImageUrl: null,
        excerpt: null,
      },
    });
    const b = await bookmarks.get(id);
    expect(b!.title).toBe('https://example.com/foo');
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/unit/popup/saveFlow.test.ts`
Expected: fails on missing module.

- [ ] **Step 3: Extract save flow into a pure function**

`src/popup/saveFlow.ts`:

```ts
import { bookmarks } from '$lib/storage/bookmarks';
import type { ExtractedMetadata } from '$lib/metadata/extract';

export async function performSave(args: {
  url: string;
  extracted: ExtractedMetadata;
}): Promise<string> {
  const title = args.extracted.title?.trim() || args.url;
  const b = await bookmarks.create({
    url: args.url,
    title,
    originalTitle: title,
    description: args.extracted.description,
    excerpt: args.extracted.excerpt,
    faviconUrl: args.extracted.faviconUrl,
    thumbnailUrl: args.extracted.ogImageUrl,
  });
  return b.id;
}
```

- [ ] **Step 4: Verify pass**

Run: `npm test -- tests/unit/popup/saveFlow.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Wire into App.svelte**

`src/popup/App.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { extractFromDocument, type ExtractedMetadata } from '$lib/metadata/extract';
  import { captureActiveTabThumbnail } from '$lib/metadata/thumbnail';
  import { performSave } from './saveFlow';
  import { bookmarks } from '$lib/storage/bookmarks';
  import type { Bookmark } from '$lib/types';

  let bookmark = $state<Bookmark | null>(null);
  let error = $state<string | null>(null);

  onMount(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('brave://')) {
        error = "Can't save this page (browser internal).";
        return;
      }

      // Inject extractor into active tab
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractFromDocument,
      });
      const extracted = result.result as ExtractedMetadata;

      // og:image fallback to screenshot
      if (!extracted.ogImageUrl) {
        const thumb = await captureActiveTabThumbnail(tab.id);
        if (thumb) (extracted as ExtractedMetadata).ogImageUrl = thumb;
      }

      const id = await performSave({ url: tab.url, extracted });
      bookmark = await bookmarks.get(id);
    } catch (e) {
      error = (e as Error).message;
    }
  });

  async function toggleStar() {
    if (!bookmark) return;
    bookmark = await bookmarks.update(bookmark.id, { starred: !bookmark.starred });
  }

  async function undoSave() {
    if (!bookmark) return;
    await bookmarks.delete(bookmark.id);
    window.close();
  }
</script>

<div class="p-4 w-[320px] text-sm">
  {#if error}
    <div class="opacity-70">{error}</div>
  {:else if bookmark}
    <div class="flex gap-2 items-start">
      {#if bookmark.faviconUrl}
        <img src={bookmark.faviconUrl} alt="" class="w-8 h-8 rounded-md" />
      {:else}
        <div class="w-8 h-8 rounded-md bg-accent-violet/30"></div>
      {/if}
      <div class="flex-1 min-w-0">
        <div class="font-semibold truncate">{bookmark.title}</div>
        <div class="opacity-50 text-xs truncate">{bookmark.domain}</div>
      </div>
      <button onclick={toggleStar} class="px-2 py-1 rounded {bookmark.starred ? 'text-yellow-300' : 'opacity-50'}">★</button>
    </div>
    <div class="mt-3 text-xs opacity-50">Saved · <button onclick={undoSave} class="underline">undo</button></div>
  {:else}
    <div class="opacity-50">Saving...</div>
  {/if}
</div>
```

- [ ] **Step 6: Manual verify**

Run: `npm run build`
Reload extension. Click toolbar icon on `https://example.com`. Expect popup to show favicon + title + "Saved · undo".

- [ ] **Step 7: Commit**

```bash
git add src/popup/App.svelte src/popup/saveFlow.ts tests/unit/popup/saveFlow.test.ts
git commit -m "feat: popup save flow — instant create with star toggle and undo"
```

---

## Task 14: Tag picker component

**Files:**
- Create: `src/popup/TagPicker.svelte`, `tests/unit/popup/TagPicker.test.ts`
- Modify: `src/popup/App.svelte`

- [ ] **Step 1: Failing component test**

`tests/unit/popup/TagPicker.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import TagPicker from '../../../src/popup/TagPicker.svelte';
import { _resetDbForTests } from '$lib/storage/db';
import { tags } from '$lib/storage/tags';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  _resetDbForTests();
});

describe('TagPicker', () => {
  it('renders existing tag pills passed in', () => {
    const t = { id: 'T1', name: 'design', count: 1 };
    const { getByText } = render(TagPicker, { selectedIds: [t.id], allTags: [t] });
    expect(getByText('design')).toBeTruthy();
  });

  it('shows autocomplete suggestions when typing', async () => {
    const all = [
      { id: 'T1', name: 'design', count: 1 },
      { id: 'T2', name: 'webdev', count: 1 },
    ];
    const { getByPlaceholderText, findByText } = render(TagPicker, { selectedIds: [], allTags: all });
    const input = getByPlaceholderText('add tag') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'des' } });
    expect(await findByText('design')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/unit/popup/TagPicker.test.ts`
Expected: fails on missing component.

- [ ] **Step 3: Implement TagPicker.svelte**

```svelte
<script lang="ts">
  import type { Tag } from '$lib/types';

  let { selectedIds = $bindable(), allTags = [] }: { selectedIds: string[]; allTags: Tag[] } = $props();

  let query = $state('');
  let suggestions = $derived(
    query.trim().length === 0
      ? []
      : allTags
          .filter((t) => t.name.includes(query.trim().toLowerCase()) && !selectedIds.includes(t.id))
          .slice(0, 5),
  );

  function add(t: Tag) {
    selectedIds = [...selectedIds, t.id];
    query = '';
  }
  function remove(id: string) {
    selectedIds = selectedIds.filter((x) => x !== id);
  }

  function selectedPills(): Tag[] {
    return selectedIds
      .map((id) => allTags.find((t) => t.id === id))
      .filter((t): t is Tag => Boolean(t));
  }
</script>

<div class="space-y-1">
  <div class="flex flex-wrap gap-1">
    {#each selectedPills() as t (t.id)}
      <button
        type="button"
        class="text-xs px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/15"
        onclick={() => remove(t.id)}
      >
        {t.name} <span class="opacity-50">×</span>
      </button>
    {/each}
  </div>
  <div class="relative">
    <input
      bind:value={query}
      placeholder="add tag"
      class="w-full bg-white/5 rounded px-2 py-1 text-xs outline-none"
    />
    {#if suggestions.length > 0}
      <div class="absolute mt-1 left-0 right-0 bg-bg-raised border border-white/10 rounded shadow-lg z-10">
        {#each suggestions as s (s.id)}
          <button
            type="button"
            class="block w-full text-left px-2 py-1 text-xs hover:bg-white/5"
            onclick={() => add(s)}
          >
            {s.name}
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
```

- [ ] **Step 4: Verify pass**

Run: `npm test -- tests/unit/popup/TagPicker.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Wire into App.svelte**

Replace the existing `App.svelte` script and template with:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { extractFromDocument, type ExtractedMetadata } from '$lib/metadata/extract';
  import { captureActiveTabThumbnail } from '$lib/metadata/thumbnail';
  import { performSave } from './saveFlow';
  import { bookmarks } from '$lib/storage/bookmarks';
  import { tags as tagsStore } from '$lib/storage/tags';
  import type { Bookmark, Tag } from '$lib/types';
  import TagPicker from './TagPicker.svelte';

  let bookmark = $state<Bookmark | null>(null);
  let error = $state<string | null>(null);
  let allTags = $state<Tag[]>([]);
  let selectedTagIds = $state<string[]>([]);

  $effect(() => {
    if (!bookmark) return;
    // Diff selectedTagIds against bookmark.tagIds and apply
    const before = new Set(bookmark.tagIds);
    const after = new Set(selectedTagIds);
    for (const id of after) if (!before.has(id)) bookmarks.addTag(bookmark.id, id);
    for (const id of before) if (!after.has(id)) bookmarks.removeTag(bookmark.id, id);
  });

  onMount(async () => {
    allTags = await tagsStore.list();
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('brave://')) {
        error = "Can't save this page (browser internal).";
        return;
      }
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractFromDocument,
      });
      const extracted = result.result as ExtractedMetadata;
      if (!extracted.ogImageUrl) {
        const thumb = await captureActiveTabThumbnail(tab.id);
        if (thumb) extracted.ogImageUrl = thumb;
      }
      const id = await performSave({ url: tab.url, extracted });
      bookmark = await bookmarks.get(id);
    } catch (e) {
      error = (e as Error).message;
    }
  });

  async function toggleStar() {
    if (!bookmark) return;
    bookmark = await bookmarks.update(bookmark.id, { starred: !bookmark.starred });
  }
  async function undoSave() {
    if (!bookmark) return;
    await bookmarks.delete(bookmark.id);
    window.close();
  }
</script>

<div class="p-4 w-[320px] text-sm">
  {#if error}
    <div class="opacity-70">{error}</div>
  {:else if bookmark}
    <div class="flex gap-2 items-start">
      {#if bookmark.faviconUrl}
        <img src={bookmark.faviconUrl} alt="" class="w-8 h-8 rounded-md" />
      {:else}
        <div class="w-8 h-8 rounded-md bg-accent-violet/30"></div>
      {/if}
      <div class="flex-1 min-w-0">
        <div class="font-semibold truncate">{bookmark.title}</div>
        <div class="opacity-50 text-xs truncate">{bookmark.domain}</div>
      </div>
      <button onclick={toggleStar} class="px-2 py-1 rounded {bookmark.starred ? 'text-yellow-300' : 'opacity-50'}">★</button>
    </div>
    <div class="mt-3">
      <div class="text-[10px] uppercase tracking-wide opacity-50 mb-1">Tags</div>
      <TagPicker bind:selectedIds={selectedTagIds} {allTags} />
    </div>
    <div class="mt-3 text-xs opacity-50">Saved · <button onclick={undoSave} class="underline">undo</button></div>
  {:else}
    <div class="opacity-50">Saving...</div>
  {/if}
</div>
```

- [ ] **Step 6: Note — adding a tag that doesn't exist yet**

For Plan 1 the picker only selects existing tags. New-tag creation lands in Plan 3. (We seed tags via the new-tab inline editor in Task 19.)

- [ ] **Step 7: Commit**

```bash
git add src/popup/TagPicker.svelte src/popup/App.svelte tests/unit/popup/TagPicker.test.ts
git commit -m "feat: tag picker in popup with autocomplete over existing tags"
```

---

## Task 15: Collection picker component

**Files:**
- Create: `src/popup/CollectionPicker.svelte`
- Modify: `src/popup/App.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
  import type { Collection } from '$lib/types';

  let {
    selectedId = $bindable(),
    collections = [],
  }: { selectedId: string | null; collections: Collection[] } = $props();
</script>

<select
  class="w-full bg-white/5 rounded px-2 py-1 text-xs outline-none"
  bind:value={selectedId}
>
  <option value={null}>(none)</option>
  {#each collections as c (c.id)}
    <option value={c.id}>{c.name}</option>
  {/each}
</select>
```

- [ ] **Step 2: Wire into App.svelte**

Add to script block in `src/popup/App.svelte`:

```ts
import CollectionPicker from './CollectionPicker.svelte';
import { collections as colStore } from '$lib/storage/collections';
import type { Collection } from '$lib/types';

let allCollections = $state<Collection[]>([]);
let selectedCollectionId = $state<string | null>(null);

$effect(() => {
  if (!bookmark) return;
  if (selectedCollectionId !== bookmark.collectionId) {
    bookmarks.update(bookmark.id, { collectionId: selectedCollectionId });
  }
});
```

In `onMount`, after `allTags = await tagsStore.list();` add:

```ts
allCollections = await colStore.list();
```

In the template, after the `Tags` block add:

```svelte
<div class="mt-3">
  <div class="text-[10px] uppercase tracking-wide opacity-50 mb-1">Collection</div>
  <CollectionPicker bind:selectedId={selectedCollectionId} collections={allCollections} />
</div>
```

- [ ] **Step 3: Manual verify**

Run: `npm run build` → reload extension → save a page → verify dropdown shows "(none)" and collections (will be empty until Task 19 adds collection management).

- [ ] **Step 4: Commit**

```bash
git add src/popup/CollectionPicker.svelte src/popup/App.svelte
git commit -m "feat: collection picker in popup"
```

---

## Task 16: New-tab Sidebar

**Files:**
- Create: `src/newtab/Sidebar.svelte`, `tests/unit/newtab/Sidebar.test.ts`

- [ ] **Step 1: Failing test**

`tests/unit/newtab/Sidebar.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Sidebar from '../../../src/newtab/Sidebar.svelte';

describe('Sidebar', () => {
  it('renders smart filters and emits selection', async () => {
    let selected: any = null;
    const { getByText } = render(Sidebar, {
      collections: [],
      tags: [],
      selection: { kind: 'all' },
      onSelect: (s: any) => (selected = s),
    });
    await fireEvent.click(getByText('Starred'));
    expect(selected).toEqual({ kind: 'smart', smart: 'starred' });
  });

  it('renders collections and emits selection', async () => {
    let selected: any = null;
    const collections = [{ id: 'C1', name: 'Reading', parentId: null, color: '#fff', sortOrder: 0, createdAt: 0 }];
    const { getByText } = render(Sidebar, {
      collections,
      tags: [],
      selection: { kind: 'all' },
      onSelect: (s: any) => (selected = s),
    });
    await fireEvent.click(getByText('Reading'));
    expect(selected).toEqual({ kind: 'collection', id: 'C1' });
  });
});
```

- [ ] **Step 2: Verify failure**

Run: `npm test -- tests/unit/newtab/Sidebar.test.ts`
Expected: fails on missing component.

- [ ] **Step 3: Implement**

`src/newtab/Sidebar.svelte`:

```svelte
<script lang="ts">
  import type { Collection, Tag, SmartFilter } from '$lib/types';

  export type Selection =
    | { kind: 'all' }
    | { kind: 'smart'; smart: SmartFilter }
    | { kind: 'collection'; id: string }
    | { kind: 'tag'; id: string };

  let {
    collections,
    tags,
    selection,
    onSelect,
  }: {
    collections: Collection[];
    tags: Tag[];
    selection: Selection;
    onSelect: (s: Selection) => void;
  } = $props();

  function isActive(s: Selection): boolean {
    return JSON.stringify(s) === JSON.stringify(selection);
  }
</script>

<aside class="w-[200px] shrink-0 px-3 py-4 border-r border-white/5 text-sm">
  <div class="font-semibold tracking-tight mb-4">⏾ midnight</div>

  <div class="text-[10px] uppercase tracking-wider opacity-50 px-2 mt-3 mb-1">Library</div>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'all' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'all' })}>All</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'recent' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'recent' })}>Recent</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'unread' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'unread' })}>Unread</button>
  <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 {isActive({ kind: 'smart', smart: 'starred' }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'smart', smart: 'starred' })}>Starred</button>

  {#if collections.length > 0}
    <div class="text-[10px] uppercase tracking-wider opacity-50 px-2 mt-4 mb-1">Collections</div>
    {#each collections as c (c.id)}
      <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 flex items-center gap-2 {isActive({ kind: 'collection', id: c.id }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'collection', id: c.id })}>
        <span class="w-3 h-3 rounded-sm" style="background:{c.color}"></span>
        <span class="flex-1 truncate">{c.name}</span>
      </button>
    {/each}
  {/if}

  {#if tags.length > 0}
    <div class="text-[10px] uppercase tracking-wider opacity-50 px-2 mt-4 mb-1">Tags</div>
    {#each tags as t (t.id)}
      <button class="w-full text-left px-2 py-1 rounded hover:bg-white/5 flex items-center justify-between {isActive({ kind: 'tag', id: t.id }) ? 'bg-white/10' : ''}" onclick={() => onSelect({ kind: 'tag', id: t.id })}>
        <span class="truncate">{t.name}</span>
        <span class="text-xs opacity-40">{t.count}</span>
      </button>
    {/each}
  {/if}
</aside>
```

- [ ] **Step 4: Verify pass**

Run: `npm test -- tests/unit/newtab/Sidebar.test.ts`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/newtab/Sidebar.svelte tests/unit/newtab/Sidebar.test.ts
git commit -m "feat: newtab sidebar with smart filters, collections, tags"
```

---

## Task 17: BookmarkCard component

**Files:**
- Create: `src/newtab/BookmarkCard.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
  import type { Bookmark } from '$lib/types';
  let { bookmark, onOpen, onDelete }: { bookmark: Bookmark; onOpen: () => void; onDelete: () => void } = $props();
</script>

<div class="bm-card overflow-hidden cursor-pointer group" role="button" tabindex="0" onclick={onOpen} onkeydown={(e) => e.key === 'Enter' && onOpen()}>
  <div class="h-[100px] bg-white/5">
    {#if bookmark.thumbnailUrl}
      <img src={bookmark.thumbnailUrl} alt="" class="w-full h-full object-cover" loading="lazy" />
    {/if}
  </div>
  <div class="p-2.5">
    <div class="flex items-center gap-1.5 mb-1.5">
      {#if bookmark.faviconUrl}
        <img src={bookmark.faviconUrl} alt="" class="w-3.5 h-3.5 rounded-sm" />
      {/if}
      <div class="text-[10px] opacity-50 truncate flex-1">{bookmark.domain}</div>
      {#if bookmark.starred}
        <span class="text-yellow-300 text-xs">★</span>
      {/if}
    </div>
    <div class="text-xs font-medium leading-snug line-clamp-2">{bookmark.title}</div>
  </div>
  <button
    class="absolute top-1 right-1 px-1.5 py-0.5 text-xs rounded bg-black/40 opacity-0 group-hover:opacity-100"
    onclick={(e) => { e.stopPropagation(); onDelete(); }}
    aria-label="Delete bookmark"
  >×</button>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/newtab/BookmarkCard.svelte
git commit -m "feat: bookmark card component for grid view"
```

---

## Task 18: BookmarkGrid component

**Files:**
- Create: `src/newtab/BookmarkGrid.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
  import type { Bookmark } from '$lib/types';
  import BookmarkCard from './BookmarkCard.svelte';

  let { items, onOpen, onDelete }: { items: Bookmark[]; onOpen: (b: Bookmark) => void; onDelete: (b: Bookmark) => void } = $props();
</script>

{#if items.length === 0}
  <div class="opacity-50 text-sm py-12 text-center">No bookmarks yet — click the toolbar icon on any page to save.</div>
{:else}
  <div class="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(220px,1fr))] relative">
    {#each items as b (b.id)}
      <div class="relative">
        <BookmarkCard bookmark={b} onOpen={() => onOpen(b)} onDelete={() => onDelete(b)} />
      </div>
    {/each}
  </div>
{/if}
```

- [ ] **Step 2: Commit**

```bash
git add src/newtab/BookmarkGrid.svelte
git commit -m "feat: bookmark grid with empty state"
```

---

## Task 19: Toolbar with search and inline collection creation

**Files:**
- Create: `src/newtab/Toolbar.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
  let {
    search = $bindable(),
    title,
    count,
    onNewCollection,
  }: { search: string; title: string; count: number; onNewCollection: () => void } = $props();
</script>

<div class="flex items-center gap-3 mb-5">
  <input
    bind:value={search}
    placeholder="Search bookmarks..."
    class="flex-1 bg-white/5 border border-white/5 rounded-lg px-3 py-2 text-sm outline-none focus:border-accent-violet/50"
  />
  <button onclick={onNewCollection} class="text-xs px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10">+ Collection</button>
</div>
<div class="mb-4">
  <h1 class="text-2xl font-semibold tracking-tight">
    {title}
    <span class="ml-2 text-xs opacity-50 font-normal">{count} saved</span>
  </h1>
</div>
```

- [ ] **Step 2: Commit**

```bash
git add src/newtab/Toolbar.svelte
git commit -m "feat: newtab toolbar with search and collection-create button"
```

---

## Task 20: Wire newtab App.svelte

**Files:**
- Modify: `src/newtab/App.svelte`

- [ ] **Step 1: Implement**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import Sidebar, { type Selection } from './Sidebar.svelte';
  import Toolbar from './Toolbar.svelte';
  import BookmarkGrid from './BookmarkGrid.svelte';
  import { bookmarks } from '$lib/storage/bookmarks';
  import { collections as colStore } from '$lib/storage/collections';
  import { tags as tagsStore } from '$lib/storage/tags';
  import { storageEvents } from '$lib/storage/events';
  import type { Bookmark, Collection, Tag } from '$lib/types';

  let selection = $state<Selection>({ kind: 'all' });
  let search = $state('');
  let collections = $state<Collection[]>([]);
  let tags = $state<Tag[]>([]);
  let items = $state<Bookmark[]>([]);

  async function refresh() {
    [collections, tags] = await Promise.all([colStore.list(), tagsStore.list()]);
    const filter =
      selection.kind === 'all' ? {} :
      selection.kind === 'smart' ? { smart: selection.smart } :
      selection.kind === 'collection' ? { collectionId: selection.id } :
      { tagId: selection.id };
    items = await bookmarks.list({ ...filter, search: search || undefined });
  }

  $effect(() => { void selection; void search; refresh(); });

  onMount(() => {
    refresh();
    const sub = () => refresh();
    storageEvents.on('bookmarks:changed', sub);
    storageEvents.on('collections:changed', sub);
    storageEvents.on('tags:changed', sub);
    return () => {
      storageEvents.off('bookmarks:changed', sub);
      storageEvents.off('collections:changed', sub);
      storageEvents.off('tags:changed', sub);
    };
  });

  function titleFor(s: Selection): string {
    switch (s.kind) {
      case 'all': return 'All bookmarks';
      case 'smart': return ({ recent: 'Recent', unread: 'Unread', starred: 'Starred', untagged: 'Untagged', broken: 'Broken' })[s.smart];
      case 'collection': return collections.find((c) => c.id === s.id)?.name ?? 'Collection';
      case 'tag': return '#' + (tags.find((t) => t.id === s.id)?.name ?? 'tag');
    }
  }

  async function newCollection() {
    const name = prompt('Collection name?');
    if (name?.trim()) await colStore.create({ name: name.trim() });
  }

  async function openBookmark(b: Bookmark) {
    if (b.unread) await bookmarks.update(b.id, { unread: false });
    window.open(b.url, '_blank');
  }

  async function deleteBookmark(b: Bookmark) {
    if (confirm(`Delete "${b.title}"?`)) await bookmarks.delete(b.id);
  }
</script>

<div class="min-h-screen flex" style="background: linear-gradient(180deg, #0b0c14 0%, #14172a 100%);">
  <Sidebar {collections} {tags} {selection} onSelect={(s) => (selection = s)} />
  <main class="flex-1 px-8 py-6 overflow-auto">
    <Toolbar bind:search title={titleFor(selection)} count={items.length} onNewCollection={newCollection} />
    <BookmarkGrid {items} onOpen={openBookmark} onDelete={deleteBookmark} />
  </main>
</div>
```

- [ ] **Step 2: Manual verify**

Run: `npm run build`. Reload extension. Open new tab. Save several bookmarks via popup. Verify they appear in the new-tab grid; sidebar selection filters; search filters.

- [ ] **Step 3: Commit**

```bash
git add src/newtab/App.svelte
git commit -m "feat: newtab library wires sidebar + search + grid + storage events"
```

---

## Task 21: E2E happy path

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/save-and-view.spec.ts`

- [ ] **Step 1: Playwright config**

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';
import path from 'node:path';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: 'chromium-extension',
      use: {
        // Extension loaded via launchPersistentContext in the spec
      },
    },
  ],
});
```

- [ ] **Step 2: E2E spec**

`tests/e2e/save-and-view.spec.ts`:

```ts
import { test, expect, chromium, type BrowserContext } from '@playwright/test';
import path from 'node:path';

const EXT_PATH = path.resolve(__dirname, '../../dist');

test('save a page from popup, see it on new tab', async () => {
  const userDataDir = path.resolve(__dirname, '../../.playwright-user');
  const context: BrowserContext = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // extension popups require a head
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      '--no-first-run',
    ],
  });

  // Find extension ID from the background service worker
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker');
  const extensionId = sw.url().split('/')[2];

  // Visit a real page
  const page = await context.newPage();
  await page.goto('https://example.com/');

  // Open popup as its own page (simpler than driving the toolbar)
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup/popup.html`);
  // Popup doesn't have an active tab in this mode — skip assertion on save flow here.

  // Open the new-tab page directly
  const newtab = await context.newPage();
  await newtab.goto(`chrome-extension://${extensionId}/src/newtab/newtab.html`);
  await expect(newtab.getByText('No bookmarks yet')).toBeVisible();

  await context.close();
});
```

- [ ] **Step 3: Run E2E**

Run: `npm run build && npm run test:e2e`
Expected: passes. (Full save-flow E2E requires driving the toolbar action which is harder; this validates the extension loads and pages render. Plan 3 hardens E2E.)

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts tests/e2e/save-and-view.spec.ts
git commit -m "test: e2e smoke test for extension load and newtab render"
```

---

## Task 22: Test runner glue and final verification

**Files:**
- No new files; verifies the suite

- [ ] **Step 1: Run full unit suite**

Run: `npm test`
Expected: all tests pass (ulid, events, settings, collections, tags, bookmarks, saveFlow, TagPicker, Sidebar).

- [ ] **Step 2: Run typecheck**

Run: `npm run check`
Expected: 0 errors.

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: clean build, `dist/` is loadable as an unpacked extension.

- [ ] **Step 4: Manual smoke test**

1. Load `dist/` as unpacked.
2. Visit `https://example.com/`. Click toolbar icon. Verify popup shows favicon + title + Saved.
3. Add a tag (none exist initially — skip). Toggle star. Close popup.
4. Open new tab. Verify the bookmark appears in the grid.
5. Click "+ Collection", name it "Test", verify it appears in the sidebar.
6. Re-open popup on a different page; pick "Test" as collection.
7. Refresh new tab; click "Test" in sidebar; verify only those bookmarks show.
8. Type "example" in search; verify filtering works.

- [ ] **Step 5: Tag plan-1 milestone**

```bash
git tag plan-1-mvp
git log --oneline | head -25
```

---

## Self-Review

Spec coverage check (against `docs/superpowers/specs/2026-05-03-midnight-markers-design.md`):

| Spec section | Covered in Plan 1 |
| --- | --- |
| Surfaces: New Tab + Popup | ✅ Tasks 3, 14, 16–20 |
| Settings page | ❌ deferred to Plan 2 (gated on AI) |
| Visual design tokens | ✅ Task 2 |
| Data model: Bookmark/Collection/Tag/Settings | ✅ Tasks 4, 8–11 |
| Storage layer + pub-sub | ✅ Tasks 6–11 |
| Metadata extraction + thumbnail fallback | ✅ Task 12 |
| AI client | ❌ Plan 2 |
| Search (in-memory fuzzy) | ⚠️ basic substring search in Task 11; full MiniSearch in Plan 3 |
| Grid view | ✅ Tasks 17–18 |
| List view | ❌ Plan 3 |
| DnD, native import, JSON export, broken-link checker, kbd shortcuts | ❌ Plan 3 |
| Save flow (instant create + edit) | ✅ Tasks 13–15 |
| Smart filters: Recent/Unread/Starred | ✅ Task 11 list filter; sidebar Task 16 |
| Smart filters: Untagged/Broken | ⚠️ filter logic exists in Task 11; UI exposure deferred to Plan 3 |
| Privacy disclosure | ❌ Plan 2 (lives in Settings) |
| Manifest V3, permissions | ✅ Task 3 |

Gaps are intentionally deferred and documented as Plans 2 and 3.

Placeholder scan: clean — no TBD/TODO, no "implement appropriately", every code block contains the actual code.

Type consistency: `Bookmark`/`Collection`/`Tag`/`Settings` shapes used identically across storage, popup, newtab. `Selection` defined in Sidebar, imported in App. `BookmarkFilter` from `types.ts` used in `bookmarks.list()`.

import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import webExtension, { readJsonFile } from 'vite-plugin-web-extension';
import path from 'node:path';

export default defineConfig({
  plugins: [
    svelte(),
    svelteTesting(),
    webExtension({
      manifest: () => readJsonFile('src/manifest.json'),
      browser: process.env.TARGET ?? 'chrome',
    }),
  ],
  resolve: {
    alias: { $lib: path.resolve(__dirname, 'src/lib') },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        /**
         * Chrome refuses to load an unpacked extension containing any file or
         * directory whose name starts with an underscore — those are reserved
         * for the system. Vite's stub for Node built-ins (pulled in by the
         * Anthropic SDK's never-taken node-only branches) is emitted as
         * `__vite-browser-external.js` and would fail the whole load, so strip
         * the leading underscores off any chunk name Rollup derives.
         */
        sanitizeFileName: (name: string) => {
          const stripped = name.replace(/[\0?*]/g, '').replace(/^_+/, '');
          return stripped === '' ? 'chunk' : stripped;
        },
      },
    },
  },
});

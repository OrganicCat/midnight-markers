import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import webExtension, { readJsonFile } from 'vite-plugin-web-extension';
import path from 'node:path';

/**
 * Which browser this build targets. It drives two things: the `{{chrome}}.` and
 * `{{firefox}}.` prefixed keys in src/manifest.json, which the plugin resolves
 * down to one manifest per browser, and where the build lands.
 *
 * Chrome keeps `dist/` so the e2e tests and the "load unpacked" instructions
 * don't have to care that a second target exists.
 */
const target = process.env.TARGET ?? 'chrome';

export default defineConfig({
  plugins: [
    svelte(),
    svelteTesting(),
    webExtension({
      manifest: () => readJsonFile('src/manifest.json'),
      browser: target,
    }),
  ],
  resolve: {
    alias: { $lib: path.resolve(__dirname, 'src/lib') },
  },
  build: {
    target: 'es2022',
    outDir: target === 'firefox' ? 'dist-firefox' : 'dist',
    emptyOutDir: true,
    /**
     * Sourcemaps are on for day-to-day builds and off for release builds.
     *
     * Two reasons to drop them from the uploaded package. They are roughly
     * three quarters of the build output, and one of them is emitted as
     * `virtual:temp.js.js.map` — a colon in a filename, which is illegal on
     * Windows and can break extraction of the store zip.
     */
    sourcemap: !process.env.MM_RELEASE,
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

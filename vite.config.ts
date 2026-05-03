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
  },
});

import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      setupFiles: ['./tests/setup.ts'],
      globals: true,
      exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
    },
  }),
);

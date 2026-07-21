import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import globals from 'globals';

/**
 * ESLint 9 flat config.
 *
 * Scope note: `npm run lint` targets `src` and `tests` only. Type-aware rules
 * (the `requiring-type-checking` set) are deliberately not enabled — they need
 * a full program per lint run, which is slow, and `npm run check` already runs
 * svelte-check over the whole project for type correctness. This config is for
 * the things the type checker does not catch.
 */
export default ts.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'test-results/**', '.svelte-kit/**'],
  },

  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2022,
        // Extension APIs, provided by the browser at runtime.
        chrome: 'readonly',
      },
    },
    rules: {
      // The codebase uses leading-underscore names for deliberate escape
      // hatches (_resetDbForTests) and for destructured values discarded on
      // purpose, which is exactly what this exempts.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'none',
          ignoreRestSiblings: true,
        },
      ],
      // `any` is worth flagging but not worth blocking a commit over; the
      // places it appears are narrowing casts on untrusted model output.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  {
    // `.svelte.ts` / `.svelte.js` are rune modules: TypeScript syntax that the
    // Svelte parser must handle, so they need the same parser pairing as
    // components — the Svelte parser out front, delegating to the TS parser.
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: ts.parser,
        extraFileExtensions: ['.svelte'],
      },
    },
  },

  {
    files: ['tests/**'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Tests reach into internals and construct deliberately malformed
      // payloads; non-null assertions on fixture data are the readable way to
      // do that and carry no production risk.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  {
    files: ['*.config.js', '*.config.ts', 'scripts/**'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
);

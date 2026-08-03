import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    runes: true,
    /**
     * How Svelte builds a DOM fragment before cloning it. The default, `html`,
     * assigns the markup to a `<template>` element's innerHTML. That is faster,
     * but it trips `web-ext lint` — AMO's validator flags every innerHTML
     * assignment it can't prove is sanitised, and it can't see that the string
     * is a compile-time constant.
     *
     * `tree` builds the fragment an element at a time instead. Slower in
     * principle, unmeasurable here: the largest component in this extension is
     * a few dozen nodes, and fragments are built once and cloned after that.
     *
     * Requires Svelte 5.33 or newer.
     */
    fragments: 'tree',
  },
};

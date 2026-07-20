<script lang="ts">
  import type { PreviewBadge, PreviewNode } from '$lib/ai/resort/types';
  import Self from './ResortTree.svelte';

  let {
    nodes,
    selected,
    onToggle,
    depth = 0,
  }: {
    nodes: PreviewNode[];
    selected: Set<string>;
    onToggle: (key: string) => void;
    depth?: number;
  } = $props();

  function badgeText(badge: PreviewBadge): string {
    switch (badge.kind) {
      case 'new': return 'new';
      case 'renamed': return `renamed from ${badge.from}`;
      case 'merged': return `merged from ${badge.from}`;
      case 'deleted': return 'will be deleted';
    }
  }

  function badgeClass(badge: PreviewBadge): string {
    switch (badge.kind) {
      case 'new': return 'bg-accent-teal/15 text-accent-teal';
      case 'renamed': return 'bg-accent-violet/15 text-accent-violet';
      case 'merged': return 'bg-accent-violet/15 text-accent-violet';
      case 'deleted': return 'bg-red-400/15 text-red-300';
    }
  }

  function origin(path: string[]): string {
    return path.length === 0 ? '← Unfiled' : `← ${path.join(' > ')}`;
  }
</script>

<ul class="list-none m-0 p-0">
  {#each nodes as node (node.id)}
    <li>
      <div
        class="flex items-center gap-2 py-1 rounded {node.changeKey ? '' : 'opacity-45'}"
        style="padding-left: {depth * 16}px"
      >
        {#if node.changeKey}
          <input
            type="checkbox"
            class="accent-accent-violet"
            checked={selected.has(node.changeKey)}
            aria-label="Include change to {node.name}"
            onchange={() => onToggle(node.changeKey!)}
          />
        {:else}
          <span class="w-[13px] shrink-0" aria-hidden="true"></span>
        {/if}
        <span class="text-sm {node.badge?.kind === 'deleted' ? 'line-through' : ''}">{node.name}</span>
        {#if node.badge}
          <span class="text-[0.625rem] uppercase tracking-wider px-1.5 py-0.5 rounded {badgeClass(node.badge)}">
            {badgeText(node.badge)}
          </span>
        {/if}
      </div>

      {#each node.bookmarks as b (b.id)}
        <div
          class="flex items-center gap-2 py-0.5 {b.changeKey ? '' : 'opacity-45'}"
          style="padding-left: {(depth + 1) * 16}px"
        >
          {#if b.changeKey}
            <input
              type="checkbox"
              class="accent-accent-violet"
              checked={selected.has(b.changeKey)}
              aria-label="Move {b.title}"
              onchange={() => onToggle(b.changeKey!)}
            />
          {:else}
            <span class="w-[13px] shrink-0" aria-hidden="true"></span>
          {/if}
          <span class="text-xs truncate">{b.title}</span>
          {#if b.fromPath}
            <span class="text-[0.6875rem] opacity-40 shrink-0">{origin(b.fromPath)}</span>
          {/if}
        </div>
      {/each}

      {#if node.children.length > 0}
        <Self nodes={node.children} {selected} {onToggle} depth={depth + 1} />
      {/if}
    </li>
  {/each}
</ul>

<script lang="ts">
  import { onMount, tick } from 'svelte';
  // Spotlight overlay: dims the page, cuts a hole around the current step's
  // target, and parks an explanatory card beside it.
  import { inflate, placeTooltip, centerTooltip, type Rect } from './geometry';
  import type { Tour } from './tour.svelte';

  let { tour }: { tour: Tour } = $props();

  const DEFAULT_PADDING = 8;

  let hole = $state<Rect | null>(null);
  let tipW = $state(320);
  let tipH = $state(160);
  let pos = $state({ x: 0, y: 0 });

  /**
   * Measure the current step's target and re-place the tooltip around it.
   * Deliberately reads no reactive state it also writes — the viewport is read
   * straight off `window` rather than kept in state, which would make the
   * effect below feed itself.
   */
  function measure(): void {
    const step = tour.current;
    if (!step) return;
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const tip = { width: tipW, height: tipH };

    const el = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null;
    if (!el) {
      // Either a deliberately targetless step, or a target that vanished
      // mid-run (the last bookmark was deleted). Both read best as a centered
      // card over a fully dimmed page.
      hole = null;
      pos = centerTooltip(tip, viewport);
      return;
    }

    const r = el.getBoundingClientRect();
    const next = inflate(
      { x: r.left, y: r.top, width: r.width, height: r.height },
      step.padding ?? DEFAULT_PADDING,
    );
    hole = next;
    const placed = placeTooltip(next, tip, viewport, step.placement);
    pos = { x: placed.x, y: placed.y };
  }

  /** Bring the target on screen before measuring, so the cutout isn't offscreen. */
  async function focusStep(): Promise<void> {
    const step = tour.current;
    if (step?.target) {
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    await tick();
    measure();
  }

  // Re-measure when the step changes, and again once the card has been laid
  // out — its real height decides whether the preferred side actually fits.
  $effect(() => {
    void tour.current;
    void tipW;
    void tipH;
    void focusStep();
  });

  onMount(() => {
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    // Capture phase: the page's own j/k/s/⌫ shortcuts live on document, and the
    // tour must eat arrow keys before they reach them.
    window.addEventListener('keydown', onKeydown, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
      window.removeEventListener('keydown', onKeydown, true);
    };
  });

  function onKeydown(e: KeyboardEvent): void {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        tour.end();
        break;
      case 'ArrowRight':
      case 'Enter':
      case ' ':
        e.preventDefault();
        e.stopPropagation();
        tour.next();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        e.stopPropagation();
        tour.prev();
        break;
    }
  }

  const step = $derived(tour.current);
</script>

{#if step}
  <!--
    The overlay swallows clicks so the tour can't be half-driven by the page
    underneath. Advancing is done from the card's buttons or the keyboard.
  -->
  <div
    class="fixed inset-0 z-[100]"
    role="dialog"
    aria-modal="true"
    aria-label="Guided tour"
    data-tour-overlay
  >
    <svg class="absolute inset-0 w-full h-full" aria-hidden="true">
      <defs>
        <mask id="tour-mask">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          {#if hole}
            <rect
              x={hole.x}
              y={hole.y}
              width={hole.width}
              height={hole.height}
              rx="10"
              fill="black"
            />
          {/if}
        </mask>
      </defs>
      <rect
        x="0"
        y="0"
        width="100%"
        height="100%"
        fill="rgba(6, 7, 14, 0.78)"
        mask="url(#tour-mask)"
      />
      {#if hole}
        <rect
          x={hole.x}
          y={hole.y}
          width={hole.width}
          height={hole.height}
          rx="10"
          fill="none"
          stroke="var(--color-accent-violet, #8b5cf6)"
          stroke-width="2"
        />
      {/if}
    </svg>

    <div
      bind:clientWidth={tipW}
      bind:clientHeight={tipH}
      class="absolute w-[20rem] max-w-[calc(100vw-1.5rem)] rounded-xl border border-white/10 bg-[#12131a] p-4 shadow-2xl"
      style="left: {pos.x}px; top: {pos.y}px;"
      data-tour-card
    >
      <div class="text-sm font-semibold tracking-tight mb-1.5">{step.title}</div>
      <p class="text-xs leading-relaxed opacity-75">{step.body}</p>

      <div class="mt-4 flex items-center gap-2">
        <div class="flex gap-1 mr-auto" aria-hidden="true">
          {#each tour.steps as s, i (s.id)}
            <span
              class="h-1.5 rounded-full transition-all {i === tour.index
                ? 'w-4 bg-accent-violet'
                : 'w-1.5 bg-white/20'}"
            ></span>
          {/each}
        </div>
        <button
          class="text-xs px-2 py-1 rounded opacity-50 hover:opacity-100 hover:bg-white/10"
          onclick={() => tour.end()}
          data-tour-skip
        >Skip</button>
        {#if tour.index > 0}
          <button
            class="text-xs px-2.5 py-1 rounded bg-white/5 hover:bg-white/10"
            onclick={() => tour.prev()}
          >Back</button>
        {/if}
        <button
          class="text-xs px-3 py-1 rounded bg-accent-violet/80 hover:bg-accent-violet text-white"
          onclick={() => tour.next()}
          data-tour-next
        >{tour.isLast ? 'Done' : 'Next'}</button>
      </div>

      <div class="mt-2 text-[0.625rem] opacity-35 text-right">
        {tour.index + 1} of {tour.steps.length} · ← → to move, Esc to close
      </div>
    </div>
  </div>
{/if}

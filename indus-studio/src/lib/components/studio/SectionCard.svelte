<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props {
    title?: string;
    description?: string;
    padded?: boolean;
    eyebrow?: string;
    children?: Snippet;
  }
  let { title = '', description = '', padded = true, eyebrow = '', children }: Props = $props();
</script>

<section class="rounded-2xl border border-surface-6 bg-surface-2 shadow-sm">
  {#if title || description}
    <header class="border-b border-surface-6 px-5 py-4">
      {#if eyebrow}<p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-10">{eyebrow}</p>{/if}
      {#if title}<h2 class="text-sm font-semibold text-surface-12">{title}</h2>{/if}
      {#if description}<p class="mt-1 text-xs text-surface-10">{description}</p>{/if}
    </header>
  {/if}
  <div class={padded ? 'p-5' : ''}>
    {#if children}
      {@render children()}
    {/if}
  </div>
</section>

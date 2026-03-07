<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    description?: string;
    children?: Snippet;
  }

  let { title, description = '', children }: Props = $props();
</script>

<section class="space-y-4">
  <div class="space-y-1">
    <h3 class="text-sm font-semibold uppercase tracking-[0.18em] text-surface-10">{title}</h3>
    {#if description}
      <p class="text-sm text-surface-10">{description}</p>
    {/if}
  </div>
  <div class="space-y-4">
    {@render children?.()}
  </div>
</section>

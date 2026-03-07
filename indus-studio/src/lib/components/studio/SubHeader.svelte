<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    description?: string;
    actions?: Snippet;
  }

  let { title, description = '', actions }: Props = $props();
</script>

<div class="flex flex-col gap-3 border-b border-surface-6 pb-4 md:flex-row md:items-end md:justify-between">
  <div class="space-y-1">
    <h2 class="text-lg font-semibold text-surface-12">{title}</h2>
    {#if description}
      <p class="text-sm text-surface-10">{description}</p>
    {/if}
  </div>
  {#if actions}
    <div class="flex flex-wrap items-center gap-2">
      {@render actions()}
    </div>
  {/if}
</div>

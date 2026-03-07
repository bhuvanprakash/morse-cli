<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props {
    title: string;
    message: string;
    actions?: Snippet;
    icon?: string;
  }
  let { title, message, actions, icon = '✦' }: Props = $props();
</script>

<div class="rounded-2xl border border-dashed border-surface-6 bg-surface-2 px-6 py-10 text-center">
  <div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10 text-lg text-orange-200">{icon}</div>
  <h3 class="text-base font-semibold text-surface-12">{title}</h3>
  <p class="mt-1 text-sm text-surface-10">{message}</p>
  {#if actions}
    <div class="mt-4 flex justify-center gap-2">{@render actions()}</div>
  {/if}
</div>

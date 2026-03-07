<script lang="ts">
  import UiModal from '$lib/components/ui/Modal.svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    open: boolean;
    title?: string;
    onclose?: () => void;
    children?: Snippet;
  }

  let { open = false, title = '', onclose, children }: Props = $props();
</script>

<UiModal {open} {onclose}>
  <div class="space-y-3 p-5">
    {#if title}
      <h3 class="text-lg font-semibold text-surface-12">{title}</h3>
    {/if}
    {@render children?.()}
  </div>
</UiModal>

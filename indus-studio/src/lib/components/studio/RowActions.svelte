<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    children?: Snippet;
  }

  let { children }: Props = $props();
</script>

<div class="flex flex-wrap items-center justify-end gap-2">
  {@render children?.()}
</div>

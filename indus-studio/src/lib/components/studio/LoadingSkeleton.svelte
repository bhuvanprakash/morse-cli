<script lang="ts">
  interface Props { lines?: number; }
  let { lines = 4 }: Props = $props();
</script>

<div class="space-y-2">
  {#each Array(lines) as _, i}
    <div class="h-4 animate-pulse rounded bg-gray-200 dark:bg-gray-800" style={`width:${Math.max(50, 100 - i * 7)}%`}></div>
  {/each}
</div>

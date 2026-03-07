<script lang="ts">
  interface Item { key: string; value: string | number | boolean | null | undefined; }
  interface Props { items: Item[]; }
  let { items = [] }: Props = $props();
</script>

<dl class="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
  {#each items as item}
    <div class="grid grid-cols-2 gap-2 px-3 py-2 text-sm">
      <dt class="text-gray-500 dark:text-gray-400">{item.key}</dt>
      <dd class="font-medium text-gray-900 dark:text-gray-100 break-all">{String(item.value ?? '-')}</dd>
    </div>
  {/each}
</dl>

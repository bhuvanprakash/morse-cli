<script lang="ts">
  interface TabItem { key: string; label: string; }
  interface Props {
    tabs: TabItem[];
    active: string;
    onChange?: (key: string) => void;
  }
  let { tabs = [], active = '', onChange }: Props = $props();
</script>

<nav class="flex gap-4 border-b border-gray-200 dark:border-gray-800">
  {#each tabs as tab}
    <button
      class={`border-b-2 px-1 py-2 text-sm font-medium ${active === tab.key ? 'border-orange-500 text-gray-900 dark:text-gray-100' : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'}`}
      onclick={() => onChange?.(tab.key)}
    >
      {tab.label}
    </button>
  {/each}
</nav>

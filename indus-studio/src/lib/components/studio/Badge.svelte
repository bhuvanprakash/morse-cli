<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props {
    tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
    text?: string;
    children?: Snippet;
  }
  let { tone = 'default', text = '', children }: Props = $props();
  const cls = {
    default: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    success: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    warning: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    danger: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  };
</script>
<span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls[tone]}`}>
  {#if children}
    {@render children()}
  {:else}
    {text}
  {/if}
</span>

<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props {
    label: string;
    value: string | number;
    hint?: string;
    trend?: string;
    trendTone?: 'neutral' | 'good' | 'warn' | 'bad';
    after?: Snippet;
  }
  let { label, value, hint = '', trend = '', trendTone = 'neutral', after }: Props = $props();
  const toneClass = {
    neutral: 'text-gray-500 dark:text-gray-400',
    good: 'text-green-600 dark:text-green-400',
    warn: 'text-amber-600 dark:text-amber-400',
    bad: 'text-red-600 dark:text-red-400',
  };
</script>

<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
  <p class="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
  <div class="mt-2 flex items-end justify-between gap-3">
    <div class="flex items-end gap-3">
      <p class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
      {#if after}
        <div class="pb-1">
          {@render after()}
        </div>
      {/if}
    </div>
    {#if trend}
      <span class={`text-sm font-medium ${toneClass[trendTone]}`}>{trend}</span>
    {/if}
  </div>
  {#if hint}
    <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p>
  {/if}
</div>

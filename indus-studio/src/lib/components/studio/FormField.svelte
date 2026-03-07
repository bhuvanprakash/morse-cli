<script lang="ts">
  import type { Snippet } from 'svelte';
  interface Props { label: string; hint?: string; required?: boolean; inputId?: string; error?: string; children?: Snippet; }
  let { label, hint = '', required = false, inputId = '', error = '', children }: Props = $props();
</script>

<div class="space-y-1">
  <label class="block text-sm font-medium text-surface-11" for={inputId || undefined}>
    {label}{#if required}<span class="ml-1 text-red-600">*</span>{/if}
  </label>
  {#if children}
    {@render children()}
  {/if}
  {#if hint}
    <p class="text-xs text-surface-10">{hint}</p>
  {/if}
  {#if error}
    <p class="text-xs text-red-300">{error}</p>
  {/if}
</div>

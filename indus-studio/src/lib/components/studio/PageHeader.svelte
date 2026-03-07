<script lang="ts">
  import type { Snippet } from 'svelte';
  import Breadcrumbs from './Breadcrumbs.svelte';
  type BreadcrumbItem = { label: string; href?: string };
  interface Props {
    title: string;
    description?: string;
    actions?: Snippet;
    eyebrow?: string;
    breadcrumbs?: BreadcrumbItem[];
    testId?: string;
  }
  let { title, description = '', actions, eyebrow = '', breadcrumbs = [], testId = '' }: Props = $props();
</script>

<div class="mb-6 flex items-start justify-between gap-4" data-testid={testId || undefined}>
  <div class="space-y-2">
    {#if breadcrumbs.length > 0}
      <Breadcrumbs items={breadcrumbs} />
    {/if}
    {#if eyebrow}
      <p class="text-xs font-semibold uppercase tracking-[0.18em] text-surface-10">{eyebrow}</p>
    {/if}
    <h1 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
    {#if description}
      <p class="mt-1 text-sm text-gray-600 dark:text-gray-400">{description}</p>
    {/if}
  </div>
  {#if actions}
    <div class="flex items-center gap-2">
      {@render actions()}
    </div>
  {/if}
</div>

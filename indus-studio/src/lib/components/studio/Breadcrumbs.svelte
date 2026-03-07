<script lang="ts">
  interface BreadcrumbItem {
    label: string;
    href?: string;
  }

  interface Props {
    items?: BreadcrumbItem[];
  }

  let { items = [] }: Props = $props();
</script>

{#if items.length > 0}
  <nav aria-label="Breadcrumb" class="flex flex-wrap items-center gap-2 text-xs text-surface-10">
    {#each items as item, index}
      {#if index > 0}
        <span aria-hidden="true">/</span>
      {/if}
      {#if item.href && index < items.length - 1}
        <a href={item.href} class="transition hover:text-surface-12">{item.label}</a>
      {:else}
        <span class="text-surface-11">{item.label}</span>
      {/if}
    {/each}
  </nav>
{/if}

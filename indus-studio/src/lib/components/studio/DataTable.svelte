<script lang="ts">
  interface Column {
    key: string;
    label: string;
    width?: string;
  }
  interface Props {
    columns: Column[];
    rows: Record<string, unknown>[];
    loading?: boolean;
    emptyText?: string;
    rowKey?: string;
    onRowClick?: (row: Record<string, unknown>) => void;
    cellRenderers?: Record<string, (row: Record<string, unknown>) => string>;
    caption?: string;
    testId?: string;
  }
  let {
    columns = [],
    rows = [],
    loading = false,
    emptyText = 'No data',
    rowKey = 'id',
    onRowClick,
    cellRenderers = {},
    caption = '',
    testId = '',
  }: Props = $props();

  function renderCell(col: Column, row: Record<string, unknown>): string {
    const custom = cellRenderers[col.key];
    if (custom) {
      return custom(row);
    }
    const value = row[col.key];
    if (value === null || value === undefined || value === '') {
      return '-';
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }
</script>

<div class="overflow-auto rounded-2xl border border-surface-6 bg-surface-2" data-testid={testId || undefined}>
  <table class="min-w-full text-sm">
    {#if caption}
      <caption class="sr-only">{caption}</caption>
    {/if}
    <thead class="sticky top-0 bg-surface-3">
      <tr>
        {#each columns as col}
          <th class="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-surface-10" style={col.width ? `width:${col.width}` : ''}>{col.label}</th>
        {/each}
      </tr>
    </thead>
    <tbody class="divide-y divide-surface-6">
      {#if loading}
        <tr><td colspan={columns.length} class="px-3 py-8 text-center text-surface-10">Loading...</td></tr>
      {:else if rows.length === 0}
        <tr><td colspan={columns.length} class="px-3 py-8 text-center text-surface-10">{emptyText}</td></tr>
      {:else}
        {#each rows as row, index (String(row[rowKey] ?? index))}
          <tr class={onRowClick ? 'cursor-pointer hover:bg-surface-3/60' : ''} onclick={() => onRowClick?.(row)}>
            {#each columns as col}
              <td class="px-3 py-3 text-surface-12">{renderCell(col, row)}</td>
            {/each}
          </tr>
        {/each}
      {/if}
    </tbody>
  </table>
</div>

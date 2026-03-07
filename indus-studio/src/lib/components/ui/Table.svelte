<script lang="ts" generics="T extends Record<string, unknown>">
	interface Column {
		key: string;
		header: string;
		cell?: (row: T) => string;
		width?: string;
		sortable?: boolean;
	}

	interface Props {
		columns: Column[];
		data: T[];
		loading?: boolean;
		emptyMessage?: string;
		onRowClick?: (row: T) => void;
		sortColumn?: string;
		sortDirection?: 'asc' | 'desc';
		onSort?: (column: string, direction: 'asc' | 'desc') => void;
	}

	let {
		columns,
		data,
		loading = false,
		emptyMessage = 'No data available',
		onRowClick,
		sortColumn,
		sortDirection = 'asc',
		onSort
	}: Props = $props();

	function handleSort(column: Column) {
		if (!column.sortable || !onSort) return;
		
		const newDirection = sortColumn === column.key && sortDirection === 'asc' ? 'desc' : 'asc';
		onSort(column.key, newDirection);
	}

	function formatCell(row: T, column: Column): string {
		if (column.cell) {
			return column.cell(row);
		}
		const value = row[column.key];
		if (value === null || value === undefined) return '-';
		if (typeof value === 'object') return JSON.stringify(value);
		return String(value);
	}
</script>

<div class="overflow-x-auto rounded-lg border border-surface-6">
	<table class="w-full text-sm text-left">
		<thead class="bg-surface-3 text-surface-12 font-medium">
			<tr>
				{#each columns as column}
					<th
						class="px-4 py-3 whitespace-nowrap {column.sortable ? 'cursor-pointer hover:bg-surface-4' : ''}"
						style={column.width ? `width: ${column.width}` : ''}
						onclick={() => handleSort(column)}
					>
						<div class="flex items-center gap-1">
							{column.header}
							{#if column.sortable}
								<span class="text-surface-10">
									{#if sortColumn === column.key}
										{sortDirection === 'asc' ? '↑' : '↓'}
									{:else}
										⇅
									{/if}
								</span>
								{/if}
							</div>
						</th>
					{/each}
				</tr>
			</thead>
			<tbody class="divide-y divide-surface-6">
				{#if loading}
					<tr>
						<td colspan={columns.length} class="px-4 py-8 text-center text-surface-10">
							<div class="flex items-center justify-center gap-2">
								<svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
								</svg>
								Loading...
							</div>
						</td>
					</tr>
				{:else if data.length === 0}
					<tr>
						<td colspan={columns.length} class="px-4 py-8 text-center text-surface-10">
							{emptyMessage}
						</td>
					</tr>
				{:else}
					{#each data as row, i}
						<tr
							class="bg-surface-1 hover:bg-surface-2 transition-colors {onRowClick ? 'cursor-pointer' : ''}"
							onclick={() => onRowClick?.(row)}
						>
							{#each columns as column}
								<td class="px-4 py-3 text-surface-12 whitespace-nowrap overflow-hidden text-ellipsis max-w-xs">
									{formatCell(row, column)}
								</td>
							{/each}
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

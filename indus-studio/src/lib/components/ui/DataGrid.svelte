<script lang="ts" module>
	export interface ColumnDef<T> {
		accessorKey: keyof T & string;
		header: string;
		cell?: (value: unknown, row: T) => string;
	}
</script>

<script lang="ts" generics="T extends Record<string, unknown>">

	interface Props {
		data: T[];
		columns: ColumnDef<T>[];
		loading?: boolean;
		pageSize?: number;
	}

	let { data, columns, loading = false, pageSize = 25 }: Props = $props();
	let pageIndex = $state(0);

	const pageCount = $derived(Math.max(1, Math.ceil(data.length / pageSize)));
	const pageRows = $derived(data.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize));

	function previousPage() {
		pageIndex = Math.max(0, pageIndex - 1);
	}

	function nextPage() {
		pageIndex = Math.min(pageCount - 1, pageIndex + 1);
	}
</script>

<div class="rounded-lg border border-surface-6 overflow-hidden">
	<div class="overflow-x-auto">
		<table class="w-full text-sm text-left">
			<thead class="bg-surface-3 text-surface-12 font-medium">
				<tr>
					{#each columns as column}
						<th class="px-4 py-3 whitespace-nowrap">{column.header}</th>
					{/each}
				</tr>
			</thead>
			<tbody class="divide-y divide-surface-6">
				{#if loading}
					<tr>
						<td colspan={columns.length} class="px-4 py-8 text-center text-surface-10">Loading...</td>
					</tr>
				{:else}
					{#each pageRows as row}
						<tr class="bg-surface-1 hover:bg-surface-2 transition-colors">
							{#each columns as column}
								<td class="px-4 py-3 text-surface-12 whitespace-nowrap overflow-hidden text-ellipsis max-w-xs">
									{column.cell ? column.cell(row[column.accessorKey], row) : String(row[column.accessorKey] ?? '')}
								</td>
							{/each}
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	<div class="flex items-center justify-between px-4 py-3 bg-surface-2 border-t border-surface-6">
		<div class="text-sm text-surface-11">Page {pageIndex + 1} of {pageCount}</div>
		<div class="flex items-center gap-2">
			<button class="px-3 py-1 text-sm rounded bg-surface-3 text-surface-12 hover:bg-surface-4 disabled:opacity-50" onclick={previousPage} disabled={pageIndex === 0}>Previous</button>
			<button class="px-3 py-1 text-sm rounded bg-surface-3 text-surface-12 hover:bg-surface-4 disabled:opacity-50" onclick={nextPage} disabled={pageIndex >= pageCount - 1}>Next</button>
		</div>
	</div>
</div>

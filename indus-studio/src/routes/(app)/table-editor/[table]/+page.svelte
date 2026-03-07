<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { studioApi } from '$lib/api/studio';
	import { toastStore } from '$stores/toast';
	import PageHeader from '$lib/components/studio/PageHeader.svelte';
	import SectionCard from '$lib/components/studio/SectionCard.svelte';
	import SearchInput from '$lib/components/studio/SearchInput.svelte';
	import EmptyState from '$lib/components/studio/EmptyState.svelte';
	import ErrorState from '$lib/components/studio/ErrorState.svelte';
	import LoadingSkeleton from '$lib/components/studio/LoadingSkeleton.svelte';
	import JsonViewer from '$lib/components/studio/JsonViewer.svelte';
	import SlideOver from '$lib/components/studio/SlideOver.svelte';
	import { Button } from '$components/ui';

	const tableName = $derived($page.params.table);

	let rows = $state<Array<Record<string, unknown>>>([]);
	let columns = $state<string[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let query = $state('');
	let pageNo = $state(1);
	let limit = $state(50);
	let totalPages = $state(1);
	let totalRows = $state(0);
	let hasNext = $state(false);
	let hasPrev = $state(false);
	let selectedRow = $state<Record<string, unknown> | null>(null);
	let detailOpen = $state(false);

	const filteredRows = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return rows;
		return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(q));
	});

	async function loadRows() {
		loading = true;
		error = null;
		try {
			const payload = await studioApi.listTableRows(tableName, pageNo, limit);
			rows = payload.data ?? [];
			columns = rows.length ? Object.keys(rows[0]) : [];
			totalRows = Number(payload.meta?.total ?? rows.length);
			totalPages = Number(payload.meta?.total_pages ?? 1);
			hasNext = Boolean(payload.meta?.has_next);
			hasPrev = Boolean(payload.meta?.has_prev);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load rows';
			toastStore.error(error);
		} finally {
			loading = false;
		}
	}

	function openRow(row: Record<string, unknown>) {
		selectedRow = row;
		detailOpen = true;
	}

	onMount(() => {
		void loadRows();
	});
</script>

<div class="space-y-6">
	<PageHeader title={tableName} description="Live table rows via REST API">
		{#snippet actions()}
			<Button variant="secondary" size="sm" onclick={() => goto('/table-editor')}>Back</Button>
			<Button variant="secondary" size="sm" onclick={() => void loadRows()}>Refresh</Button>
		{/snippet}
	</PageHeader>

	<SectionCard title="Rows" description={`Page ${pageNo} of ${totalPages} • ${totalRows} total rows`}>
		<div class="space-y-4">
			<SearchInput value={query} placeholder="Search within loaded rows..." oninput={(value) => (query = value)} />

			{#if loading}
				<LoadingSkeleton lines={10} />
			{:else if error}
				<ErrorState title="Could not load rows" message={error} onRetry={() => void loadRows()} />
			{:else if rows.length === 0}
				<EmptyState title="No rows yet" message="This table exists but currently has no records." />
			{:else}
				<div class="overflow-x-auto rounded-xl border border-surface-6 bg-surface-2">
					<table class="min-w-full text-sm">
						<thead class="bg-surface-3 text-surface-11">
							<tr>
								{#each columns as column}
									<th class="px-4 py-3 text-left">{column}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each filteredRows as row, idx (String(row.id ?? idx))}
								<tr class="border-t border-surface-6 hover:bg-surface-3/50 cursor-pointer" onclick={() => openRow(row)}>
									{#each columns as column}
										<td class="max-w-[22rem] truncate px-4 py-2 text-surface-12">
											{#if row[column] == null}
												-
											{:else if typeof row[column] === 'object'}
												{JSON.stringify(row[column])}
											{:else}
												{String(row[column])}
											{/if}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="flex items-center justify-between">
					<p class="text-xs text-surface-10">Showing {filteredRows.length} rows on this page</p>
					<div class="flex items-center gap-2">
						<Button
							size="sm"
							variant="secondary"
							disabled={!hasPrev || loading}
							onclick={() => {
								pageNo -= 1;
								void loadRows();
							}}
						>
							Previous
						</Button>
						<Button
							size="sm"
							variant="secondary"
							disabled={!hasNext || loading}
							onclick={() => {
								pageNo += 1;
								void loadRows();
							}}
						>
							Next
						</Button>
					</div>
				</div>
			{/if}
		</div>
	</SectionCard>

	<SlideOver
		open={detailOpen}
		onclose={() => {
			detailOpen = false;
		}}
		title="Row details"
	>
		{#if selectedRow}
			<JsonViewer value={selectedRow} maxHeight="32rem" />
		{/if}
	</SlideOver>
</div>

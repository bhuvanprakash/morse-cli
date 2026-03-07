<script lang="ts">
	import { onMount } from 'svelte';
	import { Button, CodeEditor } from '$components/ui';
	import { toastStore } from '$stores/toast';
	import { studioApi } from '$lib/api/studio';
	import PageHeader from '$lib/components/studio/PageHeader.svelte';
	import SectionCard from '$lib/components/studio/SectionCard.svelte';
	import EmptyState from '$lib/components/studio/EmptyState.svelte';
	import ErrorState from '$lib/components/studio/ErrorState.svelte';
	import StatusBadge from '$lib/components/studio/StatusBadge.svelte';

	let query = $state('SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 20;');
	let columns = $state<string[]>([]);
	let rows = $state<Array<Array<unknown>>>([]);
	let loading = $state(false);
	let executionTime = $state(0);
	let error = $state<string | null>(null);
	let rowCount = $state(0);

	const sampleQueries = [
		'SELECT id, email, created_at FROM users ORDER BY created_at DESC LIMIT 20;',
		'SELECT COUNT(*) AS total_users FROM users;',
		'SELECT status, COUNT(*) AS count FROM notifications GROUP BY status ORDER BY count DESC;',
		'SELECT NOW() AT TIME ZONE \'Asia/Kolkata\' AS ist_time;'
	];

	function loadSampleQuery(q: string) {
		query = q;
	}

	async function executeQuery() {
		const sql = query.trim();
		if (!sql) {
			toastStore.error('Enter a SQL query');
			return;
		}

		loading = true;
		error = null;
		const startedAt = performance.now();
		try {
			const result = await studioApi.executeSQL(sql);
			columns = result.columns ?? [];
			rows = result.rows ?? [];
			rowCount = Number(result.count ?? rows.length);
			executionTime = Math.round(performance.now() - startedAt);
			toastStore.success(`Query executed in ${executionTime}ms`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Query execution failed';
			columns = [];
			rows = [];
			rowCount = 0;
			toastStore.error(error);
		} finally {
			loading = false;
		}
	}

	function exportResults() {
		if (!rows.length || !columns.length) return;
		const csvRows = [
			columns.join(','),
			...rows.map((r) =>
				r
					.map((cell) => {
						const text = cell == null ? '' : String(cell);
						return `"${text.replaceAll('"', '""')}"`;
					})
					.join(',')
			)
		];
		const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `query_results_${Date.now()}.csv`;
		link.click();
		URL.revokeObjectURL(url);
	}

	function onGlobalKeydown(event: KeyboardEvent) {
		if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
			event.preventDefault();
			void executeQuery();
		}
	}

	onMount(() => {
		document.addEventListener('keydown', onGlobalKeydown);
		return () => {
			document.removeEventListener('keydown', onGlobalKeydown);
		};
	});
</script>

<div class="space-y-6">
	<PageHeader title="SQL Editor" description="Run administrative SQL queries with live execution and export support.">
		{#snippet actions()}
			<Button variant="secondary" onclick={exportResults} disabled={rows.length === 0}>Export CSV</Button>
			<Button variant="primary" {loading} onclick={() => void executeQuery()}>Run Query (Ctrl/Cmd+Enter)</Button>
		{/snippet}
	</PageHeader>

	<SectionCard title="Query" description="Use admin SQL endpoints for controlled execution.">
		<div class="space-y-4">
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-xs text-surface-10">Samples:</span>
				{#each sampleQueries as sample}
					<Button variant="ghost" size="sm" onclick={() => loadSampleQuery(sample)}>
						{sample.length > 52 ? `${sample.slice(0, 52)}...` : sample}
					</Button>
				{/each}
			</div>

			<CodeEditor bind:value={query} language="sql" />
		</div>
	</SectionCard>

	<SectionCard title="Results" description="Live result set from /meta/query">
		<div class="space-y-4">
			{#if loading}
				<div class="rounded-lg border border-surface-6 p-6 text-sm text-surface-10">Running query...</div>
			{:else if error}
				<ErrorState title="Query failed" message={error} onRetry={() => void executeQuery()} />
			{:else if rows.length === 0}
				<EmptyState title="No rows returned yet" message="Run a query to inspect result rows and column metadata." />
			{:else}
				<div class="flex items-center gap-2">
					<StatusBadge status="success" />
					<span class="text-sm text-surface-11">{rowCount} rows • {executionTime}ms</span>
				</div>
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
							{#each rows as row, rowIndex (rowIndex)}
								<tr class="border-t border-surface-6">
									{#each row as cell, colIndex (colIndex)}
										<td class="px-4 py-2 text-surface-12">{cell == null ? '-' : String(cell)}</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</SectionCard>
</div>

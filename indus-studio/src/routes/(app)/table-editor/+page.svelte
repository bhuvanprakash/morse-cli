<script lang="ts">
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
	import { Button } from '$components/ui';

	type TableRow = { name: string; schema: string };

	let tables = $state<TableRow[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let query = $state('');

	const filteredTables = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return tables;
		return tables.filter((table) => table.name.toLowerCase().includes(q));
	});

	function openTable(name: string) {
		goto(`/table-editor/${name}`);
	}

	async function loadTables() {
		loading = true;
		error = null;
		try {
			const list = await studioApi.listTables();
			tables = list.map((name) => ({ name, schema: 'public' }));
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load tables';
			toastStore.error(error);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		void loadTables();
	});
</script>

<div class="space-y-6">
	<PageHeader title="Table Editor" description="Browse project tables and open row-level editing views.">
		{#snippet actions()}
			<Button variant="secondary" size="sm" onclick={() => void loadTables()}>Refresh</Button>
		{/snippet}
	</PageHeader>

	<SectionCard title="Tables" description="Table inventory from live GraphQL schema introspection.">
		<div class="space-y-4">
			<SearchInput value={query} placeholder="Search tables..." oninput={(value) => (query = value)} />

			{#if loading}
				<LoadingSkeleton lines={8} />
			{:else if error}
				<ErrorState title="Could not load tables" message={error} onRetry={() => void loadTables()} />
			{:else if filteredTables.length === 0}
				<EmptyState title="No tables found" message="Create your first table from SQL editor or migrations to see it here." />
			{:else}
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
					{#each filteredTables as table}
						<button
							type="button"
							class="text-left rounded-xl border border-surface-6 bg-surface-2 p-5 transition hover:border-accent-8 hover:bg-surface-3"
							onclick={() => openTable(table.name)}
						>
							<div class="flex items-center justify-between">
								<div class="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-3 text-accent-11">📋</div>
								<span class="text-xs text-surface-10">{table.schema}</span>
							</div>
							<h3 class="mt-4 text-lg font-semibold text-surface-12">{table.name}</h3>
							<p class="mt-2 text-xs text-surface-10">Open table details</p>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</SectionCard>
</div>

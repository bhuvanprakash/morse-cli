<script lang="ts">
	import { onMount } from 'svelte';
	import { studioApi, type AuditFilters } from '$lib/api/studio';
	import { contextStore } from '$lib/stores/context';
	import { pageOffset, createPagination, totalPages } from '$lib/utils/pagination';
	import { formatDateTime } from '$lib/utils/format';
	import { prettyJson } from '$lib/utils/json';
	import { toastStore } from '$stores/toast';
	import PageHeader from '$lib/components/studio/PageHeader.svelte';
	import SectionCard from '$lib/components/studio/SectionCard.svelte';
	import StatCard from '$lib/components/studio/StatCard.svelte';
	import StatusBadge from '$lib/components/studio/StatusBadge.svelte';
	import SlideOver from '$lib/components/studio/SlideOver.svelte';
	import ErrorState from '$lib/components/studio/ErrorState.svelte';
	import EmptyState from '$lib/components/studio/EmptyState.svelte';
	import LoadingSkeleton from '$lib/components/studio/LoadingSkeleton.svelte';
	import JsonViewer from '$lib/components/studio/JsonViewer.svelte';

	let loading = $state(false);
	let error = $state('');
	let events = $state<Array<Record<string, any>>>([]);
	let summary = $state<Record<string, any>>({});
	let selected = $state<Record<string, any> | null>(null);
	let detailOpen = $state(false);

	let filters = $state<AuditFilters>({
		project_id: '',
		actor: '',
		action: '',
		resource_type: '',
		severity: '',
		from: '',
		to: '',
		limit: 50,
		offset: 0
	});

	let pagination = $state(createPagination({ page: 1, pageSize: 50, total: 0 }));

	const hasPrev = $derived(pagination.page > 1);
	const hasNext = $derived(events.length >= pagination.pageSize);
	const pages = $derived(totalPages(pagination));

	function normalizeFilters(): AuditFilters {
		return {
			project_id: filters.project_id || contextStore.activeProjectId || undefined,
			actor: filters.actor || undefined,
			action: filters.action || undefined,
			resource_type: filters.resource_type || undefined,
			severity: filters.severity || undefined,
			from: filters.from ? `${filters.from}T00:00:00Z` : undefined,
			to: filters.to ? `${filters.to}T23:59:59Z` : undefined,
			limit: pagination.pageSize,
			offset: pageOffset(pagination)
		};
	}

	async function loadSummary() {
		summary = (await studioApi.getAuditSummary()) ?? {};
	}

	async function loadEvents() {
		loading = true;
		error = '';
		try {
			const rows = await studioApi.listAuditEvents(normalizeFilters());
			events = rows ?? [];
			pagination.total = pagination.page * pagination.pageSize + (rows.length < pagination.pageSize ? rows.length : pagination.pageSize);
			if (!selected && rows.length > 0) {
				selected = rows[0];
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load audit events';
			toastStore.error(error);
		} finally {
			loading = false;
		}
	}

	async function refreshAll() {
		loading = true;
		error = '';
		try {
			await Promise.all([loadSummary(), loadEvents()]);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load audit data';
			toastStore.error(error);
		} finally {
			loading = false;
		}
	}

	function openDetails(event: Record<string, any>) {
		selected = event;
		detailOpen = true;
	}

	function quickFilter(kind: 'auth' | 'billing' | 'security') {
		if (kind === 'auth') {
			filters = { ...filters, action: '', resource_type: 'auth_session', severity: '' };
		}
		if (kind === 'billing') {
			filters = { ...filters, action: '', resource_type: 'billing', severity: '' };
		}
		if (kind === 'security') {
			filters = { ...filters, action: '', resource_type: '', severity: 'critical' };
		}
		pagination.page = 1;
		loadEvents();
	}

	async function exportAudit(format: 'json' | 'csv') {
		try {
			await studioApi.downloadAuditExport(format, normalizeFilters());
			toastStore.success(`Audit ${format.toUpperCase()} export downloaded`);
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Export failed');
		}
	}

	function applyFilters() {
		pagination.page = 1;
		loadEvents();
	}

	function nextPage() {
		if (!hasNext) return;
		pagination.page += 1;
		loadEvents();
	}

	function prevPage() {
		if (!hasPrev) return;
		pagination.page -= 1;
		loadEvents();
	}

	onMount(async () => {
		await contextStore.ensureLoaded();
		if (!filters.project_id && contextStore.activeProjectId) {
			filters.project_id = contextStore.activeProjectId;
		}
		await refreshAll();
	});
</script>

<div class="space-y-6" data-testid="audit-page">
	<PageHeader title="Audit Logs" description="Immutable, filterable activity trail across auth, config, security, and operational actions." >
		{#snippet actions()}
			<div class="flex gap-2">
				<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={() => exportAudit('json')} data-testid="audit-export-json">Export JSON</button>
				<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={() => exportAudit('csv')} data-testid="audit-export-csv">Export CSV</button>
				<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={refreshAll} disabled={loading} data-testid="audit-refresh">
					{loading ? 'Refreshing...' : 'Refresh'}
				</button>
			</div>
		{/snippet}
	</PageHeader>

	{#if error}
		<ErrorState message={error} onRetry={refreshAll} />
	{/if}

	<div class="grid gap-4 md:grid-cols-4">
		<StatCard label="Total Events" value={String(summary.total_events ?? 0)} hint="Current audit retention window" />
		<StatCard label="Last 24h" value={String(summary.last_24h ?? 0)} hint="Recent operator and system actions" />
		<StatCard label="Errors" value={String(summary.errors ?? 0)} hint="Events with error severity" trend={summary.errors ? 'attention' : 'quiet'} trendTone={summary.errors ? 'warn' : 'good'} />
		<StatCard label="Critical" value={String(summary.critical ?? 0)} hint="Security and production-impacting events" trend={summary.critical ? 'urgent' : 'healthy'} trendTone={summary.critical ? 'bad' : 'good'} />
	</div>

	<SectionCard title="Filters" description="Narrow events by project, actor, action, severity, and timeframe.">
		<div class="space-y-3">
			<div class="grid gap-3 md:grid-cols-7">
				<label class="field">
					<span>Project</span>
					<input bind:value={filters.project_id} placeholder="project-id" data-testid="audit-project-filter" />
				</label>
				<label class="field">
					<span>Actor</span>
					<input bind:value={filters.actor} placeholder="email / user id" data-testid="audit-actor-filter" />
				</label>
				<label class="field">
					<span>Action</span>
					<input bind:value={filters.action} placeholder="create_project" data-testid="audit-action-filter" />
				</label>
				<label class="field">
					<span>Resource Type</span>
					<input bind:value={filters.resource_type} placeholder="feature_flag" data-testid="audit-resource-filter" />
				</label>
				<label class="field">
					<span>Severity</span>
					<select bind:value={filters.severity} data-testid="audit-severity-filter">
						<option value="">All</option>
						<option value="info">info</option>
						<option value="warn">warn</option>
						<option value="error">error</option>
						<option value="critical">critical</option>
					</select>
				</label>
				<label class="field">
					<span>From</span>
					<input type="date" bind:value={filters.from} data-testid="audit-from-filter" />
				</label>
				<label class="field">
					<span>To</span>
					<input type="date" bind:value={filters.to} data-testid="audit-to-filter" />
				</label>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={applyFilters} data-testid="audit-apply-filters">Apply Filters</button>
				<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={() => quickFilter('auth')}>Auth Events</button>
				<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={() => quickFilter('billing')}>Billing Changes</button>
				<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={() => quickFilter('security')}>Security Actions</button>
			</div>
		</div>
	</SectionCard>

	<SectionCard title="Events" description="Click any row to inspect full metadata and context.">
		<div class="space-y-3">
			<div class="overflow-x-auto">
				<table class="min-w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 text-left text-gray-500">
							<th class="px-2 py-2">Time</th>
							<th class="px-2 py-2">Severity</th>
							<th class="px-2 py-2">Action</th>
							<th class="px-2 py-2">Resource</th>
							<th class="px-2 py-2">Actor</th>
						</tr>
					</thead>
					<tbody>
						{#if loading}
							<tr><td class="px-2 py-4 text-gray-500" colspan="5"><LoadingSkeleton lines={4} /></td></tr>
						{:else if events.length === 0}
							<tr><td class="px-2 py-4 text-gray-500" colspan="5"><EmptyState title="No matching events" message="Try widening the time range or clearing one of the filters." /></td></tr>
						{:else}
							{#each events as event}
								<tr class="cursor-pointer border-b border-gray-100 hover:bg-gray-50" onclick={() => openDetails(event)} data-testid={`audit-event-${event.id}`}>
									<td class="px-2 py-2 text-gray-500">{formatDateTime(event.created_at)}</td>
									<td class="px-2 py-2"><StatusBadge status={String(event.severity ?? 'info')} /></td>
									<td class="px-2 py-2 font-medium">{event.action}</td>
									<td class="px-2 py-2">{event.resource_type}</td>
									<td class="px-2 py-2">{event.actor_email || event.actor_user_id || '-'}</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
			<div class="flex items-center justify-between">
				<p class="text-xs text-gray-500">Page {pagination.page} of {pages}</p>
				<div class="flex gap-2">
					<button class="rounded border px-3 py-1 text-xs" onclick={prevPage} disabled={!hasPrev} data-testid="audit-prev-page">Previous</button>
					<button class="rounded border px-3 py-1 text-xs" onclick={nextPage} disabled={!hasNext} data-testid="audit-next-page">Next</button>
				</div>
			</div>
		</div>
	</SectionCard>
</div>

<SlideOver open={detailOpen} title="Audit Event Details" onclose={() => (detailOpen = false)}>
	{#if selected}
		<div class="space-y-3 text-sm">
			<div><strong>ID:</strong> <span class="font-mono text-xs">{selected.id}</span></div>
			<div><strong>Action:</strong> {selected.action}</div>
			<div><strong>Severity:</strong> <StatusBadge status={String(selected.severity || 'info')} /></div>
			<div><strong>Resource:</strong> {selected.resource_type} ({selected.resource_id})</div>
			<div><strong>Actor:</strong> {selected.actor_email || selected.actor_user_id || '-'}</div>
			<div><strong>IP:</strong> {selected.ip_address || '-'}</div>
			<div><strong>User Agent:</strong> {selected.user_agent || '-'}</div>
			<div><strong>Created:</strong> {formatDateTime(selected.created_at)}</div>
			<div>
				<strong>Metadata:</strong>
				<div class="mt-2">
					<JsonViewer value={selected.metadata || {}} maxHeight="18rem" />
				</div>
			</div>
		</div>
	{/if}
</SlideOver>

<style>
	.field { display: flex; flex-direction: column; gap: 0.3rem; }
	.field span { font-size: 0.75rem; color: #64748b; }
	input, select {
		border: 1px solid #cbd5e1;
		border-radius: 0.6rem;
		padding: 0.5rem 0.65rem;
		font-size: 0.875rem;
	}
</style>

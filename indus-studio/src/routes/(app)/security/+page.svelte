<script lang="ts">
	import { onMount } from 'svelte';
	import { studioApi } from '$lib/api/studio';
	import { contextStore } from '$lib/stores/context';
	import { auth } from '$stores/auth';
	import { toastStore } from '$stores/toast';
	import PageHeader from '$lib/components/studio/PageHeader.svelte';
	import SectionCard from '$lib/components/studio/SectionCard.svelte';
	import StatCard from '$lib/components/studio/StatCard.svelte';
	import EmptyState from '$lib/components/studio/EmptyState.svelte';
	import ErrorState from '$lib/components/studio/ErrorState.svelte';
	import LoadingSkeleton from '$lib/components/studio/LoadingSkeleton.svelte';
	import StatusBadge from '$lib/components/studio/StatusBadge.svelte';
	import SlideOver from '$lib/components/studio/SlideOver.svelte';
	import JsonViewer from '$lib/components/studio/JsonViewer.svelte';
	import { formatDateTime, formatNumber } from '$lib/utils/format';

	type ScanRun = {
		id: string;
		scan_type: string;
		tool_name: string;
		status: string;
		summary: Record<string, unknown>;
		report_url?: string;
		started_at?: string;
		completed_at?: string;
		created_at: string;
	};

	let loading = $state(false);
	let error = $state('');
	let summary = $state<Record<string, unknown>>({});
	let runs = $state<ScanRun[]>([]);
	let selectedRun = $state<ScanRun | null>(null);
	let showDetails = $state(false);

	let filters = $state({
		scan_type: '',
		status: '',
		tool: '',
		from: '',
		to: '',
		q: ''
	});

	const isAdminView = $derived.by(() => {
		const role = String(auth.user?.role ?? '').toLowerCase();
		return role === 'admin' || role === 'owner';
	});

	const summaryCards = $derived.by(() => {
		const keys = ['dependency', 'container', 'secret_scan', 'sbom'];
		return keys.map((key) => {
			const data = (summary?.[key] ?? {}) as Record<string, unknown>;
			return {
				key,
				status: String(data.status ?? 'unknown'),
				issues: Number(data.issues ?? 0)
			};
		});
	});

	const filteredRuns = $derived.by(() => {
		const query = filters.q.trim().toLowerCase();
		const fromTime = filters.from ? new Date(filters.from).getTime() : 0;
		const toTime = filters.to ? new Date(filters.to + 'T23:59:59').getTime() : Number.MAX_SAFE_INTEGER;

		return runs.filter((run) => {
			if (filters.scan_type && run.scan_type !== filters.scan_type) return false;
			if (filters.status && run.status !== filters.status) return false;
			if (filters.tool && run.tool_name !== filters.tool) return false;
			const created = new Date(run.created_at).getTime();
			if (Number.isFinite(fromTime) && created < fromTime) return false;
			if (Number.isFinite(toTime) && created > toTime) return false;
			if (query) {
				const haystack = `${run.scan_type} ${run.tool_name} ${run.status} ${JSON.stringify(run.summary || {})}`.toLowerCase();
				if (!haystack.includes(query)) return false;
			}
			return true;
		});
	});

	const availableTypes = $derived.by(() => Array.from(new Set(runs.map((run) => run.scan_type))).sort());
	const availableTools = $derived.by(() => Array.from(new Set(runs.map((run) => run.tool_name))).sort());
	const remediationTips = $derived.by(() => {
		const tips = summary?.remediation_tips;
		return Array.isArray(tips) ? tips.map((tip) => String(tip)) : [];
	});

	const sbomLinks = $derived.by(() => {
		const links = new Map<string, string>();
		for (const run of runs) {
			if (run.report_url && run.scan_type.toLowerCase().includes('sbom')) {
				links.set(run.tool_name || run.id, run.report_url);
			}
		}
		if (links.size === 0) {
			links.set('CycloneDX', '/artifacts/sbom/cyclonedx.json');
			links.set('Syft SPDX', '/artifacts/sbom/syft.spdx.json');
		}
		return Array.from(links.entries()).map(([label, href]) => ({ label, href }));
	});

	function statusTone(status: string): string {
		const s = status.toLowerCase();
		if (s === 'success' || s === 'passed') return 'ok';
		if (s === 'warning' || s === 'partial') return 'warning';
		if (s === 'failed' || s === 'error') return 'critical';
		return 'unknown';
	}

	async function load() {
		loading = true;
		error = '';
		try {
			const [summaryData, runsData] = await Promise.all([
				studioApi.getSecurityScanSummary(),
				studioApi.listSecurityScanRuns()
			]);
			summary = summaryData ?? {};
			runs = (runsData ?? []).map((row) => ({
				id: String(row.id ?? ''),
				scan_type: String(row.scan_type ?? ''),
				tool_name: String(row.tool_name ?? ''),
				status: String(row.status ?? 'unknown'),
				summary: (row.summary as Record<string, unknown>) ?? {},
				report_url: row.report_url ? String(row.report_url) : undefined,
				started_at: row.started_at ? String(row.started_at) : undefined,
				completed_at: row.completed_at ? String(row.completed_at) : undefined,
				created_at: String(row.created_at ?? '')
			}));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load security scans';
			toastStore.error(error);
		} finally {
			loading = false;
		}
	}

	function openRun(run: ScanRun) {
		selectedRun = run;
		showDetails = true;
	}

	onMount(async () => {
		await contextStore.ensureLoaded();
		await load();
	});
</script>

<div class="space-y-6" data-testid="security-page">
	<PageHeader title="Security Scanning" description="Track dependency, container, secret, and SBOM scan posture with actionable findings.">
		{#snippet actions()}
			<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={load} disabled={loading} data-testid="security-refresh">
				{loading ? 'Refreshing...' : 'Refresh'}
			</button>
		{/snippet}
	</PageHeader>

	{#if !isAdminView}
		<div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
			Read-only security view. Admin/owner role is required for remediation actions in related systems.
		</div>
	{/if}

	{#if error}
		<ErrorState message={error} onRetry={load} />
	{/if}

	<div class="grid gap-4 md:grid-cols-4">
		{#each summaryCards as card}
			<StatCard
				label={card.key.replace('_', ' ')}
				value={formatNumber(card.issues)}
				hint="open issues"
				trend={card.status}
				trendTone={card.status === 'failed' ? 'bad' : card.status === 'warning' ? 'warn' : 'good'}
			/>
		{/each}
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<SectionCard title="Scan Runs" description="Filter by tool, scan type, status, and date range.">
			<div class="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
				<input class="input" bind:value={filters.q} placeholder="Search findings, tool, or status" data-testid="security-search" />
				<select class="input" bind:value={filters.scan_type} data-testid="security-scan-type">
					<option value="">All scan types</option>
					{#each availableTypes as type}
						<option value={type}>{type}</option>
					{/each}
				</select>
				<select class="input" bind:value={filters.tool} data-testid="security-tool">
					<option value="">All tools</option>
					{#each availableTools as tool}
						<option value={tool}>{tool}</option>
					{/each}
				</select>
				<select class="input" bind:value={filters.status} data-testid="security-status">
					<option value="">All statuses</option>
					<option value="success">success</option>
					<option value="warning">warning</option>
					<option value="failed">failed</option>
				</select>
				<input class="input" type="date" bind:value={filters.from} data-testid="security-from" />
				<input class="input" type="date" bind:value={filters.to} data-testid="security-to" />
			</div>

			<div class="mt-4 overflow-x-auto">
				{#if loading}
					<LoadingSkeleton lines={8} />
				{:else if filteredRuns.length === 0}
					<EmptyState title="No scan runs" message="No scan entries match the selected filters." />
				{:else}
					<table class="min-w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 text-left text-gray-500">
								<th class="px-2 py-2">Type</th>
								<th class="px-2 py-2">Tool</th>
								<th class="px-2 py-2">Status</th>
								<th class="px-2 py-2">Issues</th>
								<th class="px-2 py-2">Created</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredRuns as run}
								<tr class="cursor-pointer border-b border-gray-100 hover:bg-gray-50" onclick={() => openRun(run)} data-testid={`security-run-${run.id}`}>
									<td class="px-2 py-2">{run.scan_type}</td>
									<td class="px-2 py-2">{run.tool_name}</td>
									<td class="px-2 py-2"><StatusBadge status={statusTone(run.status)} /></td>
									<td class="px-2 py-2">{formatNumber(Number(run.summary?.issues ?? 0))}</td>
									<td class="px-2 py-2 text-gray-500">{formatDateTime(run.created_at)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		</SectionCard>

		<SectionCard title="SBOM & Reports" description="Download software bill of materials and scan reports.">
			<div class="space-y-3">
				{#each sbomLinks as link}
					<a href={link.href} target="_blank" rel="noreferrer" class="block rounded-md border border-orange-300 px-3 py-2 text-sm text-orange-700 hover:bg-orange-50" data-testid={`security-report-${link.label.toLowerCase().replaceAll(' ', '-')}`}>
						{link.label}
					</a>
				{/each}
			</div>
		</SectionCard>

		<SectionCard title="Remediation Guidance" description="Operational guidance generated from the latest scan posture.">
			{#if remediationTips.length === 0}
				<EmptyState title="No tips available" message="Summary payload has no remediation recommendations." />
			{:else}
				<ul class="list-disc space-y-2 pl-5 text-sm text-gray-700">
					{#each remediationTips as tip}
						<li>{tip}</li>
					{/each}
				</ul>
			{/if}
		</SectionCard>
	</div>
</div>

<SlideOver open={showDetails} title="Scan Run Details" onclose={() => (showDetails = false)}>
	{#snippet children()}
		{#if selectedRun}
			<div class="space-y-3" data-testid="security-run-details">
				<div class="grid gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm md:grid-cols-2">
					<div><strong>Run ID:</strong> <span class="font-mono text-xs">{selectedRun.id}</span></div>
					<div><strong>Status:</strong> {selectedRun.status}</div>
					<div><strong>Scan Type:</strong> {selectedRun.scan_type}</div>
					<div><strong>Tool:</strong> {selectedRun.tool_name}</div>
					<div><strong>Started:</strong> {formatDateTime(selectedRun.started_at)}</div>
					<div><strong>Completed:</strong> {formatDateTime(selectedRun.completed_at)}</div>
				</div>
				{#if selectedRun.report_url}
					<a class="inline-block rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" href={selectedRun.report_url} target="_blank" rel="noreferrer">Open Report</a>
				{/if}
				<JsonViewer value={selectedRun.summary} maxHeight="18rem" />
			</div>
		{/if}
	{/snippet}
</SlideOver>

<style>
	.input {
		border: 1px solid #cbd5e1;
		border-radius: 0.5rem;
		padding: 0.5rem 0.65rem;
		font-size: 0.875rem;
	}
	.input:focus {
		outline: 2px solid rgba(249, 115, 22, 0.2);
		outline-offset: 1px;
		border-color: #f97316;
	}
</style>

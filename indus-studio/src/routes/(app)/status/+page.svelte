<script lang="ts">
	import { onMount } from 'svelte';
	import { studioApi } from '$lib/api/studio';
	import { confirmDialog } from '$lib/stores/confirm';
	import { toastStore } from '$stores/toast';
	import { formatDateTime } from '$lib/utils/format';
	import PageHeader from '$lib/components/studio/PageHeader.svelte';
	import SectionCard from '$lib/components/studio/SectionCard.svelte';
	import StatusBadge from '$lib/components/studio/StatusBadge.svelte';
	import Tabs from '$lib/components/studio/Tabs.svelte';
	import { getDocsUrl } from '$lib/utils/urls';

	let loading = $state(false);
	let error = $state('');
	let tab = $state<'overview' | 'incidents' | 'maintenance'>('overview');

	let components = $state<Array<Record<string, any>>>([]);
	let incidents = $state<Array<Record<string, any>>>([]);
	let maintenance = $state<Array<Record<string, any>>>([]);
	let subscriberEmail = $state('');
	let subscriberCount = $state(0);

	let newIncident = $state({
		title: '',
		summary: '',
		severity: 'minor',
		impact: 'low',
		status: 'investigating'
	});

	let incidentTimeline = $state<Record<string, string>>({});

	let newMaintenance = $state({
		title: '',
		description: '',
		starts_at: '',
		ends_at: ''
	});

	const tabs = [
		{ key: 'overview', label: 'Overview' },
		{ key: 'incidents', label: 'Incidents' },
		{ key: 'maintenance', label: 'Maintenance' }
	];

	const activeIncidents = $derived.by(() => incidents.filter((row) => String(row.status || '').toLowerCase() !== 'resolved'));
	const componentHealth = $derived.by(() => {
		const degraded = components.filter((row) => String(row.status || '').toLowerCase() !== 'operational').length;
		return { total: components.length, degraded };
	});

	async function loadAll() {
		loading = true;
		error = '';
		try {
			const [publicData, allIncidents, maintenanceList] = await Promise.all([
				studioApi.getStatusPublic(),
				studioApi.listIncidents(),
				studioApi.listMaintenance()
			]);
			components = (publicData.components ?? []) as Array<Record<string, any>>;
			const publicIncidents = (publicData.incidents ?? []) as Array<Record<string, any>>;
			const merged = [...(allIncidents ?? []), ...publicIncidents];
			const dedup = new Map<string, Record<string, any>>();
			for (const item of merged) dedup.set(String(item.id), item);
			incidents = Array.from(dedup.values()).sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
			maintenance = (maintenanceList ?? []) as Array<Record<string, any>>;
			subscriberCount = Number((publicData.subscribers_count as number) || subscriberCount || 0);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load status data';
			toastStore.error(error);
		} finally {
			loading = false;
		}
	}

	async function createIncident() {
		if (!newIncident.title.trim() || !newIncident.summary.trim()) {
			toastStore.error('Incident title and summary are required');
			return;
		}
		try {
			await studioApi.createIncident(newIncident);
			toastStore.success('Incident created');
			newIncident = { title: '', summary: '', severity: 'minor', impact: 'low', status: 'investigating' };
			await loadAll();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Create incident failed');
		}
	}

	async function appendTimeline(incident: Record<string, any>) {
		const note = incidentTimeline[String(incident.id)]?.trim();
		if (!note) {
			toastStore.error('Timeline note is required');
			return;
		}
		const existing = Array.isArray(incident.timeline) ? incident.timeline : [];
		const timeline = [
			...existing,
			{ timestamp: new Date().toISOString(), status: String(incident.status || 'investigating'), message: note }
		];
		try {
			await studioApi.updateIncident(String(incident.id), { timeline });
			incidentTimeline[String(incident.id)] = '';
			toastStore.success('Incident timeline updated');
			await loadAll();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to update timeline');
		}
	}

	async function resolveIncident(incident: Record<string, any>) {
		const ok = await confirmDialog.open({
			title: 'Resolve Incident',
			message: `Resolve incident "${incident.title}"?`,
			confirmText: 'Resolve',
			variant: 'danger'
		});
		if (!ok) return;
		try {
			await studioApi.resolveIncident(String(incident.id), { resolution: 'Resolved via Studio control plane' });
			toastStore.success('Incident resolved');
			await loadAll();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Resolve failed');
		}
	}

	async function scheduleMaintenance() {
		if (!newMaintenance.title.trim() || !newMaintenance.starts_at || !newMaintenance.ends_at) {
			toastStore.error('Maintenance title, start, and end time are required');
			return;
		}
		try {
			await studioApi.createMaintenance(newMaintenance);
			toastStore.success('Maintenance window scheduled');
			newMaintenance = { title: '', description: '', starts_at: '', ends_at: '' };
			await loadAll();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Schedule maintenance failed');
		}
	}

	async function subscribe() {
		if (!subscriberEmail.trim()) return;
		try {
			await studioApi.subscribeStatus(subscriberEmail.trim());
			subscriberEmail = '';
			subscriberCount += 1;
			toastStore.success('Subscriber added');
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Subscribe failed');
		}
	}

	onMount(loadAll);
</script>

<div class="space-y-6" data-testid="status-page">
	<PageHeader title="Status & Incident Ops" description="Operate component health, incident timelines, maintenance windows, and public updates." >
		{#snippet actions()}
			<div class="flex gap-2">
				<a class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" href={getDocsUrl('/status')} target="_blank" rel="noreferrer">Public Status Page</a>
				<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={loadAll} disabled={loading}>
					{loading ? 'Refreshing...' : 'Refresh'}
				</button>
			</div>
		{/snippet}
	</PageHeader>

	{#if error}
		<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
	{/if}

	<Tabs tabs={tabs} active={tab} onChange={(key) => (tab = key as typeof tab)} />

	{#if tab === 'overview'}
		<div class="grid gap-4 md:grid-cols-4">
			<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-xs uppercase text-gray-500">Components</p>
				<p class="mt-2 text-2xl font-semibold text-gray-900">{componentHealth.total}</p>
			</div>
			<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-xs uppercase text-gray-500">Degraded</p>
				<p class="mt-2 text-2xl font-semibold text-gray-900">{componentHealth.degraded}</p>
			</div>
			<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-xs uppercase text-gray-500">Active Incidents</p>
				<p class="mt-2 text-2xl font-semibold text-gray-900">{activeIncidents.length}</p>
			</div>
			<div class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
				<p class="text-xs uppercase text-gray-500">Subscribers</p>
				<p class="mt-2 text-2xl font-semibold text-gray-900">{subscriberCount}</p>
			</div>
		</div>

		<SectionCard title="Component Health Grid" description="Current service availability for public status.">
			<div class="grid gap-3 md:grid-cols-3">
				{#if components.length === 0}
					<p class="text-sm text-gray-500">No component health records available.</p>
				{:else}
					{#each components as component}
						<div class="rounded-md border border-gray-200 p-3">
							<p class="text-sm font-semibold">{component.name || component.slug}</p>
							<div class="mt-2"><StatusBadge status={component.status || 'unknown'} /></div>
						</div>
					{/each}
				{/if}
			</div>
		</SectionCard>
	{/if}

	{#if tab === 'incidents'}
		<SectionCard title="Create Incident" description="Declare incidents with severity and impact for public communication.">
			<div class="grid gap-3 md:grid-cols-2">
				<input bind:value={newIncident.title} placeholder="Incident title" data-testid="incident-title-input" />
				<select bind:value={newIncident.severity}>
					<option value="minor">minor</option>
					<option value="major">major</option>
					<option value="critical">critical</option>
				</select>
				<textarea class="md:col-span-2" rows="3" bind:value={newIncident.summary} placeholder="Summary"></textarea>
				<select bind:value={newIncident.impact}>
					<option value="low">low impact</option>
					<option value="medium">medium impact</option>
					<option value="high">high impact</option>
				</select>
				<select bind:value={newIncident.status}>
					<option value="investigating">investigating</option>
					<option value="identified">identified</option>
					<option value="monitoring">monitoring</option>
				</select>
			</div>
			<div class="mt-3 flex justify-end">
				<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={createIncident} data-testid="create-incident-submit">Create Incident</button>
			</div>
		</SectionCard>

		<SectionCard title="Incident Timeline" description="Append updates and resolve incidents with clear customer-visible messaging.">
			<div class="space-y-3">
				{#if incidents.length === 0}
					<p class="text-sm text-gray-500">No incidents yet.</p>
				{:else}
					{#each incidents as incident}
						<div class="rounded-md border border-gray-200 p-3">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<div>
									<p class="font-semibold">{incident.title}</p>
									<p class="text-xs text-gray-500">{formatDateTime(incident.started_at || incident.created_at)}</p>
								</div>
								<div class="flex items-center gap-2">
									<StatusBadge status={incident.severity || 'minor'} />
									<StatusBadge status={incident.status || 'investigating'} />
								</div>
							</div>
							<p class="mt-2 text-sm text-gray-700">{incident.summary}</p>
							<div class="mt-3 grid gap-2 md:grid-cols-[1fr,auto,auto]">
								<input bind:value={incidentTimeline[String(incident.id)]} placeholder="Add timeline update..." />
								<button class="rounded border px-3 py-2 text-xs" onclick={() => appendTimeline(incident)}>Add Update</button>
								{#if String(incident.status || '').toLowerCase() !== 'resolved'}
									<button class="rounded border border-red-300 px-3 py-2 text-xs text-red-700" onclick={() => resolveIncident(incident)}>Resolve</button>
								{/if}
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</SectionCard>
	{/if}

	{#if tab === 'maintenance'}
		<SectionCard title="Schedule Maintenance" description="Plan maintenance windows in IST and notify subscribers.">
			<div class="grid gap-3 md:grid-cols-2">
				<input bind:value={newMaintenance.title} placeholder="Maintenance title" />
				<textarea rows="2" bind:value={newMaintenance.description} placeholder="Description"></textarea>
				<label class="field">
					<span>Starts At (Asia/Kolkata)</span>
					<input type="datetime-local" bind:value={newMaintenance.starts_at} />
				</label>
				<label class="field">
					<span>Ends At (Asia/Kolkata)</span>
					<input type="datetime-local" bind:value={newMaintenance.ends_at} />
				</label>
			</div>
			<div class="mt-3 flex justify-end">
				<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={scheduleMaintenance}>Schedule</button>
			</div>
		</SectionCard>

		<SectionCard title="Maintenance Windows" description="Upcoming and recent maintenance entries.">
			<div class="space-y-2">
				{#if maintenance.length === 0}
					<p class="text-sm text-gray-500">No maintenance windows scheduled.</p>
				{:else}
					{#each maintenance as row}
						<div class="rounded-md border border-gray-200 p-3">
							<div class="flex flex-wrap items-center justify-between gap-2">
								<p class="font-semibold">{row.title}</p>
								<StatusBadge status={row.status || 'scheduled'} />
							</div>
							<p class="mt-1 text-sm text-gray-700">{row.description || '-'}</p>
							<p class="mt-1 text-xs text-gray-500">{formatDateTime(row.starts_at)} → {formatDateTime(row.ends_at)}</p>
						</div>
					{/each}
				{/if}
			</div>
		</SectionCard>

		<SectionCard title="Subscribers" description="Email subscribers receive incident and maintenance updates.">
			<div class="flex gap-2">
				<input class="w-full" bind:value={subscriberEmail} placeholder="ops@example.com" />
				<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={subscribe}>Add Subscriber</button>
			</div>
		</SectionCard>
	{/if}
</div>

<style>
	.field { display: flex; flex-direction: column; gap: 0.3rem; }
	.field span { font-size: 0.78rem; color: #64748b; }
	input, select, textarea {
		border: 1px solid #cbd5e1;
		border-radius: 0.6rem;
		padding: 0.55rem 0.7rem;
		font-size: 0.875rem;
	}
</style>

<script lang="ts">
	import { onMount } from 'svelte';
	import { studioApi } from '$lib/api/studio';
	import { confirmDialog } from '$lib/stores/confirm';
	import { toastStore } from '$stores/toast';
	import { auth } from '$stores/auth';
	import { formatDate } from '$lib/utils/format';
	import PageHeader from '$lib/components/studio/PageHeader.svelte';
	import SectionCard from '$lib/components/studio/SectionCard.svelte';
	import StatusBadge from '$lib/components/studio/StatusBadge.svelte';
	import { getDocsUrl } from '$lib/utils/urls';

	let loading = $state(false);
	let error = $state('');

	let settings = $state({
		public_status_text: 'All systems operational',
		security_contact_email: 'security@indusbase.com',
		faq: [] as Array<{ q: string; a: string }>
	});
	let subprocessors = $state<Array<Record<string, any>>>([]);
	let milestones = $state<Array<Record<string, any>>>([]);
	let publicIncidents = $state<Array<Record<string, any>>>([]);

	let subForm = $state({ name: '', purpose: '', region: 'ap-south-1', website: '', data_types: 'logs,metrics' });
	let milestoneForm = $state({ framework: '', target_date: '', status: 'planned', notes: '' });
	let incidentForm = $state({ title: '', summary: '', severity: 'info', impact: '', postmortem_url: '' });

	const canManage = $derived.by(() => {
		const role = String(auth.user?.role ?? '').toLowerCase();
		return role === 'admin' || role === 'owner';
	});

	function addFAQ() {
		settings.faq = [...settings.faq, { q: '', a: '' }];
	}

	function removeFAQ(index: number) {
		settings.faq = settings.faq.filter((_, idx) => idx !== index);
	}

	async function loadAll() {
		loading = true;
		error = '';
		try {
			const [settingsData, subData, milestoneData, incidentData] = await Promise.all([
				studioApi.getTrustCenterSettings(),
				studioApi.listSubprocessors(),
				studioApi.listComplianceMilestones(),
				studioApi.listPublicIncidents()
			]);

			settings = {
				public_status_text: String(settingsData.public_status_text || 'All systems operational'),
				security_contact_email: String(settingsData.security_contact_email || 'security@indusbase.com'),
				faq: Array.isArray(settingsData.faq) ? settingsData.faq : []
			};
			subprocessors = subData ?? [];
			milestones = milestoneData ?? [];
			publicIncidents = incidentData ?? [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load trust center data';
			toastStore.error(error);
		} finally {
			loading = false;
		}
	}

	async function saveSettings() {
		if (!canManage) {
			toastStore.error('Read-only mode: admin/owner role required');
			return;
		}
		try {
			await studioApi.updateTrustCenterSettings(settings);
			toastStore.success('Trust center settings updated');
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Save failed');
		}
	}

	async function addSubprocessor() {
		if (!canManage) {
			toastStore.error('Read-only mode: admin/owner role required');
			return;
		}
		if (!subForm.name.trim() || !subForm.purpose.trim()) {
			toastStore.error('Subprocessor name and purpose are required');
			return;
		}
		try {
			await studioApi.createSubprocessor({
				name: subForm.name.trim(),
				purpose: subForm.purpose.trim(),
				region: subForm.region.trim() || 'ap-south-1',
				website: subForm.website.trim(),
				data_types: subForm.data_types
					.split(',')
					.map((item) => item.trim())
					.filter(Boolean)
			});
			toastStore.success('Subprocessor added');
			subForm = { name: '', purpose: '', region: 'ap-south-1', website: '', data_types: 'logs,metrics' };
			await loadAll();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Add subprocessor failed');
		}
	}

	async function deleteSubprocessor(row: Record<string, any>) {
		if (!canManage) {
			toastStore.error('Read-only mode: admin/owner role required');
			return;
		}
		const ok = await confirmDialog.open({
			title: 'Delete Subprocessor',
			message: `Remove subprocessor "${row.name}"?`,
			confirmText: 'Delete',
			variant: 'danger'
		});
		if (!ok) return;
		try {
			await studioApi.deleteSubprocessor(String(row.id));
			toastStore.success('Subprocessor removed');
			await loadAll();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Delete failed');
		}
	}

	async function addMilestone() {
		if (!canManage) {
			toastStore.error('Read-only mode: admin/owner role required');
			return;
		}
		if (!milestoneForm.framework.trim()) {
			toastStore.error('Framework is required');
			return;
		}
		try {
			await studioApi.createComplianceMilestone(milestoneForm);
			toastStore.success('Compliance milestone added');
			milestoneForm = { framework: '', target_date: '', status: 'planned', notes: '' };
			await loadAll();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Create milestone failed');
		}
	}

	async function deleteMilestone(row: Record<string, any>) {
		if (!canManage) {
			toastStore.error('Read-only mode: admin/owner role required');
			return;
		}
		const ok = await confirmDialog.open({
			title: 'Delete Milestone',
			message: `Delete milestone "${row.framework}"?`,
			confirmText: 'Delete',
			variant: 'danger'
		});
		if (!ok) return;
		try {
			await studioApi.deleteComplianceMilestone(String(row.id));
			toastStore.success('Milestone removed');
			await loadAll();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Delete milestone failed');
		}
	}

	async function addPublicIncident() {
		if (!canManage) {
			toastStore.error('Read-only mode: admin/owner role required');
			return;
		}
		if (!incidentForm.title.trim() || !incidentForm.summary.trim()) {
			toastStore.error('Incident title and summary are required');
			return;
		}
		try {
			await studioApi.createPublicIncident(incidentForm);
			toastStore.success('Public incident added');
			incidentForm = { title: '', summary: '', severity: 'info', impact: '', postmortem_url: '' };
			await loadAll();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Create incident failed');
		}
	}

	async function deletePublicIncident(row: Record<string, any>) {
		if (!canManage) {
			toastStore.error('Read-only mode: admin/owner role required');
			return;
		}
		const ok = await confirmDialog.open({
			title: 'Delete Public Incident',
			message: `Delete public incident "${row.title}"?`,
			confirmText: 'Delete',
			variant: 'danger'
		});
		if (!ok) return;
		try {
			await studioApi.deletePublicIncident(String(row.id));
			toastStore.success('Public incident removed');
			await loadAll();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Delete incident failed');
		}
	}

	onMount(loadAll);
</script>

<div class="space-y-6">
	<PageHeader title="Trust Center" description="Manage public security posture, compliance roadmap, subprocessors, and incident transparency." >
		{#snippet actions()}
			<div class="flex gap-2">
				<a class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" href="/audit?action=update_trust_center" target="_self">Audit Links</a>
				<a class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" href={getDocsUrl('/trust-center')} target="_blank" rel="noreferrer">Preview Public Page</a>
				<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={loadAll} disabled={loading}>
					{loading ? 'Refreshing...' : 'Refresh'}
				</button>
			</div>
		{/snippet}
	</PageHeader>

	{#if error}
		<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
	{/if}
	{#if !canManage}
		<div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Read-only mode enabled. Admin/owner role required for edits and publishing actions.</div>
	{/if}

	<SectionCard title="Public Settings" description="Control top-level trust center text and security contact information.">
		<div class="space-y-3">
			<label class="field">
				<span>Public Status Text</span>
				<input bind:value={settings.public_status_text} />
			</label>
			<label class="field">
				<span>Security Contact Email</span>
				<input bind:value={settings.security_contact_email} />
			</label>
			<div class="rounded border border-gray-200 p-3">
				<div class="mb-2 flex items-center justify-between">
					<p class="text-sm font-semibold">Security FAQ</p>
					<button class="rounded border px-2 py-1 text-xs" onclick={addFAQ}>Add FAQ</button>
				</div>
				<div class="space-y-2">
					{#if settings.faq.length === 0}
						<p class="text-xs text-gray-500">No FAQ entries added yet.</p>
					{:else}
						{#each settings.faq as faq, idx}
							<div class="grid gap-2 md:grid-cols-[1fr,2fr,auto]">
								<input bind:value={settings.faq[idx].q} placeholder="Question" />
								<input bind:value={settings.faq[idx].a} placeholder="Answer" />
								<button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onclick={() => removeFAQ(idx)}>Remove</button>
							</div>
						{/each}
					{/if}
				</div>
			</div>
			<div class="flex justify-end">
				<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={saveSettings}>Save / Publish</button>
			</div>
		</div>
	</SectionCard>

	<SectionCard title="Subprocessors" description="Maintain vendor transparency for customer due diligence.">
		<div class="space-y-3">
			<div class="grid gap-2 md:grid-cols-5">
				<input bind:value={subForm.name} placeholder="Name" />
				<input bind:value={subForm.purpose} placeholder="Purpose" />
				<input bind:value={subForm.region} placeholder="Region (ap-south-1)" />
				<input bind:value={subForm.website} placeholder="Website" />
				<input bind:value={subForm.data_types} placeholder="Data types (comma separated)" />
			</div>
			<div class="flex justify-end">
				<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={addSubprocessor}>Add Subprocessor</button>
			</div>
			<div class="overflow-x-auto">
				<table class="min-w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 text-left text-gray-500">
							<th class="px-2 py-2">Name</th>
							<th class="px-2 py-2">Purpose</th>
							<th class="px-2 py-2">Region</th>
							<th class="px-2 py-2">Data Types</th>
							<th class="px-2 py-2">Status</th>
							<th class="px-2 py-2">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#if subprocessors.length === 0}
							<tr><td class="px-2 py-4 text-gray-500" colspan="6">No subprocessors configured.</td></tr>
						{:else}
							{#each subprocessors as sub}
								<tr class="border-b border-gray-100">
									<td class="px-2 py-2">{sub.name}</td>
									<td class="px-2 py-2">{sub.purpose}</td>
									<td class="px-2 py-2">{sub.region}</td>
									<td class="px-2 py-2 text-xs">{Array.isArray(sub.data_types) ? sub.data_types.join(', ') : '-'}</td>
									<td class="px-2 py-2"><StatusBadge status={sub.is_active ? 'active' : 'inactive'} /></td>
									<td class="px-2 py-2">
										<button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onclick={() => deleteSubprocessor(sub)}>Delete</button>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</SectionCard>

	<SectionCard title="Compliance Milestones" description="Track roadmap commitments like SOC2 and ISO27001.">
		<div class="space-y-3">
			<div class="grid gap-2 md:grid-cols-4">
				<input bind:value={milestoneForm.framework} placeholder="Framework (SOC 2 Type II)" />
				<input type="date" bind:value={milestoneForm.target_date} />
				<input bind:value={milestoneForm.status} placeholder="Status (planned/in_progress/done)" />
				<input bind:value={milestoneForm.notes} placeholder="Notes" />
			</div>
			<div class="flex justify-end">
				<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={addMilestone}>Add Milestone</button>
			</div>
			<div class="overflow-x-auto">
				<table class="min-w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 text-left text-gray-500">
							<th class="px-2 py-2">Framework</th>
							<th class="px-2 py-2">Target Date</th>
							<th class="px-2 py-2">Status</th>
							<th class="px-2 py-2">Notes</th>
							<th class="px-2 py-2">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#if milestones.length === 0}
							<tr><td class="px-2 py-4 text-gray-500" colspan="5">No milestones yet.</td></tr>
						{:else}
							{#each milestones as row}
								<tr class="border-b border-gray-100">
									<td class="px-2 py-2">{row.framework}</td>
									<td class="px-2 py-2">{formatDate(row.target_date)}</td>
									<td class="px-2 py-2"><StatusBadge status={row.status || 'planned'} /></td>
									<td class="px-2 py-2 text-xs">{row.notes || '-'}</td>
									<td class="px-2 py-2"><button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onclick={() => deleteMilestone(row)}>Delete</button></td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</SectionCard>

	<SectionCard title="Public Incident Postmortems" description="Publish customer-facing incident summaries and postmortem links.">
		<div class="space-y-3">
			<div class="grid gap-2 md:grid-cols-5">
				<input bind:value={incidentForm.title} placeholder="Incident title" />
				<input bind:value={incidentForm.summary} placeholder="Summary" />
				<input bind:value={incidentForm.severity} placeholder="Severity" />
				<input bind:value={incidentForm.impact} placeholder="Impact" />
				<input bind:value={incidentForm.postmortem_url} placeholder="Postmortem URL" />
			</div>
			<div class="flex justify-end">
				<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={addPublicIncident}>Add Public Incident</button>
			</div>
			<div class="overflow-x-auto">
				<table class="min-w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 text-left text-gray-500">
							<th class="px-2 py-2">Title</th>
							<th class="px-2 py-2">Severity</th>
							<th class="px-2 py-2">Status</th>
							<th class="px-2 py-2">Postmortem</th>
							<th class="px-2 py-2">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#if publicIncidents.length === 0}
							<tr><td class="px-2 py-4 text-gray-500" colspan="5">No public incidents published.</td></tr>
						{:else}
							{#each publicIncidents as row}
								<tr class="border-b border-gray-100">
									<td class="px-2 py-2">{row.title}</td>
									<td class="px-2 py-2"><StatusBadge status={row.severity || 'info'} /></td>
									<td class="px-2 py-2"><StatusBadge status={row.status || 'investigating'} /></td>
									<td class="px-2 py-2 text-xs"><a href={row.postmortem_url} target="_blank" rel="noreferrer" class="text-orange-600 hover:underline">{row.postmortem_url || '-'}</a></td>
									<td class="px-2 py-2"><button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onclick={() => deletePublicIncident(row)}>Delete</button></td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</SectionCard>
</div>

<style>
	.field { display: flex; flex-direction: column; gap: 0.3rem; }
	.field span { font-size: 0.78rem; color: #64748b; }
	input {
		border: 1px solid #cbd5e1;
		border-radius: 0.6rem;
		padding: 0.55rem 0.7rem;
		font-size: 0.875rem;
	}
</style>

<script lang="ts">
	import { onMount } from 'svelte';
	import { studioApi } from '$lib/api/studio';
	import { contextStore } from '$lib/stores/context';
	import { confirmDialog } from '$lib/stores/confirm';
	import { toastStore } from '$stores/toast';
	import { formatDateTime } from '$lib/utils/format';
	import PageHeader from '$lib/components/studio/PageHeader.svelte';
	import SectionCard from '$lib/components/studio/SectionCard.svelte';
	import StatusBadge from '$lib/components/studio/StatusBadge.svelte';
	import SlideOver from '$lib/components/studio/SlideOver.svelte';
	import EmptyState from '$lib/components/studio/EmptyState.svelte';
	import ErrorState from '$lib/components/studio/ErrorState.svelte';
	import JsonViewer from '$lib/components/studio/JsonViewer.svelte';

	let loading = $state(false);
	let error = $state('');

	let filters = $state({ scope: '', project_id: '' });
	let secrets = $state<Array<Record<string, any>>>([]);
	let selectedSecret = $state<Record<string, any> | null>(null);
	let versions = $state<Array<Record<string, any>>>([]);
	let versionsOpen = $state(false);
	let rotateValue = $state('');

	let createForm = $state({
		name: '',
		scope: 'project',
		organization_id: '',
		project_id: '',
		function_id: '',
		description: '',
		value: ''
	});

	const scopeOptions = ['platform', 'organization', 'project', 'function'];

	async function loadSecrets() {
		loading = true;
		error = '';
		try {
			secrets =
				(await studioApi.listSecrets({
					scope: filters.scope || undefined,
					project_id: filters.project_id || contextStore.activeProjectId || undefined
				})) ?? [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load secrets';
			toastStore.error(error);
		} finally {
			loading = false;
		}
	}

	async function createSecret() {
		if (!createForm.name.trim() || !createForm.value.trim()) {
			toastStore.error('Secret name and value are required');
			return;
		}
		try {
			await studioApi.createSecret({
				name: createForm.name.trim(),
				value: createForm.value,
				scope: createForm.scope,
				organization_id: createForm.organization_id || undefined,
				project_id: createForm.project_id || contextStore.activeProjectId || undefined,
				function_id: createForm.function_id || undefined,
				description: createForm.description || undefined
			});
			toastStore.success('Secret created. Raw value is never shown again.');
			createForm = {
				name: '',
				scope: 'project',
				organization_id: '',
				project_id: '',
				function_id: '',
				description: '',
				value: ''
			};
			await loadSecrets();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Create secret failed');
		}
	}

	async function openVersions(secret: Record<string, any>) {
		selectedSecret = secret;
		rotateValue = '';
		versionsOpen = true;
		try {
			versions = (await studioApi.listSecretVersions(String(secret.name))) ?? [];
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to load secret versions');
			versions = [];
		}
	}

	async function rotateSecret() {
		if (!selectedSecret) return;
		if (!rotateValue.trim()) {
			toastStore.error('New secret value is required for rotation');
			return;
		}
		const ok = await confirmDialog.open({
			title: 'Rotate Secret',
			message: `Rotate secret "${selectedSecret.name}" to a new version?`,
			confirmText: 'Rotate',
			variant: 'danger'
		});
		if (!ok) return;
		try {
			await studioApi.rotateSecret(String(selectedSecret.name), rotateValue);
			rotateValue = '';
			toastStore.success('Secret rotated');
			await Promise.all([openVersions(selectedSecret), loadSecrets()]);
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Rotate failed');
		}
	}

	async function rollbackSecret(version: number) {
		if (!selectedSecret) return;
		const ok = await confirmDialog.open({
			title: 'Rollback Secret',
			message: `Rollback "${selectedSecret.name}" to version ${version}?`,
			confirmText: 'Rollback',
			variant: 'danger'
		});
		if (!ok) return;
		try {
			await studioApi.rollbackSecret(String(selectedSecret.name), version);
			toastStore.success(`Rolled back to version ${version}`);
			await Promise.all([openVersions(selectedSecret), loadSecrets()]);
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Rollback failed');
		}
	}

	async function copyName(name: string) {
		await navigator.clipboard.writeText(name);
		toastStore.success('Secret name copied');
	}

	onMount(async () => {
		await contextStore.ensureLoaded();
		filters.project_id = contextStore.activeProjectId || '';
		createForm.project_id = contextStore.activeProjectId || '';
		await loadSecrets();
	});
</script>

<div class="space-y-6" data-testid="secrets-page">
	<PageHeader title="Secrets Manager" description="Encrypted and versioned secrets with rotation and rollback controls." >
		{#snippet actions()}
			<div class="flex gap-2">
				<a class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" href="/audit?action=rotate_secret">Audit Logs</a>
				<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={loadSecrets} disabled={loading}>
					{loading ? 'Refreshing...' : 'Refresh'}
				</button>
			</div>
		{/snippet}
	</PageHeader>

	{#if error}
		<ErrorState message={error} onRetry={loadSecrets} />
	{/if}

	<SectionCard title="Create Secret" description="Secrets are encrypted at rest. Raw values are returned only once on creation.">
		<div class="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
			Choose the narrowest scope possible. Project and function scopes are safer than platform-wide values for routine workloads.
		</div>
		<div class="grid gap-3 md:grid-cols-2">
			<label class="field">
				<span>Name</span>
				<input bind:value={createForm.name} placeholder="PAYMENT_GATEWAY_KEY" data-testid="secret-name-input" />
			</label>
			<label class="field">
				<span>Scope</span>
				<select bind:value={createForm.scope}>
					{#each scopeOptions as scope}
						<option value={scope}>{scope}</option>
					{/each}
				</select>
			</label>
			<label class="field">
				<span>Organization ID (optional)</span>
				<input bind:value={createForm.organization_id} placeholder="org-uuid" />
			</label>
			<label class="field">
				<span>Project ID (optional)</span>
				<input bind:value={createForm.project_id} placeholder="project-uuid" />
			</label>
			<label class="field">
				<span>Function ID (optional)</span>
				<input bind:value={createForm.function_id} placeholder="function-uuid" />
			</label>
			<label class="field">
				<span>Description</span>
				<input bind:value={createForm.description} placeholder="Used for Razorpay production API" />
			</label>
			<label class="field md:col-span-2">
				<span>Secret Value</span>
				<input type="password" bind:value={createForm.value} placeholder="paste secret value" data-testid="secret-value-input" />
			</label>
		</div>
		<div class="mt-3 flex justify-end">
			<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={createSecret} data-testid="create-secret-submit">Create Secret</button>
		</div>
	</SectionCard>

	<SectionCard title="Secrets" description="Filter by scope and inspect version metadata without exposing raw values.">
		<div class="space-y-3">
			<div class="grid gap-3 md:grid-cols-3">
				<label class="field">
					<span>Scope</span>
					<select bind:value={filters.scope} onchange={loadSecrets}>
						<option value="">All scopes</option>
						{#each scopeOptions as scope}
							<option value={scope}>{scope}</option>
						{/each}
					</select>
				</label>
				<label class="field">
					<span>Project ID</span>
					<input bind:value={filters.project_id} placeholder="project-uuid" onblur={loadSecrets} />
				</label>
			</div>
			<div class="overflow-x-auto">
				<table class="min-w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 text-left text-gray-500">
							<th class="px-2 py-2">Name</th>
							<th class="px-2 py-2">Scope</th>
							<th class="px-2 py-2">Active Version</th>
							<th class="px-2 py-2">Updated</th>
							<th class="px-2 py-2">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#if loading}
							<tr><td class="px-2 py-4 text-gray-500" colspan="5">Loading secrets...</td></tr>
						{:else if secrets.length === 0}
							<tr><td class="px-2 py-4 text-gray-500" colspan="5"><EmptyState title="No secrets found" message="Create the first secret for this scope to enable secure runtime configuration." /></td></tr>
						{:else}
							{#each secrets as secret}
								<tr class="border-b border-gray-100" data-testid={`secret-row-${secret.name}`}>
									<td class="px-2 py-2 font-mono text-xs">{secret.name}</td>
									<td class="px-2 py-2"><StatusBadge status={secret.scope} /></td>
									<td class="px-2 py-2">v{secret.active_version}</td>
									<td class="px-2 py-2 text-gray-500">{formatDateTime(secret.updated_at)}</td>
									<td class="px-2 py-2">
										<div class="flex gap-2">
											<button class="rounded border px-2 py-1 text-xs" onclick={() => copyName(String(secret.name))}>Copy Name</button>
											<button class="rounded border px-2 py-1 text-xs" onclick={() => openVersions(secret)}>Versions</button>
										</div>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	</SectionCard>
</div>

<SlideOver open={versionsOpen} title={selectedSecret ? `Versions: ${selectedSecret.name}` : 'Secret Versions'} onclose={() => (versionsOpen = false)}>
	{#if selectedSecret}
		<div class="space-y-3">
			<p class="text-xs text-gray-500">Values are masked and never displayed after initial creation.</p>
			<div class="flex gap-2">
				<input class="w-full" type="password" bind:value={rotateValue} placeholder="new value for rotation" data-testid="rotate-secret-value" />
				<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={rotateSecret} data-testid="rotate-secret-submit">Rotate</button>
			</div>
			{#if selectedSecret}
				<JsonViewer value={selectedSecret} maxHeight="10rem" />
			{/if}
			<div class="overflow-x-auto">
				<table class="min-w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 text-left text-gray-500">
							<th class="px-2 py-2">Version</th>
							<th class="px-2 py-2">Created</th>
							<th class="px-2 py-2">Status</th>
							<th class="px-2 py-2">Actions</th>
						</tr>
					</thead>
					<tbody>
						{#if versions.length === 0}
							<tr><td class="px-2 py-4 text-gray-500" colspan="4">No versions available.</td></tr>
						{:else}
							{#each versions as version}
								<tr class="border-b border-gray-100">
									<td class="px-2 py-2">v{version.version}</td>
									<td class="px-2 py-2 text-gray-500">{formatDateTime(version.created_at)}</td>
									<td class="px-2 py-2"><StatusBadge status={version.is_active ? 'active' : 'inactive'} /></td>
									<td class="px-2 py-2">
										{#if !version.is_active}
											<button class="rounded border px-2 py-1 text-xs" onclick={() => rollbackSecret(Number(version.version))}>Rollback</button>
										{/if}
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</SlideOver>

<style>
	.field { display: flex; flex-direction: column; gap: 0.3rem; }
	.field span { font-size: 0.78rem; color: #64748b; }
	input, select {
		border: 1px solid #cbd5e1;
		border-radius: 0.6rem;
		padding: 0.55rem 0.7rem;
		font-size: 0.875rem;
	}
</style>

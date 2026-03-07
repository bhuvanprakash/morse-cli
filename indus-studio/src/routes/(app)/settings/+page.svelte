<script lang="ts">
	import { onMount } from 'svelte';
	import { apiClient } from '$api/client';
	import { studioApi } from '$lib/api/studio';
	import { contextStore } from '$lib/stores/context';
	import { auth } from '$stores/auth';
	import { confirmDialog } from '$lib/stores/confirm';
	import { toastStore } from '$stores/toast';
	import PageHeader from '$lib/components/studio/PageHeader.svelte';
	import SectionCard from '$lib/components/studio/SectionCard.svelte';
	import StatCard from '$lib/components/studio/StatCard.svelte';
	import EmptyState from '$lib/components/studio/EmptyState.svelte';
	import ErrorState from '$lib/components/studio/ErrorState.svelte';
	import LoadingSkeleton from '$lib/components/studio/LoadingSkeleton.svelte';
	import CopyButton from '$lib/components/studio/CopyButton.svelte';
	import KeyValueList from '$lib/components/studio/KeyValueList.svelte';
	import JsonViewer from '$lib/components/studio/JsonViewer.svelte';
	import StatusBadge from '$lib/components/studio/StatusBadge.svelte';
	import FormField from '$lib/components/studio/FormField.svelte';
	import FormActions from '$lib/components/studio/FormActions.svelte';
	import { formatDateTime } from '$lib/utils/format';

	type ProjectDetail = {
		id: string;
		org_id: string;
		name: string;
		slug: string;
		db_schema: string;
		region: string;
		status: string;
		created_at: string;
	};

	type ComponentStatus = {
		name: string;
		status: string;
		description?: string;
	};

	let loading = $state(true);
	let savingPreferences = $state(false);
	let projectAction = $state<'pause' | 'resume' | 'delete' | ''>('');
	let error = $state('');
	let projectDetail = $state<ProjectDetail | null>(null);
	let components = $state<ComponentStatus[]>([]);
	let incidents = $state<Array<Record<string, unknown>>>([]);
	let apiUrl = $state(apiClient.getBaseUrl());
	let initialApiUrl = $state(apiClient.getBaseUrl());
	let anonKey = $state('');
	let serviceRoleKey = $state('');
	let publicKeyFingerprint = $state('');

	const canManageProject = $derived.by(() => {
		const role = String(auth.user?.role ?? '').toLowerCase();
		return role === 'admin' || role === 'owner';
	});

	const settingsStats = $derived.by(() => ({
		components: components.length,
		incidents: incidents.length,
		status: projectDetail?.status || 'unknown',
		createdAt: projectDetail?.created_at ? formatDateTime(projectDetail.created_at) : '—'
	}));

	const sdkSnippet = $derived.by(() => `import { createClient } from 'indusbase-js';

const client = createClient('${apiUrl}', '${anonKey ? `${anonKey.slice(0, 18)}...` : 'your-anon-key'}');`);

	const pythonSnippet = $derived.by(() => `from indusbase import create_client

client = create_client("${apiUrl}", "${anonKey ? `${anonKey.slice(0, 18)}...` : 'your-anon-key'}")`);
	const hasUnsavedPreferences = $derived.by(() => apiUrl.trim() !== initialApiUrl.trim());

	async function loadSettings() {
		loading = true;
		error = '';
		try {
			await contextStore.ensureLoaded();
			anonKey = localStorage.getItem('active_project_anon_key') || '';
			serviceRoleKey = localStorage.getItem('active_project_service_role_key') || '';
			publicKeyFingerprint = localStorage.getItem('jwt_public_key_fingerprint') || 'Not exposed by control plane';
			initialApiUrl = apiUrl;

			if (!contextStore.activeProjectId) {
				projectDetail = null;
				components = [];
				incidents = [];
				return;
			}

			const [project, statusRaw] = await Promise.all([
				studioApi.getProject(contextStore.activeProjectId),
				studioApi.getStatusPublic().catch(() => ({}))
			]);
			const status = (statusRaw ?? {}) as Record<string, unknown>;

			projectDetail = {
				id: String(project.id ?? ''),
				org_id: String(project.org_id ?? ''),
				name: String(project.name ?? contextStore.activeProject?.name ?? ''),
				slug: String(project.slug ?? contextStore.activeProject?.slug ?? ''),
				db_schema: String(project.db_schema ?? contextStore.activeProject?.db_schema ?? ''),
				region: String(project.region ?? contextStore.activeProject?.region ?? 'ap-south-1'),
				status: String(project.status ?? contextStore.activeProject?.status ?? 'active'),
				created_at: String(project.created_at ?? '')
			};

			components = Array.isArray(status.components)
				? (status.components as Array<Record<string, unknown>>).map((row) => ({
						name: String(row.name ?? row.slug ?? 'component'),
						status: String(row.status ?? 'unknown'),
						description: row.description ? String(row.description) : undefined
					}))
				: [];
			incidents = Array.isArray(status.incidents) ? (status.incidents as Array<Record<string, unknown>>) : [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load settings';
			toastStore.error(error);
		} finally {
			loading = false;
		}
	}

	async function savePreferences() {
		if (!apiUrl.trim()) {
			toastStore.error('API URL is required');
			return;
		}
		savingPreferences = true;
		try {
			apiClient.setBaseUrl(apiUrl.trim());
			initialApiUrl = apiUrl.trim();
			toastStore.success('Studio API preferences saved');
			await loadSettings();
		} finally {
			savingPreferences = false;
		}
	}

	async function updateProjectStatus(nextAction: 'pause' | 'resume' | 'delete') {
		if (!projectDetail || !canManageProject) {
			toastStore.error('Owner/admin role required for project lifecycle actions');
			return;
		}

		const message =
			nextAction === 'delete'
				? `Delete project "${projectDetail.name}"? This marks the project deleted and removes it from the active control plane.`
				: `${nextAction === 'pause' ? 'Pause' : 'Resume'} project "${projectDetail.name}"?`;
		const confirmed = await confirmDialog.open({
			title: `${nextAction[0].toUpperCase()}${nextAction.slice(1)} Project`,
			message,
			confirmText: `${nextAction[0].toUpperCase()}${nextAction.slice(1)} project`,
			variant: nextAction === 'delete' ? 'danger' : 'default'
		});
		if (!confirmed) return;

		projectAction = nextAction;
		try {
			if (nextAction === 'pause') {
				await studioApi.pauseProject(projectDetail.id);
			} else if (nextAction === 'resume') {
				await studioApi.resumeProject(projectDetail.id);
			} else {
				await studioApi.deleteProject(projectDetail.id);
			}
			toastStore.success(`Project ${nextAction}d`);
			await contextStore.load();
			await loadSettings();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : `Failed to ${nextAction} project`);
		} finally {
			projectAction = '';
		}
	}

	onMount(loadSettings);
</script>

<div class="space-y-6" data-testid="settings-page">
	<PageHeader title="Project Settings" description="Inspect active project metadata, workspace API configuration, keys, and service health.">
		{#snippet actions()}
			<div class="flex gap-2">
				<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={loadSettings} disabled={loading}>
					{loading ? 'Refreshing...' : 'Refresh'}
				</button>
			</div>
		{/snippet}
	</PageHeader>

	{#if error}
		<ErrorState title="Settings unavailable" message={error} onRetry={loadSettings} />
	{/if}

	{#if loading}
		<LoadingSkeleton lines={12} />
	{:else if !projectDetail}
		<EmptyState title="No active project" message="Create or select a project to view project settings and operational health." />
	{:else}
		<div class="grid gap-4 md:grid-cols-4">
			<StatCard label="Project status" value={projectDetail.status} hint={projectDetail.slug} trend={projectDetail.status} trendTone={projectDetail.status === 'active' ? 'good' : 'warn'} />
			<StatCard label="Region" value={projectDetail.region} hint={projectDetail.db_schema} />
			<StatCard label="Components" value={String(settingsStats.components)} hint="live status feed" />
			<StatCard label="Active incidents" value={String(settingsStats.incidents)} hint={settingsStats.createdAt} />
		</div>

		<div class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
			<SectionCard title="Project Metadata" description="Current active project identity, schema, and lifecycle controls.">
				<div class="space-y-4">
					<div class="flex flex-wrap items-center gap-2">
						<StatusBadge status={projectDetail.status} />
						<span class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{projectDetail.region}</span>
						<span class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">{projectDetail.db_schema}</span>
					</div>
					<KeyValueList
						items={[
							{ key: 'Project ID', value: projectDetail.id },
							{ key: 'Organization ID', value: projectDetail.org_id },
							{ key: 'Name', value: projectDetail.name },
							{ key: 'Slug', value: projectDetail.slug },
							{ key: 'Created', value: settingsStats.createdAt }
						]}
					/>
					{#if canManageProject}
						<FormActions>
							<button
								class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:opacity-50"
								onclick={() => updateProjectStatus(projectDetail?.status === 'active' ? 'pause' : 'resume')}
								disabled={projectAction !== ''}
							>
								{projectAction === 'pause' || projectAction === 'resume'
									? 'Updating...'
									: projectDetail.status === 'active'
										? 'Pause project'
										: 'Resume project'}
							</button>
							<button
								class="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
								onclick={() => updateProjectStatus('delete')}
								disabled={projectAction !== ''}
							>
								{projectAction === 'delete' ? 'Deleting...' : 'Delete project'}
							</button>
						</FormActions>
					{:else}
						<div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
							Read-only mode. Owner/admin role is required for pause, resume, or delete actions.
						</div>
					{/if}
				</div>
			</SectionCard>

			<SectionCard title="Studio Preferences" description="Configure the API base URL used by this Studio session.">
				<div class="space-y-4">
					<FormField label="Workspace API URL" hint="Used for all Studio requests. Persisted locally in this browser.">
						<input class="input" bind:value={apiUrl} placeholder="http://localhost:8000" data-testid="settings-api-url-input" />
					</FormField>
					<FormField label="Authenticated user" hint="Current Studio operator session.">
						<input class="input" readonly value={auth.user?.email || 'Unknown'} />
					</FormField>
					<FormActions>
						<button class="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" onclick={savePreferences} disabled={savingPreferences || !hasUnsavedPreferences} data-testid="save-settings-preferences">
							{savingPreferences ? 'Saving...' : 'Save preferences'}
						</button>
					</FormActions>
					{#if hasUnsavedPreferences}
						<p class="text-xs text-amber-300">Unsaved API base URL changes for this browser session.</p>
					{/if}
				</div>
			</SectionCard>
		</div>

		<div class="grid gap-6 xl:grid-cols-[1fr_1fr]">
			<SectionCard title="API Keys" description="Use anon keys on the client. Raw secret values are never redisplayed once rotated.">
				<div class="space-y-4">
					<div class="rounded-lg border border-gray-200 p-4">
						<div class="mb-2 flex items-center justify-between gap-3">
							<strong class="text-sm text-gray-900">Anonymous key</strong>
							{#if anonKey}
								<CopyButton value={anonKey} label="Copy anon key" />
							{/if}
						</div>
						<code class="block overflow-x-auto rounded bg-slate-950/95 px-3 py-2 text-xs text-slate-100">
							{anonKey || 'Not available for this session. Create/select a project to seed an anon key.'}
						</code>
					</div>
					<div class="rounded-lg border border-gray-200 p-4">
						<div class="mb-2 flex items-center justify-between gap-3">
							<strong class="text-sm text-gray-900">Service role key</strong>
							{#if serviceRoleKey}
								<CopyButton value={serviceRoleKey} label="Copy service role key" />
							{/if}
						</div>
						<code class="block overflow-x-auto rounded bg-slate-950/95 px-3 py-2 text-xs text-slate-100">
							{serviceRoleKey || 'Not persisted in the current Studio session.'}
						</code>
					</div>
					<div class="rounded-lg border border-gray-200 p-4 text-sm text-gray-600">
						<strong class="mb-1 block text-gray-900">JWT public key fingerprint</strong>
						<div class="flex items-center justify-between gap-3">
							<span>{publicKeyFingerprint}</span>
							{#if publicKeyFingerprint && publicKeyFingerprint !== 'Not exposed by control plane'}
								<CopyButton value={publicKeyFingerprint} label="Copy fingerprint" />
							{/if}
						</div>
					</div>
				</div>
			</SectionCard>

			<SectionCard title="Service Health" description="Derived from the public status surface for demo-safe operational visibility.">
				<div class="space-y-3">
					{#if components.length === 0}
						<EmptyState title="No health components" message="The status service has not published component health yet." />
					{:else}
						{#each components as component}
							<div class="flex items-start justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3">
								<div>
									<div class="font-medium text-gray-900">{component.name}</div>
									{#if component.description}
										<div class="text-sm text-gray-500">{component.description}</div>
									{/if}
								</div>
								<StatusBadge status={component.status} />
							</div>
						{/each}
					{/if}
					{#if incidents.length > 0}
						<div class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
							{incidents.length} public incident(s) currently active. Review `/status` for timeline updates and resolution state.
						</div>
					{/if}
				</div>
			</SectionCard>
		</div>

		<div class="grid gap-6 xl:grid-cols-[1fr_1fr]">
			<SectionCard title="SDK Quick Start" description="Copy live snippets for your currently selected project context.">
				<div class="space-y-4">
					<div>
						<div class="mb-2 flex items-center justify-between gap-3">
							<strong class="text-sm text-gray-900">JavaScript / TypeScript</strong>
							<CopyButton value={sdkSnippet} label="Copy JS snippet" />
						</div>
						<JsonViewer value={sdkSnippet} maxHeight="12rem" />
					</div>
					<div>
						<div class="mb-2 flex items-center justify-between gap-3">
							<strong class="text-sm text-gray-900">Python</strong>
							<CopyButton value={pythonSnippet} label="Copy Python snippet" />
						</div>
						<JsonViewer value={pythonSnippet} maxHeight="12rem" />
					</div>
				</div>
			</SectionCard>

			<SectionCard title="Project Snapshot" description="Raw detail payload for troubleshooting project context and support handoffs.">
				<JsonViewer value={projectDetail} />
			</SectionCard>
		</div>
	{/if}
</div>

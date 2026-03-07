<script lang="ts">
	import { onMount } from 'svelte';
	import { studioApi } from '$lib/api/studio';
	import { auth } from '$stores/auth';
	import { toastStore } from '$stores/toast';
	import { confirmDialog } from '$lib/stores/confirm';
	import PageHeader from '$lib/components/studio/PageHeader.svelte';
	import SectionCard from '$lib/components/studio/SectionCard.svelte';
	import EmptyState from '$lib/components/studio/EmptyState.svelte';
	import ErrorState from '$lib/components/studio/ErrorState.svelte';
	import LoadingSkeleton from '$lib/components/studio/LoadingSkeleton.svelte';
	import JsonViewer from '$lib/components/studio/JsonViewer.svelte';
	import FormField from '$lib/components/studio/FormField.svelte';
	import FormActions from '$lib/components/studio/FormActions.svelte';
	import StatusBadge from '$lib/components/studio/StatusBadge.svelte';
	import CopyButton from '$lib/components/studio/CopyButton.svelte';
	import { formatDateTime } from '$lib/utils/format';

	type SupportUser = {
		id: string;
		email?: string;
		phone?: string;
		role?: string;
		status?: string;
		created_at?: string;
	};

	type SupportProject = {
		id: string;
		name?: string;
		slug?: string;
		region?: string;
		status?: string;
		created_at?: string;
	};

	type SupportNote = {
		id: string;
		severity: string;
		note: string;
		actor_email?: string;
		created_at?: string;
	};

	let loading = $state(false);
	let searchingUsers = $state(false);
	let searchingProjects = $state(false);
	let loadingContext = $state(false);
	let error = $state('');

	let userQuery = $state('');
	let projectQuery = $state('');
	let users = $state<SupportUser[]>([]);
	let projects = $state<SupportProject[]>([]);
	let contextData = $state<Record<string, unknown> | null>(null);
	let notes = $state<SupportNote[]>([]);

	let selectedUser = $state<SupportUser | null>(null);
	let selectedProject = $state<SupportProject | null>(null);

	let noteSeverity = $state('medium');
	let noteText = $state('');
	let impersonationReason = $state('');
	let impersonationDuration = $state(15);

	let userDebounce: ReturnType<typeof setTimeout> | null = null;
	let projectDebounce: ReturnType<typeof setTimeout> | null = null;

	const isAdmin = $derived.by(() => {
		const role = String(auth.user?.role ?? '').toLowerCase();
		return role === 'admin' || role === 'owner';
	});

	const contextSummary = $derived.by(() => ({
		notifications: Array.isArray(contextData?.recent_notifications) ? contextData.recent_notifications.length : 0,
		authEvents: Array.isArray(contextData?.recent_auth_events) ? contextData.recent_auth_events.length : 0,
		queueJobs: Array.isArray(contextData?.recent_queue_jobs) ? contextData.recent_queue_jobs.length : 0,
		webhooks: Array.isArray(contextData?.project_webhooks) ? contextData.project_webhooks.length : 0
	}));

	function resetErrors() {
		error = '';
	}

	async function searchUsers() {
		const q = userQuery.trim();
		if (!q) {
			users = [];
			return;
		}
		searchingUsers = true;
		resetErrors();
		try {
			const data = await studioApi.supportSearchUsers(q);
			users = (data ?? []).map((row) => ({
				id: String(row.id ?? ''),
				email: row.email ? String(row.email) : undefined,
				phone: row.phone ? String(row.phone) : undefined,
				role: row.role ? String(row.role) : undefined,
				status: row.status ? String(row.status) : undefined,
				created_at: row.created_at ? String(row.created_at) : undefined
			}));
		} catch (err) {
			error = err instanceof Error ? err.message : 'User search failed';
			toastStore.error(error);
		} finally {
			searchingUsers = false;
		}
	}

	async function searchProjects() {
		const q = projectQuery.trim();
		if (!q) {
			projects = [];
			return;
		}
		searchingProjects = true;
		resetErrors();
		try {
			const data = await studioApi.supportSearchProjects(q);
			projects = (data ?? []).map((row) => ({
				id: String(row.id ?? ''),
				name: row.name ? String(row.name) : undefined,
				slug: row.slug ? String(row.slug) : undefined,
				region: row.region ? String(row.region) : undefined,
				status: row.status ? String(row.status) : undefined,
				created_at: row.created_at ? String(row.created_at) : undefined
			}));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Project search failed';
			toastStore.error(error);
		} finally {
			searchingProjects = false;
		}
	}

	async function loadContext() {
		if (!selectedUser?.id && !selectedProject?.id) {
			contextData = null;
			notes = [];
			return;
		}
		loadingContext = true;
		resetErrors();
		try {
			const [contextRes, notesRes] = await Promise.all([
				studioApi.supportContext(selectedUser?.id, selectedProject?.id),
				studioApi.supportListNotes(selectedUser?.id, selectedProject?.id)
			]);
			contextData = contextRes ?? {};
			notes = (notesRes ?? []).map((row) => ({
				id: String(row.id ?? ''),
				severity: String(row.severity ?? 'low'),
				note: String(row.note ?? ''),
				actor_email: row.actor_email ? String(row.actor_email) : undefined,
				created_at: row.created_at ? String(row.created_at) : undefined
			}));
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load support context';
			toastStore.error(error);
		} finally {
			loadingContext = false;
		}
	}

	async function createNote() {
		if (!noteText.trim()) {
			toastStore.error('Support note text is required');
			return;
		}
		loading = true;
		try {
			await studioApi.supportCreateNote({
				project_id: selectedProject?.id,
				user_id: selectedUser?.id,
				severity: noteSeverity,
				note: noteText.trim()
			});
			noteText = '';
			toastStore.success('Support note created');
			await loadContext();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to create support note');
		} finally {
			loading = false;
		}
	}

	async function requestImpersonation() {
		if (!selectedUser?.id) {
			toastStore.error('Select a user before requesting impersonation');
			return;
		}
		if (!impersonationReason.trim()) {
			toastStore.error('Provide a reason for impersonation request');
			return;
		}
		const confirmed = await confirmDialog.open({
			title: 'Create Impersonation Request',
			message: `Create a ${impersonationDuration}-minute approval token for ${selectedUser.email || selectedUser.id}?`,
			confirmText: 'Create request',
			variant: 'danger'
		});
		if (!confirmed) return;

		loading = true;
		try {
			const res = await studioApi.supportRequestImpersonation({
				target_user_id: selectedUser.id,
				target_project_id: selectedProject?.id,
				reason: impersonationReason.trim(),
				duration_minutes: impersonationDuration
			});
			impersonationReason = '';
			toastStore.success('Impersonation approval request created');
			if (res.approval_token) {
				await navigator.clipboard.writeText(String(res.approval_token));
				toastStore.info('Approval token copied to clipboard');
			}
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to create impersonation request');
		} finally {
			loading = false;
		}
	}

	function selectUser(user: SupportUser) {
		selectedUser = user;
		loadContext();
	}

	function selectProject(project: SupportProject) {
		selectedProject = project;
		loadContext();
	}

	function clearSelection() {
		selectedUser = null;
		selectedProject = null;
		contextData = null;
		notes = [];
	}

	function downloadSupportPacket() {
		const packet = {
			generated_at: new Date().toISOString(),
			selected_user: selectedUser,
			selected_project: selectedProject,
			context: contextData,
			notes
		};
		const blob = new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `support-packet-${Date.now()}.json`;
		a.click();
		URL.revokeObjectURL(url);
		toastStore.success('Support packet exported');
	}

	$effect(() => {
		if (userDebounce) clearTimeout(userDebounce);
		userDebounce = setTimeout(searchUsers, 300);
	});

	$effect(() => {
		if (projectDebounce) clearTimeout(projectDebounce);
		projectDebounce = setTimeout(searchProjects, 300);
	});

	onMount(async () => {
		if (!isAdmin) {
			error = 'Admin role required to access support tooling';
			return;
		}
		await loadContext();
	});
</script>

<div class="space-y-6" data-testid="support-page">
	<PageHeader title="Support Console" description="Enterprise operator tooling for user/project diagnostics, notes, and controlled impersonation requests.">
		{#snippet actions()}
			<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={clearSelection}>Clear Selection</button>
			<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={downloadSupportPacket} disabled={!contextData}>Export Packet</button>
		{/snippet}
	</PageHeader>

	{#if !isAdmin}
		<ErrorState title="Unauthorized" message={error || 'Only admin/owner users can access support tooling.'} />
	{:else}
		{#if error}
			<ErrorState message={error} onRetry={loadContext} />
		{/if}

		<div class="grid gap-6 lg:grid-cols-2">
			<SectionCard title="Search Users" description="Search by email, phone, or user UUID.">
				<input class="input" bind:value={userQuery} placeholder="email / phone / user_id" data-testid="support-user-search" />
				<div class="mt-3 max-h-72 space-y-2 overflow-auto">
					{#if searchingUsers}
						<LoadingSkeleton lines={4} />
					{:else if users.length === 0}
						<EmptyState title="No users" message="Start typing to search users." />
					{:else}
						{#each users as user}
							<button class={`w-full rounded-lg border px-3 py-2 text-left hover:border-orange-300 hover:bg-orange-50 ${selectedUser?.id === user.id ? 'border-orange-400 bg-orange-50' : 'border-gray-200'}`} onclick={() => selectUser(user)}>
								<div class="flex items-center justify-between gap-2">
									<div>
										<p class="text-sm font-medium text-gray-900">{user.email || user.phone || user.id}</p>
										<p class="text-xs text-gray-500">{user.id}</p>
									</div>
									<StatusBadge status={user.status || 'active'} />
								</div>
							</button>
						{/each}
					{/if}
				</div>
			</SectionCard>

			<SectionCard title="Search Projects" description="Search by slug, name, or project UUID.">
				<input class="input" bind:value={projectQuery} placeholder="slug / project_id" data-testid="support-project-search" />
				<div class="mt-3 max-h-72 space-y-2 overflow-auto">
					{#if searchingProjects}
						<LoadingSkeleton lines={4} />
					{:else if projects.length === 0}
						<EmptyState title="No projects" message="Start typing to search projects." />
					{:else}
						{#each projects as project}
							<button class={`w-full rounded-lg border px-3 py-2 text-left hover:border-orange-300 hover:bg-orange-50 ${selectedProject?.id === project.id ? 'border-orange-400 bg-orange-50' : 'border-gray-200'}`} onclick={() => selectProject(project)}>
								<div class="flex items-center justify-between gap-2">
									<div>
										<p class="text-sm font-medium text-gray-900">{project.name} ({project.slug})</p>
										<p class="text-xs text-gray-500">{project.id}</p>
									</div>
									<StatusBadge status={project.status || 'active'} />
								</div>
							</button>
						{/each}
					{/if}
				</div>
			</SectionCard>
		</div>

		<div class="grid gap-6 lg:grid-cols-3">
			<SectionCard title="Context Snapshot" description="Live support context from auth, queue, notify, and platform datasets.">
				{#if loadingContext}
					<LoadingSkeleton lines={8} />
				{:else if !contextData}
					<EmptyState title="No context loaded" message="Select a user or project to inspect support context." />
				{:else}
					<div class="grid gap-2 md:grid-cols-2">
						<div class="rounded-md bg-gray-50 p-2 text-sm"><span class="text-gray-500">Auth events</span><div class="font-semibold">{contextSummary.authEvents}</div></div>
						<div class="rounded-md bg-gray-50 p-2 text-sm"><span class="text-gray-500">Notifications</span><div class="font-semibold">{contextSummary.notifications}</div></div>
						<div class="rounded-md bg-gray-50 p-2 text-sm"><span class="text-gray-500">Queue jobs</span><div class="font-semibold">{contextSummary.queueJobs}</div></div>
						<div class="rounded-md bg-gray-50 p-2 text-sm"><span class="text-gray-500">Webhooks</span><div class="font-semibold">{contextSummary.webhooks}</div></div>
					</div>
					<div class="mt-3">
						<JsonViewer value={contextData} maxHeight="20rem" />
					</div>
				{/if}
			</SectionCard>

			<SectionCard title="Support Notes" description="Create and review operator notes with severity tagging.">
				<div class="space-y-2">
					<FormField label="Severity">
						{#snippet children()}
							<select class="input" bind:value={noteSeverity}>
								<option value="low">low</option>
								<option value="medium">medium</option>
								<option value="high">high</option>
								<option value="critical">critical</option>
							</select>
						{/snippet}
					</FormField>
					<FormField label="Note" required>
						{#snippet children()}
							<textarea class="input" rows="5" bind:value={noteText} placeholder="Describe observed issue, actions taken, and next steps."></textarea>
						{/snippet}
					</FormField>
					<FormActions>
						<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={createNote} disabled={loading}>Create Note</button>
					</FormActions>
				</div>

				<div class="mt-4 max-h-64 space-y-2 overflow-auto">
					{#if notes.length === 0}
						<EmptyState title="No notes" message="Create the first support note for this context." />
					{:else}
						{#each notes as note}
							<div class="rounded-md border border-gray-200 p-3">
								<div class="flex items-center justify-between">
									<StatusBadge status={note.severity} />
									<span class="text-xs text-gray-500">{formatDateTime(note.created_at)}</span>
								</div>
								<p class="mt-2 text-sm text-gray-800">{note.note}</p>
								<p class="mt-1 text-xs text-gray-500">{note.actor_email || 'unknown actor'}</p>
							</div>
						{/each}
					{/if}
				</div>
			</SectionCard>

			<SectionCard title="Impersonation Request" description="Create a short-lived approval token. This does not auto-login the target user.">
				<div class="space-y-2">
					<FormField label="Target User ID">
						{#snippet children()}
							<div class="flex items-center gap-2">
								<input class="input" value={selectedUser?.id || ''} readonly placeholder="Select a user first" />
								{#if selectedUser?.id}
									<CopyButton value={selectedUser.id} label="Copy" />
								{/if}
							</div>
						{/snippet}
					</FormField>
					<FormField label="Duration (minutes)">
						{#snippet children()}
							<input class="input" type="number" min="5" max="60" bind:value={impersonationDuration} />
						{/snippet}
					</FormField>
					<FormField label="Reason" required>
						{#snippet children()}
							<textarea class="input" rows="4" bind:value={impersonationReason} placeholder="Why is impersonation approval required?"></textarea>
						{/snippet}
					</FormField>
					<FormActions>
						<button class="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50" onclick={requestImpersonation} disabled={loading || !selectedUser?.id}>
							Create Approval Request
						</button>
					</FormActions>
				</div>
			</SectionCard>
		</div>
	{/if}
</div>

<style>
	.input {
		width: 100%;
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

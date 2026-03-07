<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { auth } from '$stores/auth';
	import { contextStore } from '$lib/stores/context';
	import type { EnvironmentName } from '$lib/types/api';
	import ScopeSwitcher from '$lib/components/studio/ScopeSwitcher.svelte';
	import Breadcrumbs from '$lib/components/studio/Breadcrumbs.svelte';
	import StatusBadge from '$lib/components/studio/StatusBadge.svelte';
	import CopyButton from '$lib/components/studio/CopyButton.svelte';
	import { Dropdown, Button } from '$components/ui';
	import CommandPalette from './CommandPalette.svelte';
	import { commandPaletteStore } from '$lib/stores/commandPalette';
	import { getDocsUrl, getApiBaseUrl } from '$lib/utils/urls';
	import { toastStore } from '$stores/toast';

	function handleSignOut() {
		auth.signOut();
	}

	function setEnvironment(value: EnvironmentName) {
		contextStore.setEnvironment(value);
	}

	async function reloadContext() {
		await contextStore.load();
		if (contextStore.error) {
			toastStore.error(contextStore.error);
		} else {
			toastStore.success('Workspace scope refreshed');
		}
	}

	const canManageAdmin = $derived.by(() => {
		const role = String(auth.user?.role ?? '').toLowerCase();
		return role === 'admin' || role === 'owner';
	});

	const userRoleLabel = $derived.by(() => String(auth.user?.role ?? 'viewer').toUpperCase());
	const organizationOptions = $derived.by(() =>
		contextStore.organizations.map((organization) => ({
			id: organization.id,
			label: `${organization.name} (${organization.slug})`
		}))
	);
	const projectOptions = $derived.by(() =>
		contextStore.projectsForActiveOrganization.map((project) => ({
			id: project.id,
			label: `${project.name} (${project.slug})`,
			meta: project.region || 'ap-south-1'
		}))
	);
	const userMenuItems = $derived.by(() => [
		{ label: 'Project settings', href: '/settings' },
		{ label: 'Open onboarding', href: '/onboarding' },
		...(canManageAdmin ? [{ label: 'Support Console', href: '/support' }] : []),
		{ divider: true } as const,
		{ label: 'Sign out', onClick: handleSignOut }
	]);
	const headerLinks = $derived.by(() => [
		{ label: 'Docs', href: getDocsUrl('/') },
		{ label: 'API', href: getApiBaseUrl() },
		...(canManageAdmin ? [{ label: 'Trust Center', href: getDocsUrl('/trust-center') }] : [])
	]);
	const breadcrumbs = $derived.by(() => {
		const segments = $page.url.pathname.split('/').filter(Boolean);
		const items = [{ label: 'Studio', href: '/dashboard' }];
		let current = '';
		for (const segment of segments) {
			current += `/${segment}`;
			items.push({
				label: segment.replace(/-/g, ' ').replace(/\b\w/g, (match) => match.toUpperCase()),
				href: current
			});
		}
		return items;
	});

	onMount(async () => {
		if (auth.isAuthenticated) {
			await contextStore.ensureLoaded();
		}
	});
</script>

<header class="studio-header" data-testid="studio-header">
	<div class="header-main">
		<div class="heading-row">
			<div class="space-y-2 min-w-0">
				<Breadcrumbs items={breadcrumbs} />
				<div class="title-block">
					<div>
						<h1>Indus Studio</h1>
						<p>
							{contextStore.activeProject?.name || 'No active project'}
							{#if contextStore.activeOrganization}
								<span class="muted">in {contextStore.activeOrganization.name}</span>
							{/if}
						</p>
					</div>
					<div class="meta-badges">
						<StatusBadge status={contextStore.activeProject?.status || 'pending'} />
						<span class="meta-chip">{contextStore.activeProject?.region || 'ap-south-1'}</span>
						<span class="meta-chip">{contextStore.environment}</span>
					</div>
				</div>
			</div>

			<div class="heading-actions">
				<CommandPalette />
				<Button variant="secondary" size="sm" onclick={() => commandPaletteStore.show()} testId="quick-actions-trigger">
					Quick Actions
				</Button>
				<Button variant="secondary" size="sm" onclick={() => goto('/onboarding')}>
					New Project
				</Button>
				<Button variant="primary" size="sm" onclick={() => goto('/dashboard')}>
					Overview
				</Button>
			</div>
		</div>

		<div class="scope-row">
			<ScopeSwitcher
				organizationOptions={organizationOptions}
				projectOptions={projectOptions}
				activeOrganizationId={contextStore.activeOrganizationId}
				activeProjectId={contextStore.activeProjectId}
				environment={contextStore.environment}
				loading={contextStore.loading}
				onOrganizationChange={(id) => contextStore.setActiveOrg(id)}
				onProjectChange={(id) => contextStore.setActiveProject(id)}
				onEnvironmentChange={setEnvironment}
			/>
		</div>

		<div class="footer-row">
			<div class="workspace-meta">
				{#if contextStore.activeProject}
					<span class="muted mono">project_id: {contextStore.activeProject.id}</span>
					<CopyButton value={contextStore.activeProject.id} label="Copy Project ID" successLabel="Copied" testId="copy-project-id" />
				{:else}
					<span class="muted">Create or select a project to activate Studio scope.</span>
				{/if}
				{#if contextStore.error}
					<span class="error-text">{contextStore.error}</span>
				{/if}
			</div>
			<div class="workspace-actions">
				{#each headerLinks as link}
					<a class="subtle-link" href={link.href} target="_blank" rel="noreferrer">{link.label}</a>
				{/each}
				<button type="button" class="refresh-button" onclick={reloadContext} data-testid="refresh-context">
					Refresh Scope
				</button>
			</div>
		</div>
	</div>

	<div class="user-stack">
		<div class="user-summary">
			<div class="identity-status">
				<StatusBadge status={contextStore.loaded ? 'connected' : 'syncing'} />
				<span class="muted">Gateway ready</span>
			</div>
			<StatusBadge status={userRoleLabel.toLowerCase()} />
			{#if auth.isAuthenticated && auth.user}
				<Dropdown items={userMenuItems} align="right">
					<button class="user-button" aria-label="Open user menu" data-testid="profile-menu-trigger">
						<div class="avatar">{auth.user.email?.charAt(0).toUpperCase() || '?'}</div>
						<div class="user-copy">
							<strong>{auth.user.email}</strong>
							<small>{contextStore.activeOrganization?.slug || 'No organization'}</small>
						</div>
					</button>
				</Dropdown>
			{:else}
				<Button variant="primary" onclick={() => goto('/login')}>Sign In</Button>
			{/if}
		</div>
	</div>
</header>

<style>
	.studio-header {
		background:
			radial-gradient(circle at top left, rgba(251, 146, 60, 0.12), transparent 28%),
			linear-gradient(180deg, rgba(26, 26, 26, 0.98), rgba(17, 17, 17, 0.98));
		border-bottom: 1px solid var(--surface-6);
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 1.25rem;
		padding: 1rem 1.25rem 1.1rem;
	}
	.header-main {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
	}
	.heading-row,
	.footer-row,
	.title-block,
	.meta-badges,
	.workspace-meta,
	.workspace-actions,
	.user-summary,
	.identity-status {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}
	.heading-row,
	.footer-row {
		justify-content: space-between;
	}
	.heading-actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		align-items: center;
		gap: 0.55rem;
	}
	.title-block {
		justify-content: space-between;
	}
	h1 {
		margin: 0;
		font-size: 1.2rem;
		font-weight: 700;
		color: var(--surface-12);
	}
	p {
		margin: 0;
		color: var(--surface-10);
		font-size: 0.92rem;
	}
	.meta-chip {
		border-radius: 999px;
		padding: 0.35rem 0.7rem;
		background: var(--surface-3);
		color: var(--surface-11);
		font-size: 0.78rem;
	}
	.workspace-actions {
		justify-content: flex-end;
	}
	.subtle-link {
		color: var(--surface-10);
		font-size: 0.82rem;
		text-decoration: none;
	}
	.subtle-link:hover {
		color: var(--surface-12);
	}
	.muted {
		color: var(--surface-10);
	}
	.mono {
		font-family: 'SFMono-Regular', ui-monospace, monospace;
		font-size: 0.78rem;
	}
	.refresh-button {
		border: 1px solid var(--surface-6);
		background: transparent;
		color: var(--surface-11);
		border-radius: 0.75rem;
		padding: 0.5rem 0.8rem;
		font-size: 0.8rem;
		cursor: pointer;
	}
	.refresh-button:hover {
		background: var(--surface-3);
	}
	.error-text {
		color: #fca5a5;
		font-size: 0.78rem;
	}
	.user-stack {
		display: flex;
		align-items: flex-start;
		justify-content: flex-end;
	}
	.user-button {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		border: 1px solid var(--surface-6);
		background: var(--surface-2);
		border-radius: 0.95rem;
		padding: 0.5rem 0.65rem;
		cursor: pointer;
		color: var(--surface-12);
	}
	.avatar {
		width: 2rem;
		height: 2rem;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		background: var(--accent-8);
		color: white;
		font-weight: 700;
	}
	.user-copy {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
	}
	.user-copy strong {
		font-size: 0.9rem;
	}
	.user-copy small {
		font-size: 0.76rem;
		color: var(--surface-10);
	}
	@media (max-width: 1180px) {
		.studio-header {
			grid-template-columns: 1fr;
		}
		.user-stack {
			justify-content: flex-start;
		}
	}
	@media (max-width: 720px) {
		.title-block,
		.heading-row,
		.footer-row {
			flex-direction: column;
			align-items: flex-start;
		}
		.heading-actions,
		.workspace-actions {
			justify-content: flex-start;
		}
	}
</style>

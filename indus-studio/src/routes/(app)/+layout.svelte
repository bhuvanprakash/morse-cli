<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { auth } from '$stores/auth';
	import { contextStore } from '$lib/stores/context';
	import { AppShell } from '$components/layout';
	import { onMount } from 'svelte';
	import EmptyState from '$lib/components/studio/EmptyState.svelte';
	import ErrorState from '$lib/components/studio/ErrorState.svelte';
	import LoadingSkeleton from '$lib/components/studio/LoadingSkeleton.svelte';

	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();
	let initializing = $state(true);
	let initError = $state('');

	const currentPath = $derived($page.url.pathname);
	const isAdminRoute = $derived.by(() =>
		currentPath.startsWith('/support') || currentPath.startsWith('/security') || currentPath.startsWith('/trust-center')
	);
	const isAdmin = $derived.by(() => {
		const role = String(auth.user?.role ?? '').toLowerCase();
		return role === 'admin' || role === 'owner';
	});

	async function initializeApp() {
		initializing = true;
		initError = '';
		auth.loadFromStorage();

		if (!auth.accessToken) {
			goto('/login');
			return;
		}

		try {
			await auth.fetchUser();
			if (!auth.user) {
				goto('/login');
				return;
			}

			await contextStore.ensureLoaded();
			if (contextStore.error) {
				throw new Error(contextStore.error);
			}

			const done = localStorage.getItem('onboarding_complete');
			const isOnboarding = window.location.pathname.startsWith('/onboarding');
			const hasProject = contextStore.projects.length > 0;
			if ((!done || !hasProject) && !isOnboarding) {
				goto('/onboarding');
				return;
			}
		} catch (error) {
			initError = error instanceof Error ? error.message : 'Failed to load Studio context';
		} finally {
			initializing = false;
		}
	}

	onMount(initializeApp);
</script>

{#if initializing}
	<div class="mx-auto max-w-6xl p-8">
		<LoadingSkeleton lines={10} />
	</div>
{:else if initError}
	<div class="mx-auto max-w-3xl p-8">
		<ErrorState title="Studio failed to initialize" message={initError} onRetry={initializeApp} />
	</div>
{:else if !auth.isAuthenticated}
	<div class="mx-auto max-w-3xl p-8">
		<EmptyState title="Session expired" message="Sign in again to continue using Indus Studio.">
			{#snippet actions()}
				<button class="rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white" onclick={() => goto('/login')}>
					Go to login
				</button>
			{/snippet}
		</EmptyState>
	</div>
{:else if isAdminRoute && !isAdmin}
	<AppShell>
		<EmptyState title="Admin access required" message="This console is restricted to owner/admin roles. You can still use the rest of Studio with your current permissions." />
	</AppShell>
{:else}
	<AppShell>
		{@render children?.()}
	</AppShell>
{/if}

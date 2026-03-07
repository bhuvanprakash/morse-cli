<script lang="ts">
	import { onMount } from 'svelte';
	import { studioApi } from '$lib/api/studio';
	import { auth } from '$stores/auth';
	import { toastStore } from '$stores/toast';
	import { confirmDialog } from '$lib/stores/confirm';
	import PageHeader from '$lib/components/studio/PageHeader.svelte';
	import SectionCard from '$lib/components/studio/SectionCard.svelte';
	import SearchInput from '$lib/components/studio/SearchInput.svelte';
	import EmptyState from '$lib/components/studio/EmptyState.svelte';
	import ErrorState from '$lib/components/studio/ErrorState.svelte';
	import LoadingSkeleton from '$lib/components/studio/LoadingSkeleton.svelte';
	import StatusBadge from '$lib/components/studio/StatusBadge.svelte';
	import SlideOver from '$lib/components/studio/SlideOver.svelte';
	import JsonViewer from '$lib/components/studio/JsonViewer.svelte';
	import { Button } from '$components/ui';

	interface AuthUser {
		id: string;
		email?: string;
		phone?: string;
		status?: string;
		role?: string;
		created_at?: string;
		updated_at?: string;
		last_sign_in_at?: string | null;
		[key: string]: unknown;
	}

	let users = $state<AuthUser[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let searchQuery = $state('');
	let currentPage = $state(1);
	let pageSize = $state(20);
	let hasNext = $state(false);
	let total = $state(0);
	let selectedUser = $state<AuthUser | null>(null);
	let detailOpen = $state(false);
	let searchDebounce: ReturnType<typeof setTimeout> | null = null;

	const canManageUsers = $derived.by(() => {
		const role = String(auth.user?.role ?? '').toLowerCase();
		return role === 'admin' || role === 'owner';
	});

	function formatDate(value?: string | null): string {
		if (!value) return 'Never';
		const dt = new Date(value);
		if (Number.isNaN(dt.getTime())) return String(value);
		return dt.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
	}

	function queueSearch(value: string) {
		searchQuery = value;
		currentPage = 1;
		if (searchDebounce) clearTimeout(searchDebounce);
		searchDebounce = setTimeout(() => {
			void loadUsers();
		}, 250);
	}

	async function loadUsers() {
		loading = true;
		error = null;
		try {
			const payload = (await studioApi.listAuthUsers({
				offset: (currentPage - 1) * pageSize,
				limit: pageSize,
				q: searchQuery.trim() || undefined
			})) as Record<string, unknown>;

			const list = (payload.users as AuthUser[] | undefined) ?? [];
			const offset = Number(payload.offset ?? 0);
			const limit = Number(payload.limit ?? pageSize);
			users = list;
			pageSize = limit > 0 ? limit : pageSize;
			total = list.length < limit ? offset + list.length : offset + list.length + 1;
			hasNext = list.length === limit;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load users';
			toastStore.error(error);
		} finally {
			loading = false;
		}
	}

	async function toggleBan(user: AuthUser) {
		if (!canManageUsers) {
			toastStore.error('Only admin/owner can manage users');
			return;
		}
		const action = String(user.status).toLowerCase() === 'banned' ? 'unban' : 'ban';
		const ok = await confirmDialog.open({
			title: `${action === 'ban' ? 'Ban' : 'Unban'} user`,
			message: `Are you sure you want to ${action} ${user.email ?? user.id}?`,
			confirmText: action === 'ban' ? 'Ban user' : 'Unban user',
			variant: action === 'ban' ? 'danger' : 'default'
		});
		if (!ok) return;

		try {
			if (action === 'ban') {
				await studioApi.banAuthUser(user.id);
				toastStore.success('User banned');
			} else {
				await studioApi.unbanAuthUser(user.id);
				toastStore.success('User unbanned');
			}
			await loadUsers();
		} catch (e) {
			toastStore.error(e instanceof Error ? e.message : `Failed to ${action} user`);
		}
	}

	async function removeUser(user: AuthUser) {
		if (!canManageUsers) {
			toastStore.error('Only admin/owner can delete users');
			return;
		}
		const ok = await confirmDialog.open({
			title: 'Delete user',
			message: `Delete ${user.email ?? user.id}? This action cannot be undone.`,
			confirmText: 'Delete user',
			variant: 'danger'
		});
		if (!ok) return;

		try {
			await studioApi.deleteAuthUser(user.id);
			toastStore.success('User deleted');
			await loadUsers();
		} catch (e) {
			toastStore.error(e instanceof Error ? e.message : 'Failed to delete user');
		}
	}

	function openDetails(user: AuthUser) {
		selectedUser = user;
		detailOpen = true;
	}

	onMount(() => {
		void loadUsers();
		return () => {
			if (searchDebounce) clearTimeout(searchDebounce);
		};
	});
</script>

<div class="space-y-6">
	<PageHeader title="Auth Users" description="Manage authenticated users, status, and account lifecycle." />

	<SectionCard title="Users" description="Search, review activity, and apply administrative actions.">
		<div class="space-y-4">
			<div class="flex flex-col gap-3 md:flex-row md:items-center">
				<div class="min-w-0 flex-1">
					<SearchInput value={searchQuery} placeholder="Search by email, phone, user id..." oninput={queueSearch} />
				</div>
				<div class="flex items-center gap-2">
					<Button variant="secondary" size="sm" onclick={() => void loadUsers()}>Refresh</Button>
				</div>
			</div>

			{#if !canManageUsers}
				<div class="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
					Read-only mode: only admin/owner can ban/unban or delete users.
				</div>
			{/if}

			{#if loading}
				<LoadingSkeleton lines={10} />
			{:else if error}
				<ErrorState title="Could not load users" message={error} onRetry={() => void loadUsers()} />
			{:else if users.length === 0}
				<EmptyState title="No users found" message="No users match your filters yet." />
			{:else}
				<div class="overflow-x-auto rounded-xl border border-surface-6 bg-surface-2">
					<table class="min-w-full text-sm">
						<thead class="bg-surface-3 text-surface-11">
							<tr>
								<th class="px-4 py-3 text-left">User</th>
								<th class="px-4 py-3 text-left">Created</th>
								<th class="px-4 py-3 text-left">Last Sign In</th>
								<th class="px-4 py-3 text-left">Status</th>
								<th class="px-4 py-3 text-left">Role</th>
								<th class="px-4 py-3 text-right">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each users as user (user.id)}
								<tr class="border-t border-surface-6 hover:bg-surface-3/50">
									<td class="px-4 py-3">
										<div class="font-medium text-surface-12">{user.email || user.phone || user.id}</div>
										<div class="text-xs text-surface-10">{user.id}</div>
									</td>
									<td class="px-4 py-3 text-surface-11">{formatDate(user.created_at)}</td>
									<td class="px-4 py-3 text-surface-11">{formatDate(user.last_sign_in_at)}</td>
									<td class="px-4 py-3">
										<StatusBadge status={String(user.status ?? 'active')} />
									</td>
									<td class="px-4 py-3 text-surface-11">{String(user.role ?? 'user')}</td>
									<td class="px-4 py-3">
										<div class="flex justify-end gap-2">
											<Button size="sm" variant="ghost" onclick={() => openDetails(user)}>Details</Button>
											<Button
												size="sm"
												variant={String(user.status).toLowerCase() === 'banned' ? 'secondary' : 'danger'}
												disabled={!canManageUsers}
												onclick={() => void toggleBan(user)}
											>
												{String(user.status).toLowerCase() === 'banned' ? 'Unban' : 'Ban'}
											</Button>
											<Button size="sm" variant="danger" disabled={!canManageUsers} onclick={() => void removeUser(user)}>
												Delete
											</Button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<div class="flex items-center justify-between">
					<p class="text-xs text-surface-10">Page {currentPage} · Showing up to {pageSize} users · Approx total {total}</p>
					<div class="flex items-center gap-2">
						<Button
							variant="secondary"
							size="sm"
							disabled={currentPage <= 1 || loading}
							onclick={() => {
								currentPage -= 1;
								void loadUsers();
							}}
						>
							Previous
						</Button>
						<Button
							variant="secondary"
							size="sm"
							disabled={!hasNext || loading}
							onclick={() => {
								currentPage += 1;
								void loadUsers();
							}}
						>
							Next
						</Button>
					</div>
				</div>
			{/if}
		</div>
	</SectionCard>

	<SlideOver
		open={detailOpen}
		onclose={() => {
			detailOpen = false;
		}}
		title={selectedUser?.email || selectedUser?.id || 'User details'}
	>
		{#if selectedUser}
			<JsonViewer value={selectedUser} maxHeight="32rem" />
		{/if}
	</SlideOver>
</div>

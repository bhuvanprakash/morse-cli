<script lang="ts">
	import { onMount } from 'svelte';
	import { studioApi } from '$lib/api/studio';
	import { toastStore } from '$stores/toast';
	import { confirmDialog } from '$lib/stores/confirm';
	import PageHeader from '$lib/components/studio/PageHeader.svelte';
	import SectionCard from '$lib/components/studio/SectionCard.svelte';
	import EmptyState from '$lib/components/studio/EmptyState.svelte';
	import ErrorState from '$lib/components/studio/ErrorState.svelte';
	import LoadingSkeleton from '$lib/components/studio/LoadingSkeleton.svelte';
	import StatusBadge from '$lib/components/studio/StatusBadge.svelte';
	import FormField from '$lib/components/studio/FormField.svelte';
	import FormActions from '$lib/components/studio/FormActions.svelte';
	import { formatBytes, formatDateTime } from '$lib/utils/format';

	type Bucket = {
		id: string;
		name: string;
		public: boolean;
		file_size_limit?: number;
		created_at?: string;
		updated_at?: string;
	};

	type StorageObject = {
		id: string;
		name: string;
		size: number;
		mime_type?: string;
		updated_at?: string;
		created_at?: string;
		metadata?: Record<string, string>;
	};

	let loadingBuckets = $state(false);
	let loadingObjects = $state(false);
	let creatingBucket = $state(false);
	let uploading = $state(false);
	let error = $state('');
	let buckets = $state<Bucket[]>([]);
	let objects = $state<StorageObject[]>([]);
	let selectedBucket = $state<Bucket | null>(null);
	let prefix = $state('');
	let selectedFile = $state<File | null>(null);

	let createBucketOpen = $state(false);
	let bucketForm = $state({
		name: '',
		public: false,
		file_size_limit: 52428800
	});

	let uploadPath = $state('');
	let uploadMetadata = $state('');

	async function loadBuckets() {
		loadingBuckets = true;
		error = '';
		try {
			const data = await studioApi.listBuckets();
			const rows = ((data?.buckets as Array<Record<string, unknown>>) ?? []).map((row) => ({
				id: String(row.id ?? ''),
				name: String(row.name ?? ''),
				public: Boolean(row.public ?? false),
				file_size_limit: Number(row.file_size_limit ?? 0),
				created_at: row.created_at ? String(row.created_at) : undefined,
				updated_at: row.updated_at ? String(row.updated_at) : undefined
			}));
			buckets = rows;
			if (selectedBucket && !rows.some((bucket) => bucket.id === selectedBucket?.id)) {
				selectedBucket = rows[0] ?? null;
			}
			if (!selectedBucket && rows.length > 0) {
				selectedBucket = rows[0];
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load buckets';
			toastStore.error(error);
		} finally {
			loadingBuckets = false;
		}
	}

	async function loadObjects() {
		if (!selectedBucket) {
			objects = [];
			return;
		}
		loadingObjects = true;
		try {
			const data = await studioApi.listObjects(selectedBucket.name, prefix.trim() || undefined);
			objects = ((data?.objects as Array<Record<string, unknown>>) ?? []).map((row) => ({
				id: String(row.id ?? ''),
				name: String(row.name ?? ''),
				size: Number(row.size ?? 0),
				mime_type: row.mime_type ? String(row.mime_type) : undefined,
				updated_at: row.updated_at ? String(row.updated_at) : undefined,
				created_at: row.created_at ? String(row.created_at) : undefined,
				metadata: (row.metadata as Record<string, string>) ?? {}
			}));
		} catch (err) {
			objects = [];
			toastStore.error(err instanceof Error ? err.message : 'Failed to load objects');
		} finally {
			loadingObjects = false;
		}
	}

	async function createBucket() {
		if (!bucketForm.name.trim()) {
			toastStore.error('Bucket name is required');
			return;
		}
		creatingBucket = true;
		try {
			await studioApi.createBucket({
				name: bucketForm.name.trim(),
				public: bucketForm.public,
				file_size_limit: Number(bucketForm.file_size_limit)
			});
			toastStore.success(`Bucket "${bucketForm.name}" created`);
			createBucketOpen = false;
			bucketForm = { name: '', public: false, file_size_limit: 52428800 };
			await loadBuckets();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to create bucket');
		} finally {
			creatingBucket = false;
		}
	}

	function chooseFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		selectedFile = input.files?.[0] ?? null;
		if (selectedFile && !uploadPath.trim()) {
			uploadPath = selectedFile.name;
		}
	}

	async function uploadObject() {
		if (!selectedBucket) {
			toastStore.error('Select a bucket first');
			return;
		}
		if (!selectedFile) {
			toastStore.error('Choose a file to upload');
			return;
		}
		const path = uploadPath.trim() || selectedFile.name;
		const form = new FormData();
		form.append('file', selectedFile);
		if (uploadMetadata.trim()) {
			form.append('metadata', uploadMetadata.trim());
		}

		uploading = true;
		try {
			await studioApi.uploadObject(selectedBucket.name, path, form);
			toastStore.success('Object uploaded');
			selectedFile = null;
			uploadPath = '';
			uploadMetadata = '';
			await loadObjects();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Upload failed');
		} finally {
			uploading = false;
		}
	}

	async function deleteObject(row: StorageObject) {
		if (!selectedBucket) return;
		const ok = await confirmDialog.open({
			title: 'Delete Object',
			message: `Delete ${row.name}?`,
			confirmText: 'Delete object',
			variant: 'danger'
		});
		if (!ok) return;
		try {
			await studioApi.deleteObject(selectedBucket.name, row.name);
			toastStore.success('Object deleted');
			await loadObjects();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to delete object');
		}
	}

	async function downloadObject(row: StorageObject) {
		if (!selectedBucket) return;
		try {
			await studioApi.downloadObject(selectedBucket.name, row.name);
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Download failed');
		}
	}

	async function deleteBucket(bucket: Bucket) {
		const ok = await confirmDialog.open({
			title: 'Delete Bucket',
			message: `Delete bucket ${bucket.name}? Bucket must be empty.`,
			confirmText: 'Delete bucket',
			variant: 'danger'
		});
		if (!ok) return;
		try {
			await studioApi.deleteBucket(bucket.id);
			toastStore.success('Bucket deleted');
			if (selectedBucket?.id === bucket.id) {
				selectedBucket = null;
			}
			await loadBuckets();
			await loadObjects();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to delete bucket');
		}
	}

	async function toggleBucketVisibility(bucket: Bucket) {
		try {
			await studioApi.updateBucket(bucket.id, { public: !bucket.public });
			toastStore.success(`Bucket ${!bucket.public ? 'made public' : 'made private'}`);
			await loadBuckets();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to update bucket');
		}
	}

	$effect(() => {
		selectedBucket?.id;
		prefix;
		loadObjects();
	});

	onMount(async () => {
		await loadBuckets();
		await loadObjects();
	});
</script>

<div class="space-y-6">
	<PageHeader title="Storage" description="Manage buckets, upload/download files, and control bucket visibility.">
		{#snippet actions()}
			<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={() => (createBucketOpen = true)}>New Bucket</button>
			<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={loadBuckets} disabled={loadingBuckets}>
				{loadingBuckets ? 'Refreshing...' : 'Refresh'}
			</button>
		{/snippet}
	</PageHeader>

	{#if error}
		<ErrorState message={error} onRetry={loadBuckets} />
	{/if}

	<div class="grid gap-6 lg:grid-cols-3">
		<SectionCard title="Buckets" description="Choose a bucket to browse objects.">
			{#if loadingBuckets}
				<LoadingSkeleton lines={6} />
			{:else if buckets.length === 0}
				<EmptyState title="No buckets" message="Create your first bucket to upload objects." />
			{:else}
				<div class="space-y-2">
					{#each buckets as bucket}
						<button class={`w-full rounded-lg border px-3 py-2 text-left ${selectedBucket?.id === bucket.id ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-orange-300 hover:bg-orange-50'}`} onclick={() => (selectedBucket = bucket)}>
							<div class="flex items-center justify-between">
								<div>
									<p class="font-medium text-gray-900">{bucket.name}</p>
									<p class="text-xs text-gray-500">limit: {formatBytes(bucket.file_size_limit || 0)}</p>
								</div>
								<StatusBadge status={bucket.public ? 'public' : 'private'} />
							</div>
						</button>
					{/each}
				</div>
			{/if}
		</SectionCard>

		<div class="lg:col-span-2 space-y-6">
			<SectionCard title="Object Browser" description={selectedBucket ? `Bucket: ${selectedBucket.name}` : 'Select a bucket to browse objects.'}>
				{#if !selectedBucket}
					<EmptyState title="No bucket selected" message="Pick a bucket from the left panel." />
				{:else}
					<div class="mb-3 flex flex-wrap items-center gap-2">
						<input class="input" bind:value={prefix} placeholder="Filter by prefix (folder/path)" />
						<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={loadObjects} disabled={loadingObjects}>Refresh</button>
						<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={() => toggleBucketVisibility(selectedBucket!)}>
							Make {selectedBucket.public ? 'Private' : 'Public'}
						</button>
						<button class="rounded-md border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50" onclick={() => deleteBucket(selectedBucket!)}>Delete Bucket</button>
					</div>

					{#if loadingObjects}
						<LoadingSkeleton lines={8} />
					{:else if objects.length === 0}
						<EmptyState title="No objects" message="Upload files to this bucket to see them here." />
					{:else}
						<div class="overflow-x-auto">
							<table class="min-w-full text-sm">
								<thead>
									<tr class="border-b border-gray-200 text-left text-gray-500">
										<th class="px-2 py-2">Name</th>
										<th class="px-2 py-2">Type</th>
										<th class="px-2 py-2">Size</th>
										<th class="px-2 py-2">Updated</th>
										<th class="px-2 py-2 text-right">Actions</th>
									</tr>
								</thead>
								<tbody>
									{#each objects as row}
										<tr class="border-b border-gray-100">
											<td class="px-2 py-2 font-medium text-gray-900">{row.name}</td>
											<td class="px-2 py-2 text-gray-500">{row.mime_type || '-'}</td>
											<td class="px-2 py-2 text-gray-500">{formatBytes(row.size)}</td>
											<td class="px-2 py-2 text-gray-500">{formatDateTime(row.updated_at || row.created_at)}</td>
											<td class="px-2 py-2 text-right">
												<div class="inline-flex gap-2">
													<button class="action-btn" onclick={() => downloadObject(row)}>Download</button>
													<button class="danger-btn" onclick={() => deleteObject(row)}>Delete</button>
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				{/if}
			</SectionCard>

			<SectionCard title="Upload Object" description="Upload files into the selected bucket with optional custom path.">
				{#if !selectedBucket}
					<EmptyState title="Select a bucket first" message="Upload is available once a bucket is selected." />
				{:else}
					<div class="space-y-3">
						<FormField label="File" required>
							{#snippet children()}
								<input class="input" type="file" onchange={chooseFile} />
							{/snippet}
						</FormField>
						<FormField label="Object Path" hint="Defaults to file name if empty.">
							{#snippet children()}
								<input class="input" bind:value={uploadPath} placeholder="folder/example.pdf" />
							{/snippet}
						</FormField>
						<FormField label="Metadata" hint="Comma-separated key=value pairs.">
							{#snippet children()}
								<input class="input" bind:value={uploadMetadata} placeholder="owner=ops,source=studio" />
							{/snippet}
						</FormField>
						<FormActions>
							<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50" onclick={uploadObject} disabled={uploading || !selectedFile}>
								{uploading ? 'Uploading...' : 'Upload'}
							</button>
						</FormActions>
					</div>
				{/if}
			</SectionCard>
		</div>
	</div>
</div>

{#if createBucketOpen}
	<div
		class="modal-backdrop"
		role="button"
		tabindex="0"
		onclick={(event) => event.currentTarget === event.target && (createBucketOpen = false)}
		onkeydown={(event) => {
			if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') createBucketOpen = false;
		}}
	>
		<div class="modal">
			<h3 class="text-lg font-semibold text-gray-900">Create Bucket</h3>
			<div class="mt-3 space-y-3">
				<FormField label="Bucket Name" required>
					{#snippet children()}
						<input class="input" bind:value={bucketForm.name} placeholder="avatars" />
					{/snippet}
				</FormField>
				<FormField label="File Size Limit (bytes)">
					{#snippet children()}
						<input class="input" type="number" min="1" bind:value={bucketForm.file_size_limit} />
					{/snippet}
				</FormField>
				<label class="inline-flex items-center gap-2 text-sm text-gray-700">
					<input type="checkbox" bind:checked={bucketForm.public} />
					Public bucket
				</label>
			</div>
			<div class="mt-4 flex justify-end gap-2">
				<button class="rounded-md border border-gray-300 px-3 py-2 text-sm" onclick={() => (createBucketOpen = false)}>Cancel</button>
				<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={createBucket} disabled={creatingBucket}>
					{creatingBucket ? 'Creating...' : 'Create Bucket'}
				</button>
			</div>
		</div>
	</div>
{/if}

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
	.action-btn {
		border: 1px solid #cbd5e1;
		background: #fff;
		color: #334155;
		border-radius: 0.4rem;
		padding: 0.35rem 0.55rem;
		font-size: 0.75rem;
	}
	.danger-btn {
		border: 1px solid #fecaca;
		background: #fff5f5;
		color: #b91c1c;
		border-radius: 0.4rem;
		padding: 0.35rem 0.55rem;
		font-size: 0.75rem;
	}
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(15, 23, 42, 0.45);
		display: grid;
		place-items: center;
		padding: 1rem;
		z-index: 60;
	}
	.modal {
		width: min(520px, 100%);
		background: #fff;
		border: 1px solid #e2e8f0;
		border-radius: 0.9rem;
		padding: 1rem;
	}
</style>

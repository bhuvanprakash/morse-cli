<script lang="ts">
	import { onMount } from 'svelte';
	import { studioApi } from '$lib/api/studio';
	import { confirmDialog } from '$lib/stores/confirm';
	import { toastStore } from '$stores/toast';
	import { formatDateTime } from '$lib/utils/format';
	import PageHeader from '$lib/components/studio/PageHeader.svelte';
	import SectionCard from '$lib/components/studio/SectionCard.svelte';
	import ErrorState from '$lib/components/studio/ErrorState.svelte';
	import EmptyState from '$lib/components/studio/EmptyState.svelte';
	import JsonViewer from '$lib/components/studio/JsonViewer.svelte';
	import StatusBadge from '$lib/components/studio/StatusBadge.svelte';
	import Tabs from '$lib/components/studio/Tabs.svelte';

	type Collection = {
		id: string;
		name: string;
		description?: string;
		created_at: string;
		updated_at: string;
	};

	type DocumentItem = {
		id: string;
		content: string;
		metadata: Record<string, unknown>;
		created_at: string;
		updated_at: string;
	};

	type SearchResult = {
		id: string;
		content: string;
		metadata: Record<string, unknown>;
		similarity: number;
		created_at: string;
	};

	let tab = $state<'search' | 'documents'>('search');
	let collections = $state<Collection[]>([]);
	let selectedCollection = $state('');
	let loadingCollections = $state(false);
	let loadingDocuments = $state(false);
	let searching = $state(false);
	let error = $state('');
	let documents = $state<DocumentItem[]>([]);
	let results = $state<SearchResult[]>([]);
	let createOpen = $state(false);
	let uploadOpen = $state(false);
	let createForm = $state({ name: '', description: '' });
	let uploadForm = $state({ content: '', metadata: '{}' });
	let uploadFile = $state<File | null>(null);
	let searchForm = $state({ query: '', limit: 10, min_similarity: 0.5, filter: '{}' });

	const resultCount = $derived(results.length);
	const tabItems = [
		{ key: 'search', label: 'Semantic Search' },
		{ key: 'documents', label: 'Documents' }
	];

	async function loadCollections(preferred = '') {
		loadingCollections = true;
		error = '';
		try {
			const payload = await studioApi.listCollections();
			collections = (payload.collections ?? []) as Collection[];
			if (preferred && collections.some((collection) => collection.name === preferred)) {
				selectedCollection = preferred;
			} else if (!selectedCollection && collections.length > 0) {
				selectedCollection = collections[0].name;
			} else if (selectedCollection && !collections.some((collection) => collection.name === selectedCollection)) {
				selectedCollection = collections[0]?.name ?? '';
			}
			if (selectedCollection) {
				await loadDocuments(selectedCollection);
			} else {
				documents = [];
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load collections';
			toastStore.error(error);
		} finally {
			loadingCollections = false;
		}
	}

	async function loadDocuments(collectionName = selectedCollection) {
		if (!collectionName) return;
		loadingDocuments = true;
		try {
			const payload = await studioApi.listDocuments(collectionName, 100, 0);
			documents = (payload.documents ?? []) as DocumentItem[];
		} catch (err) {
			documents = [];
			toastStore.error(err instanceof Error ? err.message : 'Failed to load documents');
		} finally {
			loadingDocuments = false;
		}
	}

	async function createCollection() {
		if (!createForm.name.trim()) {
			toastStore.error('Collection name is required');
			return;
		}
		try {
			await studioApi.createCollection({
				name: createForm.name.trim(),
				description: createForm.description.trim() || undefined
			});
			toastStore.success(`Collection "${createForm.name}" created`);
			createOpen = false;
			createForm = { name: '', description: '' };
			await loadCollections(createForm.name);
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to create collection');
		}
	}

	async function removeCollection(collection: Collection) {
		const ok = await confirmDialog.open({
			title: 'Delete Collection',
			message: `Delete "${collection.name}" and all documents? This cannot be undone.`,
			confirmText: 'Delete collection',
			variant: 'danger'
		});
		if (!ok) return;
		try {
			await studioApi.deleteCollection(collection.name);
			toastStore.success(`Collection "${collection.name}" deleted`);
			await loadCollections();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to delete collection');
		}
	}

	function onFileSelected(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		uploadFile = input.files?.[0] ?? null;
	}

	async function upsertDocument() {
		if (!selectedCollection) {
			toastStore.error('Select a collection first');
			return;
		}

		let content = uploadForm.content.trim();
		if (uploadFile) {
			content = (await uploadFile.text()).trim();
		}
		if (!content) {
			toastStore.error('Document content is required');
			return;
		}

		let metadata: Record<string, unknown> = {};
		if (uploadForm.metadata.trim()) {
			try {
				metadata = JSON.parse(uploadForm.metadata);
			} catch {
				toastStore.error('Metadata must be valid JSON');
				return;
			}
		}

		try {
			await studioApi.upsertDocuments(selectedCollection, {
				documents: [{ content, metadata }]
			});
			toastStore.success('Document upserted');
			uploadOpen = false;
			uploadForm = { content: '', metadata: '{}' };
			uploadFile = null;
			await loadDocuments(selectedCollection);
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to upsert document');
		}
	}

	async function deleteDocument(item: DocumentItem) {
		if (!selectedCollection) return;
		const ok = await confirmDialog.open({
			title: 'Delete Document',
			message: `Delete document ${item.id}?`,
			confirmText: 'Delete document',
			variant: 'danger'
		});
		if (!ok) return;
		try {
			await studioApi.deleteDocument(selectedCollection, item.id);
			toastStore.success('Document deleted');
			await loadDocuments(selectedCollection);
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to delete document');
		}
	}

	async function runSearch() {
		if (!selectedCollection) {
			toastStore.error('Select a collection first');
			return;
		}
		if (!searchForm.query.trim()) {
			toastStore.error('Search query is required');
			return;
		}

		let filter: Record<string, unknown> | undefined = undefined;
		if (searchForm.filter.trim() && searchForm.filter.trim() !== '{}') {
			try {
				filter = JSON.parse(searchForm.filter);
			} catch {
				toastStore.error('Filter must be valid JSON');
				return;
			}
		}

		searching = true;
		try {
			const payload = await studioApi.searchDocuments(selectedCollection, {
				query: searchForm.query.trim(),
				limit: Number(searchForm.limit),
				min_similarity: Number(searchForm.min_similarity),
				filter
			});
			results = (payload.results ?? []) as SearchResult[];
		} catch (err) {
			results = [];
			toastStore.error(err instanceof Error ? err.message : 'Search failed');
		} finally {
			searching = false;
		}
	}

	onMount(async () => {
		await loadCollections();
	});
</script>

<div class="space-y-6" data-testid="ai-page">
	<PageHeader title="AI Vector Search" description="Create collections, upsert documents, and run semantic search using live embeddings." eyebrow="AI">
		{#snippet actions()}
			<div class="header-actions">
				<select bind:value={selectedCollection} onchange={() => loadDocuments(selectedCollection)} data-testid="ai-collection-select">
					<option value="">Select collection</option>
					{#each collections as collection}
						<option value={collection.name}>{collection.name}</option>
					{/each}
				</select>
				<button class="secondary" onclick={() => loadCollections(selectedCollection)} disabled={loadingCollections} data-testid="ai-refresh">
					{loadingCollections ? 'Refreshing...' : 'Refresh'}
				</button>
				<button class="primary" onclick={() => (createOpen = true)} data-testid="ai-new-collection">New Collection</button>
			</div>
		{/snippet}
	</PageHeader>

	{#if error}
		<ErrorState message={error} onRetry={() => loadCollections(selectedCollection)} />
	{/if}

	<Tabs tabs={tabItems} active={tab} onChange={(key) => (tab = key as 'search' | 'documents')} />

	{#if tab === 'search'}
		<div class="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
			<SectionCard title="Search Query" description="Tune semantic search limits and metadata filters for the selected collection.">
				<h2>Search Query</h2>
				<label for="search-query">Query</label>
				<textarea id="search-query" bind:value={searchForm.query} rows="4" placeholder="e.g. India BaaS backend platform" data-testid="ai-search-query"></textarea>

				<div class="row two">
					<div>
						<label for="search-limit">Limit</label>
						<input id="search-limit" type="number" min="1" max="100" bind:value={searchForm.limit} />
					</div>
					<div>
						<label for="search-similarity">Min Similarity</label>
						<input id="search-similarity" type="number" min="0" max="1" step="0.05" bind:value={searchForm.min_similarity} />
					</div>
				</div>

				<label for="search-filter">Metadata Filter (JSON)</label>
				<textarea id="search-filter" bind:value={searchForm.filter} rows="3"></textarea>

				<button class="primary" onclick={runSearch} disabled={searching || !selectedCollection} data-testid="ai-run-search">
					{searching ? 'Searching...' : 'Search'}
				</button>
			</SectionCard>

			<SectionCard title="Results" description="Similarity-ranked document matches with metadata and content previews.">
				<div class="section-head">
					<h2>Results</h2>
					<small>{resultCount} result(s)</small>
				</div>
				{#if searching}
					<div class="empty">Searching collection...</div>
				{:else if results.length === 0}
					<EmptyState title="No results yet" message="Run a search query against a selected collection to inspect semantic matches." />
				{:else}
					<div class="results">
						{#each results as result}
							<div class="result" data-testid={`ai-result-${result.id}`}>
								<div class="result-head">
									<span class="mono">{result.id}</span>
									<StatusBadge status={`${Math.round(result.similarity * 100)}%`} />
								</div>
								<p>{result.content}</p>
								<JsonViewer value={result.metadata || {}} maxHeight="10rem" />
							</div>
						{/each}
					</div>
				{/if}
			</SectionCard>
		</div>
	{/if}

	{#if tab === 'documents'}
		<SectionCard title={`Documents in ${selectedCollection || '—'}`} description="Upload, upsert, and remove documents from the active AI collection.">
			<div class="space-y-4">
			<div class="section-head">
				<h2>Documents in {selectedCollection || '—'}</h2>
				<div class="header-actions">
					<button class="secondary" onclick={() => loadDocuments(selectedCollection)} disabled={loadingDocuments || !selectedCollection}>
						{loadingDocuments ? 'Refreshing...' : 'Refresh'}
					</button>
					<button class="primary" onclick={() => (uploadOpen = true)} disabled={!selectedCollection} data-testid="ai-open-upsert">Upload / Upsert</button>
				</div>
			</div>
			{#if loadingDocuments}
				<div class="empty">Loading documents...</div>
			{:else if !selectedCollection}
				<EmptyState title="No collection selected" message="Create or choose a collection first to manage source documents." />
			{:else if documents.length === 0}
				<EmptyState title="No documents yet" message="Upload the first document to build a searchable semantic corpus." />
			{:else}
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th>ID</th>
								<th>Content</th>
								<th>Metadata</th>
								<th>Updated</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each documents as item}
								<tr>
									<td class="mono">{item.id}</td>
									<td>{item.content}</td>
									<td><code>{JSON.stringify(item.metadata || {})}</code></td>
									<td>{formatDateTime(item.updated_at || item.created_at)}</td>
									<td><button class="danger" onclick={() => deleteDocument(item)}>Delete</button></td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
			</div>
		</SectionCard>
	{/if}

	<SectionCard title="Collections" description="Browse vector collections, jump into documents, and remove stale datasets safely.">
		<div class="section-head">
			<h2>Collections</h2>
		</div>
		{#if loadingCollections}
			<div class="empty">Loading collections...</div>
		{:else if collections.length === 0}
			<EmptyState title="No collections yet" message="Create a collection to start ingesting content and running semantic search." />
		{:else}
			<div class="collections">
				{#each collections as collection}
					<div class="collection-card" data-testid={`ai-collection-${collection.name}`}>
						<div>
							<strong>{collection.name}</strong>
							<p>{collection.description || 'No description'}</p>
							<small>Created {formatDateTime(collection.created_at)}</small>
						</div>
						<div class="header-actions">
							<button class="secondary" onclick={() => { selectedCollection = collection.name; tab = 'documents'; loadDocuments(collection.name); }}>Open</button>
							<button class="danger" onclick={() => removeCollection(collection)}>Delete</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</SectionCard>
</div>

{#if createOpen}
	<div
		class="modal-backdrop"
		role="button"
		tabindex="0"
		onclick={(event) => event.currentTarget === event.target && (createOpen = false)}
		onkeydown={(event) => (event.key === 'Escape' || event.key === 'Enter') && (createOpen = false)}
	>
		<div class="modal" role="dialog" aria-modal="true">
			<h3>Create Collection</h3>
			<label for="collection-name">Name</label>
			<input id="collection-name" bind:value={createForm.name} placeholder="docs" />
			<label for="collection-description">Description</label>
			<textarea id="collection-description" bind:value={createForm.description} rows="3"></textarea>
			<div class="header-actions">
				<button class="secondary" onclick={() => (createOpen = false)}>Cancel</button>
				<button class="primary" onclick={createCollection} data-testid="ai-create-collection-submit">Create</button>
			</div>
		</div>
	</div>
{/if}

{#if uploadOpen}
	<div
		class="modal-backdrop"
		role="button"
		tabindex="0"
		onclick={(event) => event.currentTarget === event.target && (uploadOpen = false)}
		onkeydown={(event) => (event.key === 'Escape' || event.key === 'Enter') && (uploadOpen = false)}
	>
		<div class="modal" role="dialog" aria-modal="true">
			<h3>Upsert Document</h3>
			<label for="upload-content">Content</label>
			<textarea id="upload-content" bind:value={uploadForm.content} rows="6" placeholder="Paste document content"></textarea>
			<label for="upload-file">Or upload text file</label>
			<input id="upload-file" type="file" accept=".txt,.md,.json" onchange={onFileSelected} />
			{#if uploadFile}
				<small>Selected: {uploadFile.name}</small>
			{/if}
			<label for="upload-metadata">Metadata JSON</label>
			<textarea id="upload-metadata" bind:value={uploadForm.metadata} rows="3"></textarea>
			<div class="header-actions">
				<button class="secondary" onclick={() => (uploadOpen = false)}>Cancel</button>
				<button class="primary" onclick={upsertDocument} data-testid="ai-upsert-submit">Upsert</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.header-actions { display: flex; gap: 0.55rem; flex-wrap: wrap; align-items: center; }
	.primary, .secondary, .danger {
		border-radius: 0.65rem;
		padding: 0.55rem 0.9rem;
		border: 1px solid var(--surface-6);
		background: var(--surface-2);
		color: var(--surface-12);
		cursor: pointer;
	}
	.primary { background: #f97316; border-color: #f97316; color: #fff; }
	.danger { border-color: #7f1d1d; color: #fecaca; background: rgba(127, 29, 29, 0.18); }
	label { font-size: 0.82rem; color: var(--surface-10); }
	input, textarea, select {
		border: 1px solid var(--surface-6);
		border-radius: 0.6rem;
		padding: 0.55rem 0.65rem;
		background: var(--surface-2);
		color: var(--surface-12);
	}
	.row.two { display: grid; grid-template-columns: 1fr 1fr; gap: 0.65rem; }
	.section-head { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; margin-bottom: 0.45rem; flex-wrap: wrap; }
	.section-head h2 { margin: 0; font-size: 1rem; }
	.empty { color: var(--surface-10); padding: 1rem 0.2rem; }
	.results { display: flex; flex-direction: column; gap: 0.65rem; max-height: 560px; overflow: auto; }
	.result { background: var(--surface-2); border: 1px solid var(--surface-6); border-radius: 0.7rem; padding: 0.65rem; }
	.result-head { display: flex; justify-content: space-between; gap: 0.6rem; align-items: center; }
	.result p { margin: 0.5rem 0; }
	.table-wrap { overflow: auto; }
	table { width: 100%; border-collapse: collapse; }
	th, td { border-bottom: 1px solid var(--surface-6); padding: 0.55rem; text-align: left; vertical-align: top; }
	.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
	code { white-space: pre-wrap; word-break: break-word; color: var(--surface-11); }
	.collections { display: flex; flex-direction: column; gap: 0.65rem; }
	.collection-card {
		border: 1px solid var(--surface-6);
		background: var(--surface-1);
		border-radius: 0.75rem;
		padding: 0.7rem;
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		align-items: center;
	}
	.collection-card p { margin: 0.25rem 0; color: var(--surface-10); }
	.collection-card small { color: var(--surface-10); }
	.modal-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(2, 6, 23, 0.55);
		display: grid;
		place-items: center;
		padding: 1rem;
		z-index: 40;
	}
	.modal {
		width: min(640px, 100%);
		background: var(--surface-1);
		border: 1px solid var(--surface-6);
		border-radius: 0.95rem;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.modal h3 { margin: 0 0 0.25rem; }
</style>

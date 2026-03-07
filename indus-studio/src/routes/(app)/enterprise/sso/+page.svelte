<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { studioApi } from '$lib/api/studio';
	import { contextStore } from '$lib/stores/context';
	import { confirmDialog } from '$lib/stores/confirm';
	import { toastStore } from '$stores/toast';
	import { formatDateTime } from '$lib/utils/format';
	import { safeJsonParse, prettyJson } from '$lib/utils/json';
	import PageHeader from '$lib/components/studio/PageHeader.svelte';
	import SectionCard from '$lib/components/studio/SectionCard.svelte';
	import StatusBadge from '$lib/components/studio/StatusBadge.svelte';
	import Tabs from '$lib/components/studio/Tabs.svelte';
	import JsonViewer from '$lib/components/studio/JsonViewer.svelte';

	type ProviderType = 'saml' | 'oidc';
	interface EnterpriseConnection {
		id: string;
		name: string;
		slug: string;
		domain: string;
		provider_type: ProviderType;
		provider_name: string;
		config: Record<string, any>;
		is_active: boolean;
		created_at?: string;
		updated_at?: string;
	}

	interface DomainRecord {
		domain: string;
		verified: boolean;
		verification_token?: string;
		txt_record?: string;
		project_id?: string;
	}

	function toEnterpriseConnection(entry: Record<string, unknown>): EnterpriseConnection {
		return {
			id: String(entry.id ?? ''),
			name: String(entry.name ?? ''),
			slug: String(entry.slug ?? ''),
			domain: String(entry.domain ?? ''),
			provider_type: (entry.provider_type === 'oidc' ? 'oidc' : 'saml') as ProviderType,
			provider_name: String(entry.provider_name ?? ''),
			config:
				typeof entry.config === 'string'
					? safeJsonParse<Record<string, any>>(entry.config, {})
					: ((entry.config as Record<string, any>) ?? {}),
			is_active: entry.is_active !== false,
			created_at: entry.created_at ? String(entry.created_at) : undefined,
			updated_at: entry.updated_at ? String(entry.updated_at) : undefined
		};
	}

	let loading = $state(false);
	let error = $state('');
	let activeTab = $state<'domains' | 'connections' | 'events'>('domains');

	let connections = $state<EnterpriseConnection[]>([]);
	let domainRecords = $state<DomainRecord[]>([]);
	let events = $state<Array<Record<string, any>>>([]);
	let selectedConnection = $state<EnterpriseConnection | null>(null);
	let metadataXML = $state('');
	let scimTokens = $state<Array<Record<string, any>>>([]);

	let showDomainModal = $state(false);
	let showConnectionModal = $state(false);
	let editingConnection = $state<EnterpriseConnection | null>(null);

	let domainForm = $state({
		domain: '',
		org_id: '',
		project_id: '',
		verification_token: ''
	});

	let connectionForm = $state({
		name: '',
		slug: '',
		domain: '',
		provider_type: 'saml' as ProviderType,
		provider_name: '',
		config_text: prettyJson({
			sso_url: '',
			entity_id: '',
			acs_url: '',
			certificate: ''
		})
	});

	let scimTokenName = $state('Okta Provisioning Token');
	let baseOrigin = $state('');

	const tabs = [
		{ key: 'domains', label: 'Verified Domains' },
		{ key: 'connections', label: 'Connections' },
		{ key: 'events', label: 'SSO Events' }
	];

	const acsURL = $derived.by(() => {
		if (!selectedConnection) return '';
		return `${baseOrigin}/auth/sso/${selectedConnection.slug}/acs`;
	});

	const metadataURL = $derived.by(() => {
		if (!selectedConnection) return '';
		return `${baseOrigin}/auth/sso/${selectedConnection.slug}/metadata`;
	});

	const scimBaseURL = $derived.by(() => `${baseOrigin}/scim/v2`);

	function toConnectionConfigText(connection?: EnterpriseConnection) {
		return prettyJson(connection?.config ?? {
			sso_url: '',
			entity_id: '',
			acs_url: '',
			certificate: '',
			issuer_url: '',
			client_id: '',
			client_secret: '',
			auth_url: '',
			token_url: '',
			userinfo_url: '',
			redirect_url: '',
			scopes: 'openid profile email'
		});
	}

	function resetDomainForm() {
		domainForm = {
			domain: '',
			org_id: contextStore.activeOrganizationId || '',
			project_id: contextStore.activeProjectId || '',
			verification_token: ''
		};
	}

	function resetConnectionForm() {
		connectionForm = {
			name: '',
			slug: '',
			domain: '',
			provider_type: 'saml',
			provider_name: '',
			config_text: toConnectionConfigText()
		};
		editingConnection = null;
	}

	function deriveDomains() {
		const map = new Map<string, DomainRecord>();
		for (const conn of connections) {
			if (!map.has(conn.domain)) {
				map.set(conn.domain, {
					domain: conn.domain,
					verified: true,
					project_id: contextStore.activeProjectId || undefined
				});
			}
		}
		for (const record of domainRecords) {
			map.set(record.domain, record);
		}
		domainRecords = Array.from(map.values()).sort((a, b) => a.domain.localeCompare(b.domain));
	}

	async function loadConnections() {
		const data = await studioApi.listEnterpriseConnections();
		connections = (data ?? []).map((entry) => toEnterpriseConnection(entry as Record<string, unknown>));
		deriveDomains();
	}

	async function loadEvents() {
		events = (await studioApi.listEnterpriseEvents()) ?? [];
	}

	async function loadSCIMTokens() {
		if (!selectedConnection) {
			scimTokens = [];
			return;
		}
		scimTokens = (await studioApi.listSCIMTokens(selectedConnection.id)) ?? [];
	}

	async function openConnection(connection: EnterpriseConnection) {
		selectedConnection = connection;
		metadataXML = '';
		if (connection.provider_type === 'saml') {
			try {
				metadataXML = await studioApi.getSSOMetadata(connection.slug);
			} catch (err) {
				metadataXML = err instanceof Error ? err.message : 'Failed to load metadata';
			}
		}
		await loadSCIMTokens();
	}

	async function refreshAll() {
		loading = true;
		error = '';
		try {
			await Promise.all([loadConnections(), loadEvents()]);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load enterprise SSO data';
			toastStore.error(error);
		} finally {
			loading = false;
		}
	}

	function openDomainModal() {
		resetDomainForm();
		showDomainModal = true;
	}

	async function verifyDomain() {
		if (!domainForm.domain.trim()) {
			toastStore.error('Domain is required');
			return;
		}
		try {
			const payload: Record<string, string> = {
				domain: domainForm.domain.trim().toLowerCase(),
				org_id: domainForm.org_id || contextStore.activeOrganizationId || '',
				project_id: domainForm.project_id || contextStore.activeProjectId || ''
			};
			if (domainForm.verification_token.trim()) {
				payload.verification_token = domainForm.verification_token.trim();
			}
			const res = await studioApi.verifyDomain(payload);
			const record: DomainRecord = {
				domain: String(res.domain),
				verified: Boolean(res.verified),
				verification_token: String(res.verification_token || ''),
				txt_record: String(res.txt_record || ''),
				project_id: String(res.project_id || contextStore.activeProjectId || '')
			};
			domainRecords = [record, ...domainRecords.filter((row) => row.domain !== record.domain)];
			deriveDomains();
			if (record.verified) {
				toastStore.success(`Domain ${record.domain} verified`);
				showDomainModal = false;
			} else {
				domainForm.verification_token = record.verification_token || '';
				toastStore.success('TXT token generated. Add it to DNS and verify again.');
			}
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Domain verification failed');
		}
	}

	function openConnectionModal(connection?: EnterpriseConnection) {
		if (!connection) {
			resetConnectionForm();
			showConnectionModal = true;
			return;
		}
		editingConnection = connection;
		connectionForm = {
			name: connection.name,
			slug: connection.slug,
			domain: connection.domain,
			provider_type: connection.provider_type,
			provider_name: connection.provider_name,
			config_text: toConnectionConfigText(connection)
		};
		showConnectionModal = true;
	}

	async function saveConnection() {
		if (!connectionForm.name.trim() || !connectionForm.slug.trim() || !connectionForm.domain.trim()) {
			toastStore.error('Name, slug, and domain are required');
			return;
		}
		const config = safeJsonParse<Record<string, any>>(connectionForm.config_text || '{}', {});
		const payload: Record<string, any> = {
			name: connectionForm.name.trim(),
			slug: connectionForm.slug.trim().toLowerCase(),
			domain: connectionForm.domain.trim().toLowerCase(),
			provider_type: connectionForm.provider_type,
			provider_name: connectionForm.provider_name.trim(),
			config
		};
		if (contextStore.activeOrganizationId) payload.org_id = contextStore.activeOrganizationId;
		if (contextStore.activeProjectId) payload.project_id = contextStore.activeProjectId;
		try {
			if (editingConnection) {
				await studioApi.updateEnterpriseConnection(editingConnection.id, {
					name: payload.name,
					domain: payload.domain,
					provider_name: payload.provider_name,
					config: payload.config,
					is_active: editingConnection.is_active
				});
				toastStore.success('Connection updated');
			} else {
				await studioApi.createEnterpriseConnection(payload);
				toastStore.success('Connection created');
			}
			showConnectionModal = false;
			resetConnectionForm();
			await loadConnections();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Connection save failed');
		}
	}

	async function toggleConnection(connection: EnterpriseConnection) {
		try {
			await studioApi.updateEnterpriseConnection(connection.id, {
				name: connection.name,
				domain: connection.domain,
				provider_name: connection.provider_name,
				config: connection.config,
				is_active: !connection.is_active
			});
			toastStore.success(`Connection ${!connection.is_active ? 'enabled' : 'disabled'}`);
			await loadConnections();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to update connection');
		}
	}

	async function deleteConnection(connection: EnterpriseConnection) {
		const ok = await confirmDialog.open({
			title: 'Delete Enterprise Connection',
			message: `Delete ${connection.name} (${connection.slug})?`,
			confirmText: 'Delete connection',
			variant: 'danger'
		});
		if (!ok) return;
		try {
			await studioApi.deleteEnterpriseConnection(connection.id);
			toastStore.success('Connection deleted');
			if (selectedConnection?.id === connection.id) {
				selectedConnection = null;
				scimTokens = [];
				metadataXML = '';
			}
			await loadConnections();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to delete connection');
		}
	}

	async function createSCIMToken() {
		if (!selectedConnection) return;
		if (!scimTokenName.trim()) {
			toastStore.error('Token name is required');
			return;
		}
		try {
			const res = await studioApi.createSCIMToken(selectedConnection.id, { name: scimTokenName.trim(), project_id: contextStore.activeProjectId || '' });
			if (res.token) {
				await navigator.clipboard.writeText(String(res.token));
			}
			toastStore.success('SCIM token created and copied');
			await loadSCIMTokens();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to create SCIM token');
		}
	}

	async function rotateSCIMToken(token: Record<string, any>) {
		if (!selectedConnection) return;
		try {
			const res = await studioApi.rotateSCIMToken(selectedConnection.id, String(token.id));
			if (res.token) {
				await navigator.clipboard.writeText(String(res.token));
			}
			toastStore.success('SCIM token rotated and copied');
			await loadSCIMTokens();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Rotate failed');
		}
	}

	async function revokeSCIMToken(token: Record<string, any>) {
		if (!selectedConnection) return;
		const ok = await confirmDialog.open({
			title: 'Revoke SCIM Token',
			message: `Revoke token ${token.name}?`,
			confirmText: 'Revoke token',
			variant: 'danger'
		});
		if (!ok) return;
		try {
			await studioApi.revokeSCIMToken(selectedConnection.id, String(token.id));
			toastStore.success('SCIM token revoked');
			await loadSCIMTokens();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Revoke failed');
		}
	}

	async function copyText(value: string, label: string) {
		await navigator.clipboard.writeText(value);
		toastStore.success(`${label} copied`);
	}

	onMount(async () => {
		baseOrigin = browser ? window.location.origin : '';
		await contextStore.ensureLoaded();
		await refreshAll();
	});
</script>

<div class="space-y-6" data-testid="enterprise-sso-page">
	<PageHeader title="Enterprise SSO & SCIM" description="Configure domain verification, SAML/OIDC enterprise login, and SCIM provisioning." >
		{#snippet actions()}
			<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={refreshAll} disabled={loading} data-testid="enterprise-sso-refresh">
				{loading ? 'Refreshing...' : 'Refresh'}
			</button>
		{/snippet}
	</PageHeader>

	{#if error}
		<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
	{/if}

	<Tabs tabs={tabs} active={activeTab} onChange={(key) => (activeTab = key as typeof activeTab)} />

	{#if activeTab === 'domains'}
		<SectionCard title="Verified Domains" description="Map enterprise domains to organizations/projects before enabling SSO.">
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<p class="text-sm text-gray-500">{domainRecords.length} domain entries</p>
					<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={openDomainModal} data-testid="enterprise-domain-open">Add / Verify Domain</button>
				</div>
				<div class="overflow-x-auto">
					<table class="min-w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 text-left text-gray-500">
								<th class="px-2 py-2">Domain</th>
								<th class="px-2 py-2">Status</th>
								<th class="px-2 py-2">TXT Record</th>
								<th class="px-2 py-2">Project</th>
							</tr>
						</thead>
						<tbody>
							{#if domainRecords.length === 0}
								<tr><td class="px-2 py-4 text-gray-500" colspan="4">No domains configured yet.</td></tr>
							{:else}
								{#each domainRecords as domain}
									<tr class="border-b border-gray-100">
										<td class="px-2 py-2 font-mono">{domain.domain}</td>
										<td class="px-2 py-2"><StatusBadge status={domain.verified ? 'verified' : 'pending'} /></td>
										<td class="px-2 py-2 font-mono text-xs">{domain.txt_record || '-'}</td>
										<td class="px-2 py-2 font-mono text-xs">{domain.project_id || contextStore.activeProjectId || '-'}</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			</div>
		</SectionCard>
	{/if}

	{#if activeTab === 'connections'}
		<SectionCard title="Enterprise Connections" description="Create and manage SAML/OIDC identity provider integrations.">
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<p class="text-sm text-gray-500">{connections.length} configured IdP connections</p>
						<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={() => openConnectionModal()} data-testid="enterprise-connection-open">
							New Connection
						</button>
				</div>

				<div class="grid gap-3 md:grid-cols-2">
					{#if connections.length === 0}
						<div class="rounded-md border border-dashed border-gray-300 px-3 py-4 text-sm text-gray-500 md:col-span-2">No enterprise connections yet.</div>
					{:else}
						{#each connections as conn}
							<div class="rounded-lg border border-gray-200 p-3" data-testid={`enterprise-connection-${conn.slug}`}>
								<div class="mb-2 flex items-center justify-between">
									<p class="font-semibold">{conn.name}</p>
									<StatusBadge status={conn.provider_type} />
								</div>
								<p class="text-xs text-gray-500">{conn.slug} • {conn.domain}</p>
								<p class="mt-1 text-xs text-gray-500">Provider: {conn.provider_name}</p>
								<div class="mt-3 flex flex-wrap gap-2">
									<button class="rounded border px-2 py-1 text-xs" onclick={() => openConnection(conn)}>Open</button>
									<button class="rounded border px-2 py-1 text-xs" onclick={() => openConnectionModal(conn)}>Edit</button>
									<button class="rounded border px-2 py-1 text-xs" onclick={() => toggleConnection(conn)}>{conn.is_active ? 'Disable' : 'Enable'}</button>
									<button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onclick={() => deleteConnection(conn)}>Delete</button>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		</SectionCard>

		{#if selectedConnection}
			<SectionCard title={`Connection Details: ${selectedConnection.name}`} description="Copy URLs for IdP setup and manage SCIM tokens.">
				<div class="space-y-4">
					<div class="grid gap-3 md:grid-cols-3">
						<div class="rounded border border-gray-200 p-3">
							<p class="text-xs text-gray-500">ACS URL</p>
							<p class="mt-1 break-all font-mono text-xs">{acsURL}</p>
							<button class="mt-2 rounded border px-2 py-1 text-xs" onclick={() => copyText(acsURL, 'ACS URL')} data-testid="enterprise-copy-acs">Copy</button>
						</div>
						<div class="rounded border border-gray-200 p-3">
							<p class="text-xs text-gray-500">Metadata URL</p>
							<p class="mt-1 break-all font-mono text-xs">{metadataURL}</p>
							<button class="mt-2 rounded border px-2 py-1 text-xs" onclick={() => copyText(metadataURL, 'Metadata URL')} data-testid="enterprise-copy-metadata">Copy</button>
						</div>
						<div class="rounded border border-gray-200 p-3">
							<p class="text-xs text-gray-500">SCIM Base URL</p>
							<p class="mt-1 break-all font-mono text-xs">{scimBaseURL}</p>
							<button class="mt-2 rounded border px-2 py-1 text-xs" onclick={() => copyText(scimBaseURL, 'SCIM base URL')} data-testid="enterprise-copy-scim">Copy</button>
						</div>
					</div>

					<div class="grid gap-3 md:grid-cols-2">
						<div class="rounded border border-gray-200 p-3">
							<p class="mb-2 text-sm font-semibold">Connection Config</p>
							<JsonViewer value={selectedConnection.config} maxHeight="18rem" />
						</div>
						<div class="rounded border border-gray-200 p-3">
							<p class="mb-2 text-sm font-semibold">SAML Metadata</p>
							<div class="max-h-72 overflow-auto rounded-xl border border-white/10 bg-slate-950/80 p-3 font-mono text-xs leading-6 text-slate-200">
								{metadataXML || 'Metadata available for SAML connections.'}
							</div>
						</div>
					</div>

					<div class="rounded border border-gray-200 p-3">
						<div class="mb-2 flex items-center justify-between">
							<p class="text-sm font-semibold">SCIM Tokens</p>
							<div class="flex gap-2">
								<input class="min-w-56" bind:value={scimTokenName} placeholder="Token name" data-testid="enterprise-scim-token-name" />
								<button class="rounded bg-orange-600 px-3 py-2 text-xs font-medium text-white hover:bg-orange-700" onclick={createSCIMToken} data-testid="enterprise-scim-token-create">Create Token</button>
							</div>
						</div>
						<div class="overflow-x-auto">
							<table class="min-w-full text-sm">
								<thead>
									<tr class="border-b border-gray-200 text-left text-gray-500">
										<th class="px-2 py-2">Name</th>
										<th class="px-2 py-2">Prefix</th>
										<th class="px-2 py-2">Last Used</th>
										<th class="px-2 py-2">Status</th>
										<th class="px-2 py-2">Actions</th>
									</tr>
								</thead>
								<tbody>
									{#if scimTokens.length === 0}
										<tr><td class="px-2 py-4 text-gray-500" colspan="5">No SCIM tokens for this connection.</td></tr>
									{:else}
										{#each scimTokens as token}
											<tr class="border-b border-gray-100">
												<td class="px-2 py-2">{token.name}</td>
												<td class="px-2 py-2 font-mono text-xs">{token.token_prefix}</td>
												<td class="px-2 py-2 text-gray-500">{formatDateTime(token.last_used_at)}</td>
												<td class="px-2 py-2"><StatusBadge status={token.revoked_at ? 'revoked' : 'active'} /></td>
												<td class="px-2 py-2">
													<div class="flex gap-2">
														<button class="rounded border px-2 py-1 text-xs" onclick={() => rotateSCIMToken(token)}>Rotate</button>
														<button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onclick={() => revokeSCIMToken(token)}>Revoke</button>
													</div>
												</td>
											</tr>
										{/each}
									{/if}
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</SectionCard>
		{/if}
	{/if}

	{#if activeTab === 'events'}
		<SectionCard title="Recent SSO Events" description="Latest login outcomes across enterprise identity providers.">
			<div class="overflow-x-auto">
				<table class="min-w-full text-sm">
					<thead>
						<tr class="border-b border-gray-200 text-left text-gray-500">
							<th class="px-2 py-2">When</th>
							<th class="px-2 py-2">Provider</th>
							<th class="px-2 py-2">Domain</th>
							<th class="px-2 py-2">Email</th>
							<th class="px-2 py-2">Status</th>
							<th class="px-2 py-2">IP</th>
						</tr>
					</thead>
					<tbody>
						{#if events.length === 0}
							<tr><td class="px-2 py-4 text-gray-500" colspan="6">No SSO events recorded yet.</td></tr>
						{:else}
							{#each events as event}
								<tr class="border-b border-gray-100">
									<td class="px-2 py-2 text-gray-500">{formatDateTime(event.created_at)}</td>
									<td class="px-2 py-2">{event.provider_type || event.provider || '-'}</td>
									<td class="px-2 py-2">{event.domain || '-'}</td>
									<td class="px-2 py-2">{event.user_email || event.email || '-'}</td>
									<td class="px-2 py-2"><StatusBadge status={event.status || 'unknown'} /></td>
									<td class="px-2 py-2">{event.ip_address || '-'}</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</SectionCard>
	{/if}
</div>

{#if showDomainModal}
	<div class="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4">
		<div class="w-full max-w-xl rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
			<h3 class="text-lg font-semibold">Verify Enterprise Domain</h3>
			<div class="mt-3 grid gap-3">
				<label class="field">
					<span>Domain</span>
					<input bind:value={domainForm.domain} placeholder="acme.co.in" data-testid="enterprise-domain-input" />
				</label>
				<label class="field">
					<span>Organization ID</span>
					<input bind:value={domainForm.org_id} placeholder="org-uuid" data-testid="enterprise-org-input" />
				</label>
				<label class="field">
					<span>Project ID</span>
					<input bind:value={domainForm.project_id} placeholder="project-uuid" data-testid="enterprise-project-input" />
				</label>
				<label class="field">
					<span>Verification Token (for final verify step)</span>
					<input bind:value={domainForm.verification_token} placeholder="Paste token after DNS TXT is set" data-testid="enterprise-domain-token-input" />
				</label>
			</div>
			<div class="mt-4 flex justify-end gap-2">
				<button class="rounded-md border border-gray-300 px-3 py-2 text-sm" onclick={() => (showDomainModal = false)}>Cancel</button>
				<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={verifyDomain} data-testid="enterprise-domain-submit">Verify Domain</button>
			</div>
		</div>
	</div>
{/if}

{#if showConnectionModal}
	<div class="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4">
		<div class="w-full max-w-3xl rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
			<h3 class="text-lg font-semibold">{editingConnection ? 'Edit Enterprise Connection' : 'New Enterprise Connection'}</h3>
			<div class="mt-3 grid gap-3 md:grid-cols-2">
				<label class="field">
					<span>Name</span>
					<input bind:value={connectionForm.name} placeholder="Acme Corp SSO" data-testid="enterprise-connection-name" />
				</label>
				<label class="field">
					<span>Slug</span>
					<input bind:value={connectionForm.slug} placeholder="acme-sso" disabled={!!editingConnection} data-testid="enterprise-connection-slug" />
				</label>
				<label class="field">
					<span>Domain</span>
					<input bind:value={connectionForm.domain} placeholder="acme.co.in" data-testid="enterprise-connection-domain" />
				</label>
				<label class="field">
					<span>Provider Type</span>
					<select bind:value={connectionForm.provider_type} disabled={!!editingConnection} data-testid="enterprise-provider-type">
						<option value="saml">SAML</option>
						<option value="oidc">OIDC</option>
					</select>
				</label>
				<label class="field md:col-span-2">
					<span>Provider Name</span>
					<input bind:value={connectionForm.provider_name} placeholder="Okta / Azure AD" data-testid="enterprise-provider-name" />
				</label>
				<label class="field md:col-span-2">
					<span>Configuration JSON</span>
					<textarea rows="10" bind:value={connectionForm.config_text} data-testid="enterprise-config-text"></textarea>
				</label>
			</div>
			<div class="mt-4 flex justify-end gap-2">
				<button class="rounded-md border border-gray-300 px-3 py-2 text-sm" onclick={() => { showConnectionModal = false; resetConnectionForm(); }}>Cancel</button>
				<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={saveConnection} data-testid="enterprise-connection-submit">
					{editingConnection ? 'Save Changes' : 'Create Connection'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.field { display: flex; flex-direction: column; gap: 0.35rem; }
	.field span { font-size: 0.8rem; color: #64748b; }
	input, select, textarea {
		border: 1px solid #cbd5e1;
		border-radius: 0.6rem;
		padding: 0.55rem 0.7rem;
		font-size: 0.875rem;
	}
</style>

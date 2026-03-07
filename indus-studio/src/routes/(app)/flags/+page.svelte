<script lang="ts">
	import { onMount } from 'svelte';
	import { studioApi } from '$lib/api/studio';
	import { contextStore } from '$lib/stores/context';
	import { confirmDialog } from '$lib/stores/confirm';
	import { toastStore } from '$stores/toast';
	import { safeJsonParse, prettyJson } from '$lib/utils/json';
	import PageHeader from '$lib/components/studio/PageHeader.svelte';
	import SectionCard from '$lib/components/studio/SectionCard.svelte';
	import Tabs from '$lib/components/studio/Tabs.svelte';
	import StatusBadge from '$lib/components/studio/StatusBadge.svelte';
	import EmptyState from '$lib/components/studio/EmptyState.svelte';
	import ErrorState from '$lib/components/studio/ErrorState.svelte';
	import JsonViewer from '$lib/components/studio/JsonViewer.svelte';

	type EnvironmentName = 'development' | 'staging' | 'production';
	type RuleType = 'percentage' | 'user_ids' | 'user_property';
	interface TargetingRule {
		type: RuleType;
		percentage?: number;
		user_ids?: string[];
		property?: { name: string; operator: string; value: string };
		return_value: string;
	}

	let tab = $state<'flags' | 'remote'>('flags');
	let loading = $state(false);
	let error = $state('');
	let environment = $state<EnvironmentName>((contextStore.environment as EnvironmentName) || 'production');
	let environments = $state<Array<{ id: string; name: string }>>([]);

	let flags = $state<Array<Record<string, any>>>([]);
	let remoteConfigs = $state<Array<Record<string, any>>>([]);

	let showFlagModal = $state(false);
	let showConfigModal = $state(false);
	let editingFlag = $state<Record<string, any> | null>(null);
	let editingConfig = $state<Record<string, any> | null>(null);

	let evaluateInput = $state('{\n  "user_id": "test-user",\n  "user_properties": {\n    "city": "Mumbai"\n  }\n}');
	let evaluateOutput = $state('');

	let flagForm = $state({
		key: '',
		value_type: 'boolean',
		default_value: 'false',
		description: '',
		is_active: true,
		targeting_rules: [] as Array<Record<string, any>>
	});

	let configForm = $state({
		key: '',
		value: '',
		value_type: 'string',
		description: '',
		is_secret: false
	});

	const tabs = [
		{ key: 'flags', label: 'Feature Flags' },
		{ key: 'remote', label: 'Remote Config' }
	];

	function currentEnvironmentId() {
		return environments.find((entry) => entry.name === environment)?.id || '';
	}

	function resetFlagForm() {
		flagForm = {
			key: '',
			value_type: 'boolean',
			default_value: 'false',
			description: '',
			is_active: true,
			targeting_rules: []
		};
		editingFlag = null;
	}

	function resetConfigForm() {
		configForm = {
			key: '',
			value: '',
			value_type: 'string',
			description: '',
			is_secret: false
		};
		editingConfig = null;
	}

	function normalizeRules(rules: Array<Record<string, any>>): TargetingRule[] {
		return rules.map((rule) => {
			if (rule.type === 'percentage') {
				return {
					type: 'percentage',
					percentage: Number(rule.percentage ?? 0),
					return_value: String(rule.return_value ?? 'true')
				};
			}
			if (rule.type === 'user_ids') {
				return {
					type: 'user_ids',
					user_ids: Array.isArray(rule.user_ids)
						? rule.user_ids
						: String(rule.user_ids_text || '')
								.split(/[\s,]+/)
								.map((value) => value.trim())
								.filter(Boolean),
					return_value: String(rule.return_value ?? 'true')
				};
			}
			return {
				type: 'user_property',
				property: {
					name: String(rule.property?.name ?? ''),
					operator: String(rule.property?.operator ?? 'eq'),
					value: String(rule.property?.value ?? '')
				},
				return_value: String(rule.return_value ?? 'true')
			};
		});
	}

	function addRule(type: RuleType) {
		if (type === 'percentage') {
			flagForm.targeting_rules = [...flagForm.targeting_rules, { type, percentage: 10, return_value: 'true' }];
			return;
		}
		if (type === 'user_ids') {
			flagForm.targeting_rules = [...flagForm.targeting_rules, { type, user_ids_text: '', return_value: 'true' }];
			return;
		}
		flagForm.targeting_rules = [
			...flagForm.targeting_rules,
			{ type, property: { name: '', operator: 'eq', value: '' }, return_value: 'true' }
		];
	}

	function removeRule(index: number) {
		flagForm.targeting_rules = flagForm.targeting_rules.filter((_, idx) => idx !== index);
	}

	async function loadEnvironments() {
		const envRows = await studioApi.listEnvironments();
		environments = (envRows ?? []).map((env) => ({ id: String(env.id), name: String(env.name) }));
		if (!environments.some((entry) => entry.name === environment)) {
			environment = (environments[0]?.name as EnvironmentName) ?? 'production';
		}
	}

	async function loadFlags() {
		const data = await studioApi.listFlags(environment);
		flags = (data ?? []) as Array<Record<string, any>>;
	}

	async function loadRemoteConfig() {
		const data = await studioApi.listRemoteConfig(environment);
		remoteConfigs = (data ?? []) as Array<Record<string, any>>;
	}

	async function refreshAll() {
		loading = true;
		error = '';
		try {
			await Promise.all([loadEnvironments(), loadFlags(), loadRemoteConfig()]);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load flags/config';
			toastStore.error(error);
		} finally {
			loading = false;
		}
	}

	function openFlagModal(flag?: Record<string, any>) {
		if (!flag) {
			resetFlagForm();
			showFlagModal = true;
			return;
		}
		editingFlag = flag;
		flagForm = {
			key: String(flag.key ?? ''),
			value_type: String(flag.value_type ?? 'boolean'),
			default_value: String(flag.default_value ?? 'false'),
			description: String(flag.description ?? ''),
			is_active: Boolean(flag.is_active ?? true),
			targeting_rules: Array.isArray(flag.targeting_rules) ? structuredClone(flag.targeting_rules) : []
		};
		showFlagModal = true;
	}

	async function saveFlag() {
		if (!/^[a-z0-9_]+$/.test(flagForm.key)) {
			toastStore.error('Key must be lowercase and use underscores only');
			return;
		}
		if (!currentEnvironmentId()) {
			toastStore.error('No environment available. Refresh and retry.');
			return;
		}
		const payload = {
			key: flagForm.key.trim(),
			environment_id: currentEnvironmentId(),
			value_type: flagForm.value_type,
			default_value: flagForm.default_value,
			description: flagForm.description,
			is_active: flagForm.is_active,
			targeting_rules: normalizeRules(flagForm.targeting_rules)
		};
		try {
			if (editingFlag) {
				await studioApi.updateFlag(flagForm.key, environment, {
					default_value: payload.default_value,
					description: payload.description,
					is_active: payload.is_active,
					targeting_rules: payload.targeting_rules
				});
				toastStore.success('Flag updated');
			} else {
				await studioApi.createFlag(payload);
				toastStore.success('Flag created');
			}
			showFlagModal = false;
			resetFlagForm();
			await loadFlags();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to save flag');
		}
	}

	async function toggleFlag(flag: Record<string, any>) {
		try {
			await studioApi.updateFlag(String(flag.key), environment, {
				default_value: flag.default_value,
				description: flag.description,
				is_active: !Boolean(flag.is_active),
				targeting_rules: Array.isArray(flag.targeting_rules) ? flag.targeting_rules : []
			});
			await loadFlags();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to update flag status');
		}
	}

	async function deleteFlag(flag: Record<string, any>) {
		const ok = await confirmDialog.open({
			title: 'Delete Feature Flag',
			message: `Delete flag "${flag.key}" from ${environment}?`,
			confirmText: 'Delete flag',
			variant: 'danger'
		});
		if (!ok) return;
		try {
			await studioApi.deleteFlag(String(flag.key), environment);
			toastStore.success('Flag deleted');
			await loadFlags();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Delete failed');
		}
	}

	async function evaluatePreview() {
		let contextPayload: Record<string, any>;
		try {
			contextPayload = safeJsonParse<Record<string, any>>(evaluateInput, {});
		} catch {
			toastStore.error('Preview context must be valid JSON');
			return;
		}
		try {
			const result = await studioApi.evaluateFlags({
				environment,
				user_id: contextPayload.user_id,
				user_properties: contextPayload.user_properties || {}
			});
			evaluateOutput = prettyJson(result);
		} catch (err) {
			evaluateOutput = err instanceof Error ? err.message : 'Evaluation failed';
			toastStore.error('Flag evaluation failed');
		}
	}

	function openConfigModal(entry?: Record<string, any>) {
		if (!entry) {
			resetConfigForm();
			showConfigModal = true;
			return;
		}
		editingConfig = entry;
		configForm = {
			key: String(entry.key ?? ''),
			value: String(entry.value ?? ''),
			value_type: String(entry.value_type ?? 'string'),
			description: String(entry.description ?? ''),
			is_secret: Boolean(entry.is_secret)
		};
		showConfigModal = true;
	}

	async function saveConfig() {
		if (!configForm.key.trim()) {
			toastStore.error('Config key is required');
			return;
		}
		const payload = {
			key: configForm.key.trim(),
			value: configForm.value,
			value_type: configForm.value_type,
			description: configForm.description,
			is_secret: configForm.is_secret,
			environment_id: currentEnvironmentId()
		};
		try {
			if (editingConfig) {
				await studioApi.updateRemoteConfig(configForm.key, {
					value: payload.value,
					value_type: payload.value_type,
					description: payload.description,
					is_secret: payload.is_secret
				}, environment);
				toastStore.success('Remote config updated');
			} else {
				await studioApi.createRemoteConfig(payload);
				toastStore.success('Remote config created');
			}
			showConfigModal = false;
			resetConfigForm();
			await loadRemoteConfig();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to save config');
		}
	}

	async function deleteConfig(entry: Record<string, any>) {
		const ok = await confirmDialog.open({
			title: 'Delete Remote Config',
			message: `Delete config "${entry.key}" from ${environment}?`,
			confirmText: 'Delete config',
			variant: 'danger'
		});
		if (!ok) return;
		try {
			await studioApi.deleteRemoteConfig(String(entry.key), environment);
			toastStore.success('Config deleted');
			await loadRemoteConfig();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Delete failed');
		}
	}

	async function copyValue(value: string) {
		await navigator.clipboard.writeText(value || '');
		toastStore.success('Copied to clipboard');
	}

	async function exportEnv() {
		try {
			const text = await studioApi.exportRemoteConfig(environment);
			const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `indusbase-${environment}.env`;
			a.click();
			URL.revokeObjectURL(url);
			toastStore.success('Exported .env file');
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Export failed');
		}
	}

	$effect(() => {
		environment;
		contextStore.setEnvironment(environment);
		if (tab === 'flags') loadFlags();
		if (tab === 'remote') loadRemoteConfig();
	});

	onMount(async () => {
		await contextStore.ensureLoaded();
		environment = (contextStore.environment as EnvironmentName) || 'production';
		await refreshAll();
	});
</script>

<div class="space-y-6" data-testid="flags-page">
	<PageHeader title="Feature Flags & Remote Config" description="Control progressive rollouts and environment-level runtime config." >
		{#snippet actions()}
			<div class="flex items-center gap-2">
				<select class="rounded-md border border-gray-300 px-3 py-2 text-sm" bind:value={environment}>
					<option value="development">development</option>
					<option value="staging">staging</option>
					<option value="production">production</option>
				</select>
				<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={refreshAll} disabled={loading}>
					{loading ? 'Refreshing...' : 'Refresh'}
				</button>
			</div>
		{/snippet}
	</PageHeader>

	{#if error}
		<ErrorState message={error} onRetry={refreshAll} />
	{/if}

	<Tabs tabs={tabs} active={tab} onChange={(key) => (tab = key as 'flags' | 'remote')} />

	{#if tab === 'flags'}
		<SectionCard title="Feature Flags" description="Create, edit, and evaluate rollout rules for the selected environment.">
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<p class="text-sm text-gray-500">{flags.length} flags in {environment}</p>
					<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={() => openFlagModal()} data-testid="flags-new-flag">
						New Flag
					</button>
				</div>
				<div class="overflow-x-auto">
					<table class="min-w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 text-left text-gray-500">
								<th class="px-2 py-2">Key</th>
								<th class="px-2 py-2">Type</th>
								<th class="px-2 py-2">Default</th>
								<th class="px-2 py-2">Rules</th>
								<th class="px-2 py-2">Active</th>
								<th class="px-2 py-2">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#if flags.length === 0}
								<tr><td class="px-2 py-4 text-gray-500" colspan="6"><EmptyState title="No flags found" message="Create a flag to start progressive rollout control for this environment." /></td></tr>
							{:else}
								{#each flags as flag}
									<tr class="border-b border-gray-100" data-testid={`flag-row-${flag.key}`}>
										<td class="px-2 py-2 font-medium">{flag.key}</td>
										<td class="px-2 py-2">{flag.value_type}</td>
										<td class="px-2 py-2">{String(flag.default_value)}</td>
										<td class="px-2 py-2">{Array.isArray(flag.targeting_rules) ? flag.targeting_rules.length : 0}</td>
										<td class="px-2 py-2"><StatusBadge status={flag.is_active ? 'active' : 'inactive'} /></td>
										<td class="px-2 py-2">
											<div class="flex gap-2">
												<button class="rounded border px-2 py-1 text-xs" onclick={() => openFlagModal(flag)}>Edit</button>
												<button class="rounded border px-2 py-1 text-xs" onclick={() => toggleFlag(flag)}>{flag.is_active ? 'Disable' : 'Enable'}</button>
												<button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onclick={() => deleteFlag(flag)}>Delete</button>
											</div>
										</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
				<div class="rounded-md border border-gray-200 bg-gray-50 p-3">
					<div class="mb-2 flex items-center justify-between">
						<h3 class="text-sm font-semibold">Evaluation Preview</h3>
						<button class="rounded border px-2 py-1 text-xs" onclick={evaluatePreview} data-testid="flags-evaluate-preview">Evaluate</button>
					</div>
					<textarea class="w-full" rows="6" bind:value={evaluateInput}></textarea>
					<div class="mt-2">
						<JsonViewer value={safeJsonParse(evaluateOutput, evaluateOutput || 'Run evaluation to preview resolved flag values.')} maxHeight="14rem" />
					</div>
				</div>
			</div>
		</SectionCard>
	{/if}

	{#if tab === 'remote'}
		<SectionCard title="Remote Config" description="Manage runtime config and secret-backed values per environment.">
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<p class="text-sm text-gray-500">{remoteConfigs.length} keys in {environment}</p>
					<div class="flex gap-2">
						<button class="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={exportEnv}>Export .env</button>
						<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={() => openConfigModal()}>
							Add Config
						</button>
					</div>
				</div>
				<div class="overflow-x-auto">
					<table class="min-w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 text-left text-gray-500">
								<th class="px-2 py-2">Key</th>
								<th class="px-2 py-2">Value</th>
								<th class="px-2 py-2">Type</th>
								<th class="px-2 py-2">Secret</th>
								<th class="px-2 py-2">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#if remoteConfigs.length === 0}
								<tr><td class="px-2 py-4 text-gray-500" colspan="5"><EmptyState title="No remote config entries" message="Create environment config values to control runtime behavior without redeploying." /></td></tr>
							{:else}
								{#each remoteConfigs as entry}
									<tr class="border-b border-gray-100">
										<td class="px-2 py-2 font-medium">{entry.key}</td>
										<td class="px-2 py-2 font-mono text-xs">{entry.value}</td>
										<td class="px-2 py-2">{entry.value_type}</td>
										<td class="px-2 py-2"><StatusBadge status={entry.is_secret ? 'secret' : 'public'} /></td>
										<td class="px-2 py-2">
											<div class="flex gap-2">
												<button class="rounded border px-2 py-1 text-xs" onclick={() => copyValue(String(entry.value || ''))}>Copy</button>
												<button class="rounded border px-2 py-1 text-xs" onclick={() => openConfigModal(entry)}>Edit</button>
												<button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onclick={() => deleteConfig(entry)}>Delete</button>
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
	{/if}
</div>

{#if showFlagModal}
	<div class="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4">
		<div class="w-full max-w-3xl rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
			<h3 class="text-lg font-semibold">{editingFlag ? 'Edit Flag' : 'New Flag'}</h3>
			<div class="mt-3 grid gap-3 md:grid-cols-2">
				<label class="field">
					<span>Key</span>
					<input bind:value={flagForm.key} placeholder="new_dashboard" disabled={!!editingFlag} />
				</label>
				<label class="field">
					<span>Value Type</span>
					<select bind:value={flagForm.value_type} disabled={!!editingFlag}>
						<option value="boolean">boolean</option>
						<option value="string">string</option>
						<option value="number">number</option>
						<option value="json">json</option>
					</select>
				</label>
				<label class="field">
					<span>Default Value</span>
					<input bind:value={flagForm.default_value} />
				</label>
				<label class="field inline-field">
					<span>Active</span>
					<input type="checkbox" bind:checked={flagForm.is_active} />
				</label>
				<label class="field md:col-span-2">
					<span>Description</span>
					<input bind:value={flagForm.description} placeholder="Controls rollout of the new dashboard" />
				</label>
			</div>

			<div class="mt-4 rounded-md border border-gray-200 p-3">
				<div class="mb-2 flex items-center justify-between">
					<p class="text-sm font-semibold">Targeting Rules</p>
					<div class="flex gap-2">
						<button class="rounded border px-2 py-1 text-xs" onclick={() => addRule('percentage')}>Add Percentage</button>
						<button class="rounded border px-2 py-1 text-xs" onclick={() => addRule('user_ids')}>Add User IDs</button>
						<button class="rounded border px-2 py-1 text-xs" onclick={() => addRule('user_property')}>Add Property</button>
					</div>
				</div>
				<div class="space-y-2">
					{#if flagForm.targeting_rules.length === 0}
						<p class="text-xs text-gray-500">No rules defined. Default value will be used.</p>
					{:else}
						{#each flagForm.targeting_rules as rule, idx}
							<div class="rounded border border-gray-200 p-2">
								<div class="mb-2 flex items-center justify-between">
									<StatusBadge status={rule.type} />
									<button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onclick={() => removeRule(idx)}>Remove</button>
								</div>
								{#if rule.type === 'percentage'}
									<div class="grid gap-2 md:grid-cols-2">
										<input type="number" min="0" max="100" bind:value={rule.percentage} placeholder="percentage" />
										<input bind:value={rule.return_value} placeholder="return value" />
									</div>
								{:else if rule.type === 'user_ids'}
									<div class="grid gap-2">
										<textarea rows="3" bind:value={rule.user_ids_text} placeholder="uuid-1, uuid-2"></textarea>
										<input bind:value={rule.return_value} placeholder="return value" />
									</div>
								{:else}
									<div class="grid gap-2 md:grid-cols-4">
										<input bind:value={rule.property.name} placeholder="property" />
										<select bind:value={rule.property.operator}>
											<option value="eq">eq</option>
											<option value="neq">neq</option>
											<option value="contains">contains</option>
										</select>
										<input bind:value={rule.property.value} placeholder="value" />
										<input bind:value={rule.return_value} placeholder="return value" />
									</div>
								{/if}
							</div>
						{/each}
					{/if}
				</div>
			</div>

			<div class="mt-4 flex justify-end gap-2">
				<button class="rounded-md border border-gray-300 px-3 py-2 text-sm" onclick={() => { showFlagModal = false; resetFlagForm(); }}>Cancel</button>
				<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={saveFlag} data-testid="flags-save-flag">
					{editingFlag ? 'Save Changes' : 'Create Flag'}
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showConfigModal}
	<div class="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4">
		<div class="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
			<h3 class="text-lg font-semibold">{editingConfig ? 'Edit Remote Config' : 'New Remote Config'}</h3>
			<div class="mt-3 grid gap-3 md:grid-cols-2">
				<label class="field">
					<span>Key</span>
					<input bind:value={configForm.key} placeholder="app_upi_enabled" disabled={!!editingConfig} />
				</label>
				<label class="field">
					<span>Type</span>
					<select bind:value={configForm.value_type}>
						<option value="string">string</option>
						<option value="number">number</option>
						<option value="boolean">boolean</option>
						<option value="json">json</option>
					</select>
				</label>
				<label class="field md:col-span-2">
					<span>Value</span>
					<textarea rows="4" bind:value={configForm.value}></textarea>
				</label>
				<label class="field md:col-span-2">
					<span>Description</span>
					<input bind:value={configForm.description} placeholder="Feature rollout config" />
				</label>
				<label class="field inline-field md:col-span-2">
					<span>Secret value</span>
					<input type="checkbox" bind:checked={configForm.is_secret} />
				</label>
			</div>
			<div class="mt-4 flex justify-end gap-2">
				<button class="rounded-md border border-gray-300 px-3 py-2 text-sm" onclick={() => { showConfigModal = false; resetConfigForm(); }}>Cancel</button>
				<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={saveConfig}>
					{editingConfig ? 'Save Changes' : 'Create Config'}
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
	.inline-field {
		flex-direction: row;
		align-items: center;
		gap: 0.6rem;
	}
	.inline-field input { width: auto; }
</style>

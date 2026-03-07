<script lang="ts">
	import { onMount } from 'svelte';
	import { studioApi } from '$lib/api/studio';
	import { confirmDialog } from '$lib/stores/confirm';
	import { toastStore } from '$stores/toast';
	import { formatDateTime } from '$lib/utils/format';
	import PageHeader from '$lib/components/studio/PageHeader.svelte';
	import SectionCard from '$lib/components/studio/SectionCard.svelte';
	import EmptyState from '$lib/components/studio/EmptyState.svelte';
	import ErrorState from '$lib/components/studio/ErrorState.svelte';
	import JsonViewer from '$lib/components/studio/JsonViewer.svelte';
	import StatusBadge from '$lib/components/studio/StatusBadge.svelte';
	import Tabs from '$lib/components/studio/Tabs.svelte';

	type QueueTab = 'jobs' | 'webhooks' | 'cron';

	type QueueJob = {
		id: string;
		queue_name: string;
		status: string;
		payload: Record<string, unknown>;
		priority: number;
		attempt_count: number;
		max_retries: number;
		retry_count: number;
		error_message?: string;
		created_at: string;
		updated_at: string;
	};

	type QueueWebhook = {
		id: string;
		name: string;
		url: string;
		event: string;
		enabled: boolean;
		headers?: Record<string, string>;
		created_at: string;
	};

	type CronSchedule = {
		id: string;
		name: string;
		cron_expression: string;
		timezone: string;
		job_payload?: Record<string, unknown>;
		enabled: boolean;
		last_run_at?: string;
		next_run_at?: string;
		created_at: string;
	};

	let tab = $state<QueueTab>('jobs');
	let loading = $state(false);
	let error = $state('');
	let queues = $state<Array<{ id: string; name: string }>>([]);
	let selectedQueue = $state('default');
	let statusFilter = $state('');
	let jobs = $state<QueueJob[]>([]);
	let webhooks = $state<QueueWebhook[]>([]);
	let schedules = $state<CronSchedule[]>([]);
	let selectedJob = $state<QueueJob | null>(null);
	let showEnqueue = $state(false);
	let showWebhookModal = $state(false);
	let showCronModal = $state(false);
	let editingWebhook = $state<QueueWebhook | null>(null);
	let editingCron = $state<CronSchedule | null>(null);

	let enqueueForm = $state({
		queue_name: 'default',
		payload: '{\n  "action": "process",\n  "data": {}\n}',
		priority: 0,
		max_retries: 3
	});

	let webhookForm = $state({
		name: '',
		url: '',
		event: 'INSERT',
		enabled: true,
		headers: '{}'
	});

	let cronForm = $state({
		name: '',
		cron_expression: '0 * * * *',
		timezone: 'Asia/Kolkata',
		enabled: true,
		job_payload: '{\n  "queue_name": "default",\n  "priority": 0,\n  "payload": {}\n}'
	});

	const statusCounts = $derived.by(() => {
		const counters = new Map<string, number>();
		for (const job of jobs) {
			counters.set(job.status, (counters.get(job.status) ?? 0) + 1);
		}
		return Array.from(counters.entries()).map(([status, count]) => ({ status, count }));
	});

	const queueTabs = [
		{ key: 'jobs', label: 'Jobs' },
		{ key: 'webhooks', label: 'Webhooks' },
		{ key: 'cron', label: 'Cron' }
	];

	function statusTone(status: string): 'ok' | 'warn' | 'bad' | 'default' {
		const normalized = status.toLowerCase();
		if (normalized === 'completed') return 'ok';
		if (normalized === 'running' || normalized === 'pending') return 'warn';
		if (normalized.includes('fail') || normalized.includes('dead')) return 'bad';
		return 'default';
	}

	async function loadQueues() {
		try {
			const payload = await studioApi.listQueues();
			queues = (payload ?? []).map((queue) => ({
				id: String(queue.id ?? queue.name),
				name: String(queue.name ?? 'default')
			}));
			if (!queues.some((queue) => queue.name === selectedQueue)) {
				selectedQueue = queues[0]?.name ?? 'default';
			}
			enqueueForm.queue_name = selectedQueue;
		} catch {
			queues = [{ id: 'default', name: 'default' }];
		}
	}

	async function loadJobs() {
		const payload = await studioApi.listJobs({
			queue_name: selectedQueue || undefined,
			status: statusFilter || undefined,
			limit: 200,
			offset: 0
		});
		jobs = (payload ?? []) as QueueJob[];
	}

	async function loadWebhooks() {
		const payload = await studioApi.listWebhooks();
		webhooks = (payload ?? []) as QueueWebhook[];
	}

	async function loadCronSchedules() {
		const payload = await studioApi.listCron();
		schedules = (payload ?? []) as CronSchedule[];
	}

	async function refreshActive() {
		loading = true;
		error = '';
		try {
			if (tab === 'jobs') await loadJobs();
			if (tab === 'webhooks') await loadWebhooks();
			if (tab === 'cron') await loadCronSchedules();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load queue data';
			toastStore.error(error);
		} finally {
			loading = false;
		}
	}

	async function refreshAll() {
		loading = true;
		error = '';
		try {
			await Promise.all([loadQueues(), loadJobs(), loadWebhooks(), loadCronSchedules()]);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load queue data';
			toastStore.error(error);
		} finally {
			loading = false;
		}
	}

	async function enqueueJob() {
		let payload: Record<string, unknown>;
		try {
			payload = JSON.parse(enqueueForm.payload);
		} catch {
			toastStore.error('Payload must be valid JSON');
			return;
		}
		try {
			await studioApi.enqueueJob({
				queue_name: enqueueForm.queue_name,
				payload,
				priority: Number(enqueueForm.priority),
				max_retries: Number(enqueueForm.max_retries)
			});
			toastStore.success('Job enqueued');
			showEnqueue = false;
			await loadJobs();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to enqueue job');
		}
	}

	function openWebhookModal(webhook?: QueueWebhook) {
		editingWebhook = webhook ?? null;
		webhookForm = {
			name: webhook?.name ?? '',
			url: webhook?.url ?? '',
			event: webhook?.event ?? 'INSERT',
			enabled: webhook?.enabled ?? true,
			headers: JSON.stringify(webhook?.headers ?? {}, null, 2)
		};
		showWebhookModal = true;
	}

	async function saveWebhook() {
		let headers: Record<string, string> = {};
		try {
			headers = JSON.parse(webhookForm.headers || '{}');
		} catch {
			toastStore.error('Webhook headers must be valid JSON');
			return;
		}
		const payload = {
			name: webhookForm.name.trim(),
			url: webhookForm.url.trim(),
			event: webhookForm.event.trim(),
			enabled: webhookForm.enabled,
			headers
		};
		try {
			if (editingWebhook) {
				await studioApi.updateWebhook(editingWebhook.id, payload);
				toastStore.success('Webhook updated');
			} else {
				await studioApi.createWebhook(payload);
				toastStore.success('Webhook created');
			}
			showWebhookModal = false;
			await loadWebhooks();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to save webhook');
		}
	}

	async function toggleWebhook(webhook: QueueWebhook) {
		try {
			await studioApi.updateWebhook(webhook.id, { enabled: !webhook.enabled });
			toastStore.success(`Webhook ${!webhook.enabled ? 'enabled' : 'disabled'}`);
			await loadWebhooks();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to update webhook');
		}
	}

	async function testWebhook(webhook: QueueWebhook) {
		try {
			await studioApi.testWebhook(webhook.id);
			toastStore.success(`Webhook "${webhook.name}" test sent`);
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Webhook test failed');
		}
	}

	async function deleteWebhook(webhook: QueueWebhook) {
		const ok = await confirmDialog.open({
			title: 'Delete Webhook',
			message: `Delete webhook "${webhook.name}"?`,
			confirmText: 'Delete webhook',
			variant: 'danger'
		});
		if (!ok) return;
		try {
			await studioApi.deleteWebhook(webhook.id);
			toastStore.success('Webhook deleted');
			await loadWebhooks();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to delete webhook');
		}
	}

	function openCronModal(schedule?: CronSchedule) {
		editingCron = schedule ?? null;
		cronForm = {
			name: schedule?.name ?? '',
			cron_expression: schedule?.cron_expression ?? '0 * * * *',
			timezone: schedule?.timezone ?? 'Asia/Kolkata',
			enabled: schedule?.enabled ?? true,
			job_payload: JSON.stringify(
				schedule?.job_payload ?? { queue_name: selectedQueue || 'default', priority: 0, payload: {} },
				null,
				2
			)
		};
		showCronModal = true;
	}

	async function saveCronSchedule() {
		let jobPayload: Record<string, unknown> = {};
		try {
			jobPayload = JSON.parse(cronForm.job_payload);
		} catch {
			toastStore.error('Cron job payload must be valid JSON');
			return;
		}
		const payload = {
			name: cronForm.name.trim(),
			cron_expression: cronForm.cron_expression.trim(),
			timezone: cronForm.timezone.trim(),
			enabled: cronForm.enabled,
			job_payload: jobPayload
		};
		try {
			if (editingCron) {
				await studioApi.updateCron(editingCron.id, payload);
				toastStore.success('Cron schedule updated');
			} else {
				await studioApi.createCron(payload);
				toastStore.success('Cron schedule created');
			}
			showCronModal = false;
			await loadCronSchedules();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to save cron schedule');
		}
	}

	async function toggleCron(schedule: CronSchedule) {
		try {
			await studioApi.updateCron(schedule.id, { enabled: !schedule.enabled });
			toastStore.success(`Schedule ${!schedule.enabled ? 'enabled' : 'disabled'}`);
			await loadCronSchedules();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to update schedule');
		}
	}

	async function runCronNow(schedule: CronSchedule) {
		try {
			await studioApi.runCronNow(schedule.id);
			toastStore.success(`Triggered "${schedule.name}"`);
			await loadJobs();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to run schedule');
		}
	}

	async function deleteCron(schedule: CronSchedule) {
		const ok = await confirmDialog.open({
			title: 'Delete Cron Schedule',
			message: `Delete cron "${schedule.name}"?`,
			confirmText: 'Delete schedule',
			variant: 'danger'
		});
		if (!ok) return;
		try {
			await studioApi.deleteCron(schedule.id);
			toastStore.success('Cron schedule deleted');
			await loadCronSchedules();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to delete schedule');
		}
	}

	$effect(() => {
		tab;
		refreshActive();
	});

	onMount(async () => {
		await refreshAll();
	});
</script>

<div class="space-y-6" data-testid="queue-page">
	<PageHeader
		title="Queue & Automation"
		description="Operate background jobs, webhook deliveries, and cron schedules from a single live queue console."
		eyebrow="Operations"
		testId="queue-header"
	>
		{#snippet actions()}
			<div class="header-actions">
				<select
					bind:value={selectedQueue}
					onchange={() => {
						enqueueForm.queue_name = selectedQueue;
						loadJobs();
					}}
					data-testid="queue-selector"
				>
					{#each queues as queue}
						<option value={queue.name}>{queue.name}</option>
					{/each}
				</select>
				<button class="secondary" onclick={refreshAll} disabled={loading} data-testid="queue-refresh">
					{loading ? 'Refreshing...' : 'Refresh'}
				</button>
				{#if tab === 'jobs'}
					<button class="primary" onclick={() => (showEnqueue = true)} data-testid="queue-enqueue-open">Enqueue Job</button>
				{/if}
			</div>
		{/snippet}
	</PageHeader>

	{#if error}
		<ErrorState message={error} onRetry={refreshAll} />
	{/if}

	<Tabs tabs={queueTabs} active={tab} onChange={(key) => (tab = key as QueueTab)} />

	{#if tab === 'jobs'}
		<SectionCard title="Jobs" description="Inspect queued work, retry pressure, and payload details for the selected queue.">
			<div class="space-y-4">
			<div class="status-grid">
				{#if statusCounts.length === 0}
					<EmptyState title="No job status data" message="Jobs will appear here once the selected queue begins receiving work." />
				{:else}
					{#each statusCounts as item}
						<div class="status-card">
							<span>{item.status}</span>
							<strong>{item.count}</strong>
						</div>
					{/each}
				{/if}
			</div>
			<div class="row two">
				<div>
					<label for="job-status-filter">Status filter</label>
					<select id="job-status-filter" bind:value={statusFilter} onchange={loadJobs}>
						<option value="">All statuses</option>
						<option value="pending">pending</option>
						<option value="running">running</option>
						<option value="completed">completed</option>
						<option value="failed">failed</option>
						<option value="dead_letter">dead_letter</option>
					</select>
				</div>
			</div>
			<div class="layout">
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th>ID</th>
								<th>Queue</th>
								<th>Status</th>
								<th>Attempts</th>
								<th>Created</th>
							</tr>
						</thead>
						<tbody>
							{#if loading}
								<tr><td colspan="5" class="empty">Loading jobs...</td></tr>
							{:else if jobs.length === 0}
								<tr><td colspan="5" class="empty">No jobs found.</td></tr>
							{:else}
								{#each jobs as job}
									<tr class:selected={selectedJob?.id === job.id} onclick={() => (selectedJob = job)} data-testid={`queue-job-${job.id}`}>
										<td class="mono">{job.id}</td>
										<td>{job.queue_name}</td>
										<td><StatusBadge status={job.status} /></td>
										<td>{job.attempt_count}/{job.max_retries}</td>
										<td>{formatDateTime(job.created_at)}</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
				<aside class="drawer">
					<h3>Job Details</h3>
					{#if !selectedJob}
						<p class="empty">Select a job row to inspect payload and retries.</p>
					{:else}
						<div class="kv"><strong>ID</strong><span class="mono">{selectedJob.id}</span></div>
						<div class="kv"><strong>Status</strong><span>{selectedJob.status}</span></div>
						<div class="kv"><strong>Attempts</strong><span>{selectedJob.attempt_count} / {selectedJob.max_retries}</span></div>
						<div class="kv"><strong>Updated</strong><span>{formatDateTime(selectedJob.updated_at)}</span></div>
						<div class="kv"><strong>Error</strong><span>{selectedJob.error_message || '-'}</span></div>
						<h4>Payload</h4>
						<JsonViewer value={selectedJob.payload || {}} maxHeight="18rem" />
					{/if}
				</aside>
			</div>
			</div>
		</SectionCard>
	{/if}

	{#if tab === 'webhooks'}
		<SectionCard title="Webhook Endpoints" description="Operate outgoing delivery hooks, test them, and inspect their live configuration.">
			<div class="space-y-4">
			<div class="section-head">
				<h2>Webhook Endpoints</h2>
				<button class="primary" onclick={() => openWebhookModal()} data-testid="queue-new-webhook">New Webhook</button>
			</div>
			{#if loading}
				<div class="empty">Loading webhooks...</div>
			{:else if webhooks.length === 0}
				<div class="empty">No webhooks configured.</div>
			{:else}
				<div class="cards">
					{#each webhooks as webhook}
						<div class="card">
							<div class="row">
								<strong>{webhook.name}</strong>
								<StatusBadge status={webhook.enabled ? 'enabled' : 'disabled'} />
							</div>
							<small>{webhook.event}</small>
							<p class="mono">{webhook.url}</p>
							<div class="header-actions">
								<button class="secondary" onclick={() => toggleWebhook(webhook)}>{webhook.enabled ? 'Disable' : 'Enable'}</button>
								<button class="secondary" onclick={() => testWebhook(webhook)}>Test</button>
								<button class="secondary" onclick={() => openWebhookModal(webhook)}>Edit</button>
								<button class="danger" onclick={() => deleteWebhook(webhook)}>Delete</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
			</div>
		</SectionCard>
	{/if}

	{#if tab === 'cron'}
		<SectionCard title="Cron Schedules" description="Manage time-based automation, trigger runs immediately, and watch next-run timing.">
			<div class="space-y-4">
			<div class="section-head">
				<h2>Cron Schedules</h2>
				<button class="primary" onclick={() => openCronModal()} data-testid="queue-new-cron">New Schedule</button>
			</div>
			{#if loading}
				<div class="empty">Loading cron schedules...</div>
			{:else if schedules.length === 0}
				<div class="empty">No cron schedules configured.</div>
			{:else}
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th>Name</th>
								<th>Expression</th>
								<th>Timezone</th>
								<th>Next Run</th>
								<th>Status</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each schedules as schedule}
								<tr>
									<td>{schedule.name}</td>
									<td class="mono">{schedule.cron_expression}</td>
									<td>{schedule.timezone}</td>
									<td>{formatDateTime(schedule.next_run_at)}</td>
									<td><StatusBadge status={schedule.enabled ? 'enabled' : 'disabled'} /></td>
									<td>
										<div class="header-actions">
											<button class="secondary" onclick={() => runCronNow(schedule)}>Run Now</button>
											<button class="secondary" onclick={() => toggleCron(schedule)}>{schedule.enabled ? 'Disable' : 'Enable'}</button>
											<button class="secondary" onclick={() => openCronModal(schedule)}>Edit</button>
											<button class="danger" onclick={() => deleteCron(schedule)}>Delete</button>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
			</div>
		</SectionCard>
	{/if}
</div>

{#if showEnqueue}
	<div
		class="modal-backdrop"
		role="button"
		tabindex="0"
		onclick={(event) => event.currentTarget === event.target && (showEnqueue = false)}
		onkeydown={(event) => (event.key === 'Escape' || event.key === 'Enter') && (showEnqueue = false)}
	>
		<div class="modal" role="dialog" aria-modal="true">
			<h3>Enqueue Job</h3>
			<label for="enqueue-queue">Queue</label>
			<select id="enqueue-queue" bind:value={enqueueForm.queue_name}>
				{#each queues as queue}
					<option value={queue.name}>{queue.name}</option>
				{/each}
			</select>
			<label for="enqueue-priority">Priority</label>
			<input id="enqueue-priority" type="number" bind:value={enqueueForm.priority} data-testid="queue-enqueue-priority" />
			<label for="enqueue-retries">Max Retries</label>
			<input id="enqueue-retries" type="number" min="0" bind:value={enqueueForm.max_retries} />
			<label for="enqueue-payload">Payload JSON</label>
			<textarea id="enqueue-payload" bind:value={enqueueForm.payload} rows="10" data-testid="queue-enqueue-payload"></textarea>
			<div class="header-actions">
				<button class="secondary" onclick={() => (showEnqueue = false)}>Cancel</button>
				<button class="primary" onclick={enqueueJob} data-testid="queue-enqueue-submit">Enqueue</button>
			</div>
		</div>
	</div>
{/if}

{#if showWebhookModal}
	<div
		class="modal-backdrop"
		role="button"
		tabindex="0"
		onclick={(event) => event.currentTarget === event.target && (showWebhookModal = false)}
		onkeydown={(event) => (event.key === 'Escape' || event.key === 'Enter') && (showWebhookModal = false)}
	>
		<div class="modal" role="dialog" aria-modal="true">
			<h3>{editingWebhook ? 'Edit Webhook' : 'Create Webhook'}</h3>
			<label for="webhook-name">Name</label>
			<input id="webhook-name" bind:value={webhookForm.name} data-testid="queue-webhook-name" />
			<label for="webhook-url">URL</label>
			<input id="webhook-url" bind:value={webhookForm.url} placeholder="https://example.com/webhook" data-testid="queue-webhook-url" />
			<div class="row two">
				<div>
					<label for="webhook-event">Event</label>
					<input id="webhook-event" bind:value={webhookForm.event} placeholder="INSERT" />
				</div>
				<div>
					<label for="webhook-enabled">Enabled</label>
					<select id="webhook-enabled" bind:value={webhookForm.enabled}>
						<option value={true}>true</option>
						<option value={false}>false</option>
					</select>
				</div>
			</div>
			<label for="webhook-headers">Headers JSON</label>
			<textarea id="webhook-headers" bind:value={webhookForm.headers} rows="5" data-testid="queue-webhook-headers"></textarea>
			<div class="header-actions">
				<button class="secondary" onclick={() => (showWebhookModal = false)}>Cancel</button>
				<button class="primary" onclick={saveWebhook} data-testid="queue-webhook-submit">Save</button>
			</div>
		</div>
	</div>
{/if}

{#if showCronModal}
	<div
		class="modal-backdrop"
		role="button"
		tabindex="0"
		onclick={(event) => event.currentTarget === event.target && (showCronModal = false)}
		onkeydown={(event) => (event.key === 'Escape' || event.key === 'Enter') && (showCronModal = false)}
	>
		<div class="modal" role="dialog" aria-modal="true">
			<h3>{editingCron ? 'Edit Cron Schedule' : 'Create Cron Schedule'}</h3>
			<label for="cron-name">Name</label>
			<input id="cron-name" bind:value={cronForm.name} data-testid="queue-cron-name" />
			<label for="cron-expression">Cron Expression</label>
			<input id="cron-expression" bind:value={cronForm.cron_expression} placeholder="0 * * * *" />
			<div class="row two">
				<div>
					<label for="cron-timezone">Timezone</label>
					<input id="cron-timezone" bind:value={cronForm.timezone} />
				</div>
				<div>
					<label for="cron-enabled">Enabled</label>
					<select id="cron-enabled" bind:value={cronForm.enabled}>
						<option value={true}>true</option>
						<option value={false}>false</option>
					</select>
				</div>
			</div>
			<label for="cron-payload">Job Payload JSON</label>
			<textarea id="cron-payload" bind:value={cronForm.job_payload} rows="8" data-testid="queue-cron-payload"></textarea>
			<div class="header-actions">
				<button class="secondary" onclick={() => (showCronModal = false)}>Cancel</button>
				<button class="primary" onclick={saveCronSchedule} data-testid="queue-cron-submit">Save</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.header-actions { display: flex; gap: 0.55rem; flex-wrap: wrap; align-items: center; }
	.primary, .secondary, .danger {
		border-radius: 0.65rem;
		padding: 0.52rem 0.88rem;
		border: 1px solid var(--surface-6);
		background: var(--surface-2);
		color: var(--surface-12);
		cursor: pointer;
	}
	.primary { background: #f97316; border-color: #f97316; color: #fff; }
	.danger { border-color: #7f1d1d; color: #fecaca; background: rgba(127, 29, 29, 0.18); }
	.status-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		gap: 0.55rem;
	}
	.status-card {
		border: 1px solid var(--surface-6);
		background: var(--surface-1);
		border-radius: 0.72rem;
		padding: 0.65rem;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.status-card span { color: var(--surface-10); text-transform: capitalize; font-size: 0.8rem; }
	.row.two { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
	label { font-size: 0.82rem; color: var(--surface-10); }
	input, select, textarea {
		border: 1px solid var(--surface-6);
		border-radius: 0.6rem;
		padding: 0.55rem 0.65rem;
		background: var(--surface-2);
		color: var(--surface-12);
	}
	.layout { display: grid; grid-template-columns: 1.35fr 1fr; gap: 0.75rem; }
	.drawer {
		border: 1px solid var(--surface-6);
		background: var(--surface-1);
		border-radius: 0.75rem;
		padding: 0.75rem;
	}
	.drawer h3 { margin-top: 0; }
	.kv {
		display: grid;
		grid-template-columns: 110px 1fr;
		gap: 0.45rem;
		margin-bottom: 0.4rem;
	}
	.table-wrap { overflow: auto; border: 1px solid var(--surface-6); border-radius: 0.8rem; }
	table { width: 100%; border-collapse: collapse; }
	th, td { border-bottom: 1px solid var(--surface-6); padding: 0.55rem; text-align: left; vertical-align: top; }
	tr { cursor: pointer; }
	tr.selected { background: rgba(251, 146, 60, 0.2); }
	.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
	.cards { display: grid; gap: 0.65rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.card {
		border: 1px solid var(--surface-6);
		background: var(--surface-1);
		border-radius: 0.75rem;
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	.card p { margin: 0.2rem 0; }
	.section-head { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
	.section-head h2 { margin: 0; font-size: 1rem; }
	.empty { color: var(--surface-10); padding: 1rem 0.2rem; }
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
		width: min(760px, 100%);
		background: var(--surface-1);
		border: 1px solid var(--surface-6);
		border-radius: 0.95rem;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}
	.modal h3 { margin: 0 0 0.2rem; }
	@media (max-width: 1100px) {
		.layout { grid-template-columns: 1fr; }
		.cards { grid-template-columns: 1fr; }
		.status-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}
</style>

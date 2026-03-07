<script lang="ts">
	import { onMount } from 'svelte';
	import { studioApi } from '$lib/api/studio';
	import { contextStore } from '$lib/stores/context';
	import { confirmDialog } from '$lib/stores/confirm';
	import { toastStore } from '$stores/toast';
	import { formatDateTime, formatNumber } from '$lib/utils/format';
	import { safeJsonParse, prettyJson } from '$lib/utils/json';
	import PageHeader from '$lib/components/studio/PageHeader.svelte';
	import SectionCard from '$lib/components/studio/SectionCard.svelte';
	import StatusBadge from '$lib/components/studio/StatusBadge.svelte';
	import Tabs from '$lib/components/studio/Tabs.svelte';
	import MetricChart from '$lib/components/studio/MetricChart.svelte';
	import SlideOver from '$lib/components/studio/SlideOver.svelte';
	import EmptyState from '$lib/components/studio/EmptyState.svelte';
	import ErrorState from '$lib/components/studio/ErrorState.svelte';
	import StatCard from '$lib/components/studio/StatCard.svelte';
	import JsonViewer from '$lib/components/studio/JsonViewer.svelte';

	type NotifyTab = 'send' | 'templates' | 'history' | 'stats';
	type SendChannel = 'push' | 'sms' | 'email';
	type TemplateChannel = 'push' | 'sms' | 'email' | 'whatsapp';

	type TemplateRecord = {
		id?: string;
		name: string;
		channel: TemplateChannel;
		subject?: string;
		body: string;
		variables?: string[];
		is_active?: boolean;
		created_at?: string;
		updated_at?: string;
	};

	type NotifyHistoryRecord = {
		id: string;
		recipient: string;
		channel: string;
		status: string;
		sent_at?: string;
		error_message?: string;
	};

	let tab = $state<NotifyTab>('send');
	let sendChannel = $state<SendChannel>('push');
	let loading = $state(false);
	let error = $state('');

	let templates = $state<TemplateRecord[]>([]);
	let history = $state<NotifyHistoryRecord[]>([]);
	let stats = $state<Record<string, any>>({});
	let selectedHistory = $state<NotifyHistoryRecord | null>(null);
	let historyDetailOpen = $state(false);

	let showTemplateModal = $state(false);
	let editingTemplate = $state<TemplateRecord | null>(null);
	let previewResult = $state('');

	let pushForm = $state({
		user_id: '',
		tokens_text: '',
		title: '',
		body: '',
		data_text: '{\n  "screen": "home"\n}'
	});

	let smsForm = $state({
		to: '',
		body: '',
		template_id: '',
		dlt_template_id: '',
		variables_text: '{\n  "name": "Bhuvan",\n  "amount": "500",\n  "merchant": "Swiggy",\n  "method": "UPI",\n  "ref_id": "T123"\n}'
	});

	let emailForm = $state({
		to_text: '',
		subject: '',
		body: '',
		is_html: false,
		template_id: '',
		variables_text: '{\n  "name": "Bhuvan",\n  "otp": "123456"\n}'
	});

	let templateForm = $state({
		name: '',
		channel: 'sms' as TemplateChannel,
		subject: '',
		body: '',
		variables_text: 'name,amount,merchant,method,ref_id'
	});

	let historyFilters = $state({
		channel: '',
		status: '',
		user_id: '',
		date_from: '',
		date_to: ''
	});

	const smsBodyLength = $derived(smsForm.body.length);

	const filteredHistory = $derived.by(() => {
		return history.filter((item) => {
			if (!historyFilters.date_from && !historyFilters.date_to) return true;
			if (!item.sent_at) return false;
			const sent = new Date(item.sent_at).getTime();
			if (historyFilters.date_from) {
				const from = new Date(`${historyFilters.date_from}T00:00:00`).getTime();
				if (sent < from) return false;
			}
			if (historyFilters.date_to) {
				const to = new Date(`${historyFilters.date_to}T23:59:59`).getTime();
				if (sent > to) return false;
			}
			return true;
		});
	});

	const statsCards = $derived.by(() => {
		const push = stats.push ?? { sent: 0, failed: 0 };
		const sms = stats.sms ?? { sent: 0, failed: 0 };
		const email = stats.email ?? { sent: 0, failed: 0 };
		const last24 = stats.last_24h ?? { sent: 0, failed: 0 };
		const totalSent = Number(stats.total_sent ?? 0);
		const failures = Number(push.failed ?? 0) + Number(sms.failed ?? 0) + Number(email.failed ?? 0);
		const totalAttempts = totalSent + failures;
		const failureRate = totalAttempts > 0 ? (failures / totalAttempts) * 100 : 0;
		return {
			totalSent,
			pushSent: Number(push.sent ?? 0),
			smsSent: Number(sms.sent ?? 0),
			emailSent: Number(email.sent ?? 0),
			last24Sent: Number(last24.sent ?? 0),
			failureRate
		};
	});

	const statsChartPoints = $derived.by(() => [
		{ label: 'Push', value: Number(statsCards.pushSent || 0), tone: 'blue' as const },
		{ label: 'SMS', value: Number(statsCards.smsSent || 0), tone: 'green' as const },
		{ label: 'Email', value: Number(statsCards.emailSent || 0), tone: 'orange' as const },
		{ label: '24h', value: Number(statsCards.last24Sent || 0), tone: 'red' as const }
	]);

	const tabItems = [
		{ key: 'send', label: 'Send' },
		{ key: 'templates', label: 'Templates' },
		{ key: 'history', label: 'History' },
		{ key: 'stats', label: 'Stats' }
	];

	function resetTemplateForm() {
		templateForm = {
			name: '',
			channel: 'sms',
			subject: '',
			body: '',
			variables_text: ''
		};
		editingTemplate = null;
		previewResult = '';
	}

	function openTemplateModal(template?: TemplateRecord) {
		if (template) {
			editingTemplate = template;
			templateForm = {
				name: template.name,
				channel: template.channel,
				subject: template.subject ?? '',
				body: template.body,
				variables_text: (template.variables ?? []).join(',')
			};
		} else {
			resetTemplateForm();
		}
		showTemplateModal = true;
	}

	function parseVariablesList(value: string): string[] {
		return value
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);
	}

	async function loadTemplates() {
		const data = await studioApi.listNotifyTemplates();
		templates = (data ?? []) as TemplateRecord[];
	}

	async function loadHistory() {
		const data = await studioApi.listNotifyHistory({
			channel: historyFilters.channel || undefined,
			status: historyFilters.status || undefined,
			user_id: historyFilters.user_id || undefined,
			limit: 200,
			offset: 0
		});
		history = (data ?? []) as NotifyHistoryRecord[];
	}

	async function loadStats() {
		stats = (await studioApi.getNotifyStats()) ?? {};
	}

	async function refreshAll() {
		loading = true;
		error = '';
		try {
			await Promise.all([loadTemplates(), loadHistory(), loadStats()]);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load notifications data';
			toastStore.error(error);
		} finally {
			loading = false;
		}
	}

	function requireProjectContext() {
		if (!contextStore.activeProjectId) {
			toastStore.error('Select or create a project before sending notifications');
			return false;
		}
		return true;
	}

	async function sendPush() {
		if (!requireProjectContext()) return;
		if (!pushForm.title.trim() || !pushForm.body.trim()) {
			toastStore.error('Push title and body are required');
			return;
		}
		const tokens = pushForm.tokens_text
			.split(/[\n,\s]+/)
			.map((item) => item.trim())
			.filter(Boolean);
		if (!pushForm.user_id.trim() && tokens.length === 0) {
			toastStore.error('Provide user_id or at least one device token');
			return;
		}
		const data = safeJsonParse<Record<string, string>>(pushForm.data_text || '{}', {});
		await toastStore.promise(
			studioApi.sendPush({
				user_id: pushForm.user_id.trim() || undefined,
				tokens,
				title: pushForm.title,
				body: pushForm.body,
				data
			}),
			{
				loading: 'Sending push notification...',
				success: 'Push notification sent',
				error: 'Push notification failed'
			}
		);
		await Promise.all([loadHistory(), loadStats()]);
	}

	async function sendSMS() {
		if (!requireProjectContext()) return;
		if (!smsForm.to.trim() || !smsForm.dlt_template_id.trim()) {
			toastStore.error('Phone number and DLT Template ID are required');
			return;
		}
		if (!/^91\d{10}$/.test(smsForm.to.trim())) {
			toastStore.error('Phone must be in format 91XXXXXXXXXX');
			return;
		}
		if (!smsForm.template_id && !smsForm.body.trim()) {
			toastStore.error('Provide SMS body or choose a template');
			return;
		}
		if (smsForm.body.length > 160) {
			toastStore.error('SMS body exceeds 160 character limit');
			return;
		}
		const variables = safeJsonParse<Record<string, string>>(smsForm.variables_text || '{}', {});
		await toastStore.promise(
			studioApi.sendSMS({
				to: smsForm.to.trim(),
				body: smsForm.body,
				template_id: smsForm.template_id || undefined,
				variables,
				dlt_template_id: smsForm.dlt_template_id.trim()
			}),
			{
				loading: 'Sending SMS...',
				success: 'SMS sent successfully',
				error: 'SMS send failed'
			}
		);
		await Promise.all([loadHistory(), loadStats()]);
	}

	async function sendEmail() {
		if (!requireProjectContext()) return;
		const recipients = emailForm.to_text
			.split(/[\n,\s]+/)
			.map((item) => item.trim())
			.filter(Boolean);
		if (recipients.length === 0) {
			toastStore.error('At least one recipient email is required');
			return;
		}
		if (!emailForm.template_id && (!emailForm.subject.trim() || !emailForm.body.trim())) {
			toastStore.error('Email subject and body are required');
			return;
		}
		const variables = safeJsonParse<Record<string, string>>(emailForm.variables_text || '{}', {});
		await toastStore.promise(
			studioApi.sendEmail({
				to: recipients,
				subject: emailForm.subject,
				body: emailForm.body,
				is_html: emailForm.is_html,
				template_id: emailForm.template_id || undefined,
				variables
			}),
			{
				loading: 'Sending email...',
				success: 'Email sent',
				error: 'Email send failed'
			}
		);
		await Promise.all([loadHistory(), loadStats()]);
	}

	async function handleSend() {
		try {
			if (sendChannel === 'push') await sendPush();
			if (sendChannel === 'sms') await sendSMS();
			if (sendChannel === 'email') await sendEmail();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Notification send failed');
		}
	}

	async function saveTemplate() {
		if (!templateForm.name.trim() || !templateForm.body.trim()) {
			toastStore.error('Template name and body are required');
			return;
		}
		const payload: Record<string, unknown> = {
			name: templateForm.name.trim(),
			channel: templateForm.channel,
			subject: templateForm.subject.trim() || null,
			body: templateForm.body,
			variables: parseVariablesList(templateForm.variables_text)
		};
		try {
			if (editingTemplate) {
				await studioApi.updateNotifyTemplate(editingTemplate.name, payload);
				toastStore.success('Template updated');
			} else {
				await studioApi.createNotifyTemplate(payload);
				toastStore.success('Template created');
			}
			showTemplateModal = false;
			resetTemplateForm();
			await loadTemplates();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to save template');
		}
	}

	async function deleteTemplate(template: TemplateRecord) {
		const ok = await confirmDialog.open({
			title: 'Delete Template',
			message: `Delete template "${template.name}"?`,
			confirmText: 'Delete template',
			variant: 'danger'
		});
		if (!ok) return;
		try {
			await studioApi.deleteNotifyTemplate(template.name);
			toastStore.success('Template deleted');
			await loadTemplates();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Delete failed');
		}
	}

	async function previewTemplate(template: TemplateRecord) {
		const variables = safeJsonParse<Record<string, string>>(smsForm.variables_text || emailForm.variables_text || '{}', {});
		try {
			const preview = await studioApi.previewNotifyTemplate(template.name, { variables });
			previewResult = prettyJson(preview);
			toastStore.success(`Preview generated for ${template.name}`);
		} catch (err) {
			previewResult = err instanceof Error ? err.message : 'Preview failed';
			toastStore.error(previewResult);
		}
	}

	function openHistoryDetail(entry: NotifyHistoryRecord) {
		selectedHistory = entry;
		historyDetailOpen = true;
	}

	function providerLabel(entry: NotifyHistoryRecord): string {
		const msg = (entry.error_message || '').toLowerCase();
		if (msg.includes('fcm')) return 'fcm';
		if (msg.includes('apns')) return 'apns';
		if (msg.includes('2factor')) return '2factor';
		if (msg.includes('twilio')) return 'twilio';
		if (msg.includes('sendgrid')) return 'sendgrid';
		if (msg.includes('smtp')) return 'smtp';
		return 'provider';
	}

	$effect(() => {
		tab;
		if (tab === 'history') {
			loadHistory();
		}
		if (tab === 'stats') {
			loadStats();
		}
	});

	onMount(async () => {
		await contextStore.ensureLoaded();
		await refreshAll();
	});
</script>

<div class="space-y-6" data-testid="notifications-page">
	<PageHeader title="Notifications" description="Send push/SMS/email, manage templates, and monitor delivery health." >
		{#snippet actions()}
			<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={refreshAll} disabled={loading}>
				{loading ? 'Refreshing...' : 'Refresh'}
			</button>
		{/snippet}
	</PageHeader>

	{#if error}
		<ErrorState message={error} onRetry={refreshAll} />
	{/if}

	<Tabs tabs={tabItems} active={tab} onChange={(key) => (tab = key as NotifyTab)} />

	{#if tab === 'send'}
		<SectionCard title="Send Notification" description="Choose channel and send immediately through configured providers.">
			<div class="space-y-4">
				<div class="grid gap-3 md:grid-cols-4">
					<label class="field md:col-span-1">
						<span>Channel</span>
						<select bind:value={sendChannel}>
							<option value="push">Push</option>
							<option value="sms">SMS</option>
							<option value="email">Email</option>
						</select>
					</label>
				</div>

				{#if sendChannel === 'push'}
					<div class="grid gap-3 md:grid-cols-2">
						<label class="field">
							<span>User ID (optional)</span>
							<input bind:value={pushForm.user_id} placeholder="user-uuid" />
						</label>
						<label class="field md:col-span-2">
							<span>Device tokens (comma/newline separated)</span>
							<textarea bind:value={pushForm.tokens_text} rows="3" placeholder="fcm-token-1\nfcm-token-2"></textarea>
						</label>
						<label class="field">
							<span>Title</span>
							<input bind:value={pushForm.title} placeholder="Order Confirmed" />
						</label>
						<label class="field">
							<span>Body</span>
							<input bind:value={pushForm.body} placeholder="Your order #123 is confirmed." />
						</label>
						<label class="field md:col-span-2">
							<span>Custom data (JSON)</span>
							<textarea bind:value={pushForm.data_text} rows="4"></textarea>
						</label>
					</div>
				{/if}

				{#if sendChannel === 'sms'}
					<div class="grid gap-3 md:grid-cols-2">
						<label class="field">
							<span>Phone (91XXXXXXXXXX)</span>
							<input bind:value={smsForm.to} placeholder="919876543210" />
						</label>
						<label class="field">
							<span>DLT Template ID (required)</span>
							<input bind:value={smsForm.dlt_template_id} placeholder="DLT1234567890" />
						</label>
						<div class="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
							DLT registration is mandatory for India SMS delivery. Keep the template ID aligned with your approved telecom template.
						</div>
						<label class="field md:col-span-2">
							<span>Template (optional)</span>
							<select bind:value={smsForm.template_id}>
								<option value="">Manual SMS body</option>
								{#each templates.filter((t) => t.channel === 'sms') as tpl}
									<option value={tpl.name}>{tpl.name}</option>
								{/each}
							</select>
						</label>
						<label class="field md:col-span-2">
							<span>Body ({smsBodyLength}/160)</span>
							<textarea bind:value={smsForm.body} rows="3" maxlength="160" placeholder="Dear &#123;&#123;name&#125;&#125;, Rs.&#123;&#123;amount&#125;&#125; paid successfully..."></textarea>
						</label>
						<label class="field md:col-span-2">
							<span>Template variables (JSON)</span>
							<textarea bind:value={smsForm.variables_text} rows="4"></textarea>
						</label>
					</div>
				{/if}

				{#if sendChannel === 'email'}
					<div class="grid gap-3 md:grid-cols-2">
						<label class="field md:col-span-2">
							<span>To (comma/newline separated)</span>
							<textarea bind:value={emailForm.to_text} rows="2" placeholder="user1@example.com,user2@example.com"></textarea>
						</label>
						<label class="field md:col-span-2">
							<span>Template (optional)</span>
							<select bind:value={emailForm.template_id}>
								<option value="">Manual subject/body</option>
								{#each templates.filter((t) => t.channel === 'email') as tpl}
									<option value={tpl.name}>{tpl.name}</option>
								{/each}
							</select>
						</label>
						<label class="field">
							<span>Subject</span>
							<input bind:value={emailForm.subject} placeholder="Payment receipt" />
						</label>
						<label class="field inline-field">
							<span>HTML</span>
							<input type="checkbox" bind:checked={emailForm.is_html} />
						</label>
						<label class="field md:col-span-2">
							<span>Body</span>
							<textarea bind:value={emailForm.body} rows="6" placeholder="Hi {{name}}, your invoice is attached."></textarea>
						</label>
						<label class="field md:col-span-2">
							<span>Template variables (JSON)</span>
							<textarea bind:value={emailForm.variables_text} rows="4"></textarea>
						</label>
					</div>
				{/if}

				<div class="flex justify-end">
					<button class="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={handleSend} data-testid="notifications-send-submit">
						Send
					</button>
				</div>
			</div>
		</SectionCard>
	{/if}

	{#if tab === 'templates'}
		<SectionCard title="Templates" description="Create reusable notification templates with variable placeholders.">
			<div class="space-y-4">
				<div class="flex items-center justify-between">
					<p class="text-sm text-gray-500">{templates.length} templates</p>
					<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={() => openTemplateModal()} data-testid="notifications-new-template">
						New Template
					</button>
				</div>
				<div class="overflow-x-auto">
					<table class="min-w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 text-left text-gray-500">
								<th class="px-2 py-2">Name</th>
								<th class="px-2 py-2">Channel</th>
								<th class="px-2 py-2">Variables</th>
								<th class="px-2 py-2">Updated</th>
								<th class="px-2 py-2">Actions</th>
							</tr>
						</thead>
						<tbody>
							{#if templates.length === 0}
								<tr><td class="px-2 py-4 text-gray-500" colspan="5"><EmptyState title="No templates found" message="Create reusable notification templates for faster launches and safer repeat sends." /></td></tr>
							{:else}
								{#each templates as template}
									<tr class="border-b border-gray-100" data-testid={`notifications-template-${template.name}`}>
										<td class="px-2 py-2 font-medium">{template.name}</td>
										<td class="px-2 py-2"><StatusBadge status={template.channel} /></td>
										<td class="px-2 py-2 text-xs text-gray-600">{(template.variables ?? []).join(', ') || '-'}</td>
										<td class="px-2 py-2 text-gray-500">{formatDateTime(template.updated_at || template.created_at)}</td>
										<td class="px-2 py-2">
											<div class="flex gap-2">
												<button class="rounded border px-2 py-1 text-xs" onclick={() => openTemplateModal(template)}>Edit</button>
												<button class="rounded border px-2 py-1 text-xs" onclick={() => previewTemplate(template)}>Preview</button>
												<button class="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onclick={() => deleteTemplate(template)}>Delete</button>
											</div>
										</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
				{#if previewResult}
					<div class="rounded-md border border-gray-200 bg-gray-50 p-3">
						<p class="mb-2 text-sm font-medium">Template Preview</p>
						<JsonViewer value={safeJsonParse(previewResult, previewResult)} maxHeight="12rem" />
					</div>
				{/if}
			</div>
		</SectionCard>
	{/if}

	{#if tab === 'history'}
		<SectionCard title="History" description="Track notification deliveries and inspect failed requests.">
			<div class="space-y-4">
				<div class="grid gap-3 md:grid-cols-6">
					<label class="field">
						<span>Channel</span>
						<select bind:value={historyFilters.channel}>
							<option value="">All</option>
							<option value="push">Push</option>
							<option value="sms">SMS</option>
							<option value="email">Email</option>
							<option value="whatsapp">WhatsApp</option>
						</select>
					</label>
					<label class="field">
						<span>Status</span>
						<select bind:value={historyFilters.status}>
							<option value="">All</option>
							<option value="sent">sent</option>
							<option value="delivered">delivered</option>
							<option value="failed">failed</option>
							<option value="queued">queued</option>
						</select>
					</label>
					<label class="field">
						<span>User ID</span>
						<input bind:value={historyFilters.user_id} placeholder="user-uuid" />
					</label>
					<label class="field">
						<span>From</span>
						<input type="date" bind:value={historyFilters.date_from} />
					</label>
					<label class="field">
						<span>To</span>
						<input type="date" bind:value={historyFilters.date_to} />
					</label>
					<div class="flex items-end">
						<button class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={loadHistory}>Apply</button>
					</div>
				</div>

				<div class="overflow-x-auto">
					<table class="min-w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 text-left text-gray-500">
								<th class="px-2 py-2">Recipient</th>
								<th class="px-2 py-2">Channel</th>
								<th class="px-2 py-2">Status</th>
								<th class="px-2 py-2">Sent At</th>
								<th class="px-2 py-2">Provider</th>
								<th class="px-2 py-2">Error</th>
							</tr>
						</thead>
						<tbody>
							{#if filteredHistory.length === 0}
								<tr><td class="px-2 py-4 text-gray-500" colspan="6"><EmptyState title="No notifications found" message="Try widening the filters or send a new notification to populate delivery history." /></td></tr>
							{:else}
								{#each filteredHistory as item}
									<tr class="cursor-pointer border-b border-gray-100 hover:bg-gray-50" onclick={() => openHistoryDetail(item)} data-testid={`notifications-history-${item.id}`}>
										<td class="px-2 py-2">{item.recipient}</td>
										<td class="px-2 py-2"><StatusBadge status={item.channel} /></td>
										<td class="px-2 py-2"><StatusBadge status={item.status} /></td>
										<td class="px-2 py-2 text-gray-500">{formatDateTime(item.sent_at)}</td>
										<td class="px-2 py-2"><span class="rounded bg-gray-100 px-2 py-0.5 text-xs">{providerLabel(item)}</span></td>
										<td class="px-2 py-2 text-xs text-red-600">{item.error_message || '-'}</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			</div>
		</SectionCard>
	{/if}

	{#if tab === 'stats'}
		<div class="grid gap-4 md:grid-cols-5">
			<StatCard label="Total Sent" value={formatNumber(statsCards.totalSent)} hint="Across all channels" />
			<StatCard label="Push Sent" value={formatNumber(statsCards.pushSent)} hint="FCM + APNs" />
			<StatCard label="SMS Sent" value={formatNumber(statsCards.smsSent)} hint="India DLT-ready flow" />
			<StatCard label="Email Sent" value={formatNumber(statsCards.emailSent)} hint="Transactional email volume" />
			<StatCard label="Failure Rate" value={`${statsCards.failureRate.toFixed(1)}%`} hint="Recent delivery quality" trend={statsCards.failureRate > 5 ? 'watch' : 'healthy'} trendTone={statsCards.failureRate > 5 ? 'warn' : 'good'} />
		</div>
		<SectionCard title="Delivery Trend" description="Snapshot of sent notifications by channel.">
			<MetricChart points={statsChartPoints} height={220} />
		</SectionCard>
	{/if}
</div>

{#if showTemplateModal}
	<div class="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4">
		<div class="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-4 shadow-xl">
			<h3 class="text-lg font-semibold">{editingTemplate ? 'Edit Template' : 'New Template'}</h3>
			<div class="mt-3 grid gap-3 md:grid-cols-2">
				<label class="field">
					<span>Name</span>
					<input bind:value={templateForm.name} placeholder="payment-success-sms" disabled={!!editingTemplate} />
				</label>
				<label class="field">
					<span>Channel</span>
					<select bind:value={templateForm.channel} disabled={!!editingTemplate}>
						<option value="push">push</option>
						<option value="sms">sms</option>
						<option value="email">email</option>
						<option value="whatsapp">whatsapp</option>
					</select>
				</label>
				<label class="field md:col-span-2">
					<span>Subject (email/push)</span>
					<input bind:value={templateForm.subject} placeholder="Order Confirmed" />
				</label>
				<label class="field md:col-span-2">
					<span>Body</span>
					<textarea bind:value={templateForm.body} rows="6" placeholder="Dear {{name}}, your payment was successful."></textarea>
				</label>
				<label class="field md:col-span-2">
					<span>Variables (comma-separated)</span>
					<input bind:value={templateForm.variables_text} placeholder="name,amount,merchant,method,ref_id" />
				</label>
			</div>
			<div class="mt-4 flex justify-end gap-2">
				<button class="rounded-md border border-gray-300 px-3 py-2 text-sm" onclick={() => { showTemplateModal = false; resetTemplateForm(); }}>
					Cancel
				</button>
				<button class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700" onclick={saveTemplate} data-testid="notifications-save-template">
					{editingTemplate ? 'Save Changes' : 'Create Template'}
				</button>
			</div>
		</div>
	</div>
{/if}

<SlideOver open={historyDetailOpen} title="Notification Details" onclose={() => (historyDetailOpen = false)}>
	{#if selectedHistory}
		<div class="space-y-3 text-sm">
			<div><strong>ID:</strong> <span class="font-mono text-xs">{selectedHistory.id}</span></div>
			<div><strong>Recipient:</strong> {selectedHistory.recipient}</div>
			<div><strong>Channel:</strong> <StatusBadge status={selectedHistory.channel} /></div>
			<div><strong>Status:</strong> <StatusBadge status={selectedHistory.status} /></div>
			<div><strong>Sent:</strong> {formatDateTime(selectedHistory.sent_at)}</div>
			<div><strong>Provider:</strong> {providerLabel(selectedHistory)}</div>
			<div>
				<strong>Error:</strong>
				<pre class="mt-1 overflow-auto rounded bg-gray-50 p-2 text-xs">{selectedHistory.error_message || '-'}</pre>
			</div>
		</div>
	{/if}
</SlideOver>

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
		justify-content: flex-start;
		gap: 0.6rem;
	}
	.inline-field input { width: auto; }
	pre { white-space: pre-wrap; word-break: break-word; }
</style>

<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { apiClient } from '$api/client';
	import { studioApi, type DashboardSnapshot } from '$lib/api/studio';
	import { contextStore } from '$lib/stores/context';
	import { toastStore } from '$stores/toast';
	import { formatBytes, formatDateTime, formatINR, formatNumber } from '$lib/utils/format';
	import PageHeader from '$lib/components/studio/PageHeader.svelte';
	import SectionCard from '$lib/components/studio/SectionCard.svelte';
	import StatCard from '$lib/components/studio/StatCard.svelte';
	import TrendCard from '$lib/components/studio/TrendCard.svelte';
	import EmptyState from '$lib/components/studio/EmptyState.svelte';
	import ErrorState from '$lib/components/studio/ErrorState.svelte';
	import LoadingSkeleton from '$lib/components/studio/LoadingSkeleton.svelte';
	import PlanBadge from '$lib/components/studio/PlanBadge.svelte';
	import SeverityBadge from '$lib/components/studio/SeverityBadge.svelte';
	import StatusBadge from '$lib/components/studio/StatusBadge.svelte';

	type AuditEvent = {
		id: string;
		action: string;
		severity: string;
		resource_type?: string;
		actor_email?: string;
		created_at: string;
	};

	let loading = $state(true);
	let error = $state('');
	let snapshot = $state<DashboardSnapshot | null>(null);
	let recentAudit = $state<AuditEvent[]>([]);
	let lastLoadKey = $state('');

	const usageEntries = $derived.by(() => {
		const usage = (snapshot?.usageSummary ?? {}) as Record<string, unknown>;
		return Object.entries(usage)
			.filter(([_, value]) => typeof value === 'number')
			.map(([metric, value]) => ({ metric, total: Number(value) }))
			.sort((a, b) => b.total - a.total);
	});

	const queueStatusCounts = $derived.by(() => {
		const counters = new Map<string, number>();
		for (const job of snapshot?.jobs ?? []) {
			const status = String(job.status ?? 'unknown');
			counters.set(status, (counters.get(status) ?? 0) + 1);
		}
		return Array.from(counters.entries()).map(([status, count]) => ({ status, count }));
	});

	const incidentCount = $derived((snapshot?.incidents ?? []).length);
	const healthDownCount = $derived.by(() =>
		(snapshot?.components ?? []).filter((component) => String(component.status).toLowerCase() !== 'operational').length
	);
	const notificationStats = $derived.by(() => {
		const stats = (snapshot?.notifyStats ?? {}) as Record<string, unknown>;
		return {
			total: Number(stats.total_sent ?? 0),
			push: Number(((stats.push as Record<string, unknown>)?.sent as number) ?? 0),
			sms: Number(((stats.sms as Record<string, unknown>)?.sent as number) ?? 0),
			email: Number(((stats.email as Record<string, unknown>)?.sent as number) ?? 0)
		};
	});
	const newProject = $derived.by(() => usageEntries.length === 0 && (snapshot?.collections.length ?? 0) === 0);
	const attentionItems = $derived.by(() => {
		const items: Array<{ label: string; hint: string; tone: 'default' | 'warn' | 'danger' | 'good'; href: string }> = [];
		if (healthDownCount > 0) {
			items.push({
				label: 'Components degraded',
				hint: `${healthDownCount} component(s) require attention`,
				tone: 'danger',
				href: '/status'
			});
		}
		if ((snapshot?.incidents.length ?? 0) > 0) {
			items.push({
				label: 'Active incidents',
				hint: `${snapshot?.incidents.length ?? 0} incident(s) are still open`,
				tone: 'warn',
				href: '/status'
			});
		}
		if ((snapshot?.flagsCount ?? 0) === 0) {
			items.push({
				label: 'No feature flags configured',
				hint: 'Create controlled rollouts before launch',
				tone: 'default',
				href: '/flags'
			});
		}
		if ((snapshot?.collections.length ?? 0) === 0) {
			items.push({
				label: 'AI collections missing',
				hint: 'Create a vector collection to test semantic search',
				tone: 'default',
				href: '/ai'
			});
		}
		if (items.length === 0) {
			items.push({
				label: 'Everything looks healthy',
				hint: 'No urgent action items for this project scope',
				tone: 'good',
				href: '/status'
			});
		}
		return items;
	});

	function metricLabel(metric: string): string {
		return metric.replaceAll('_', ' ');
	}

	function metricValue(metric: string, value: number): string {
		if (metric.includes('bytes') || metric.includes('storage')) {
			return formatBytes(value);
		}
		if (metric.includes('amount') || metric.includes('inr') || metric.includes('tax')) {
			return formatINR(value);
		}
		return formatNumber(value);
	}

	async function loadDashboard() {
		const projectId = contextStore.activeProjectId;
		if (!projectId) {
			loading = false;
			error = '';
			snapshot = null;
			return;
		}

		loading = true;
		error = '';
		try {
			const [dashResult, auditResult] = await Promise.allSettled([
				studioApi.fetchDashboard(projectId, contextStore.environment),
				apiClient.requestNormalized<AuditEvent[]>(
					'GET',
					`/audit/events?limit=8&project_id=${encodeURIComponent(projectId)}`
				)
			]);

			if (dashResult.status === 'fulfilled') {
				snapshot = dashResult.value;
			} else {
				throw dashResult.reason;
			}

			recentAudit = auditResult.status === 'fulfilled' ? auditResult.value.data ?? [] : [];
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load dashboard';
			toastStore.error(error);
		} finally {
			loading = false;
		}
	}

	function navigate(path: string) {
		goto(path);
	}

	$effect(() => {
		const key = `${contextStore.activeProjectId}:${contextStore.environment}`;
		if (!key || key === ':' || key === lastLoadKey) return;
		lastLoadKey = key;
		void loadDashboard();
	});

	onMount(async () => {
		await contextStore.ensureLoaded();
		await loadDashboard();
	});
</script>

<div class="space-y-6" data-testid="dashboard-page">
	<PageHeader
		title="Dashboard"
		description={`Premium control-plane overview for ${contextStore.activeProject?.name || 'your project'} in ${contextStore.environment}.`}
		eyebrow="Overview"
		testId="dashboard-header"
	>
		{#snippet actions()}
			<div class="flex flex-wrap gap-2">
				<button class="secondary" onclick={() => void loadDashboard()} disabled={loading} data-testid="dashboard-refresh">
					{loading ? 'Refreshing...' : 'Refresh'}
				</button>
				<button class="secondary" onclick={() => navigate('/status')}>Open Status</button>
				<button class="primary" onclick={() => navigate('/sql-editor')}>Run Query</button>
			</div>
		{/snippet}
	</PageHeader>

	{#if loading}
		<LoadingSkeleton lines={12} />
	{:else if error}
		<ErrorState title="Dashboard unavailable" message={error} onRetry={() => void loadDashboard()} />
	{:else if !contextStore.activeProject}
		<EmptyState title="No active project" message="Create or select a project to load your operational overview." icon="◇">
			{#snippet actions()}
				<button class="primary" onclick={() => navigate('/onboarding')}>Create project</button>
			{/snippet}
		</EmptyState>
	{:else}
		<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
			<StatCard label="Project" value={contextStore.activeProject.name} hint={contextStore.activeProject.region || 'ap-south-1'} />
			<StatCard label="Plan" value={contextStore.activeOrganization?.plan || 'free'} hint={contextStore.activeOrganization?.slug || 'workspace'}>
				{#snippet after()}
					<PlanBadge plan={contextStore.activeOrganization?.plan || 'free'} />
				{/snippet}
			</StatCard>
			<TrendCard label="Incidents" value={String(incidentCount)} hint={healthDownCount > 0 ? `${healthDownCount} degraded component(s)` : 'All components operational'} trend={healthDownCount > 0 ? 'Needs attention' : 'Healthy'} tone={healthDownCount > 0 ? 'danger' : 'good'} />
			<TrendCard label="Flags" value={String(snapshot?.flagsCount ?? 0)} hint={`${contextStore.environment} environment`} trend={(snapshot?.flagsCount ?? 0) > 0 ? 'Configured' : 'Missing'} tone={(snapshot?.flagsCount ?? 0) > 0 ? 'good' : 'warn'} />
		</div>

		<div class="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
			<SectionCard title="Quick actions" description="Jump straight into the most common project setup and operating workflows." eyebrow="Accelerate">
				<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					<button class="quick-action" onclick={() => navigate('/table-editor')} data-testid="quick-open-table-editor">
						<strong>Database</strong>
						<span>Open the table editor</span>
					</button>
					<button class="quick-action" onclick={() => navigate('/flags')}>
						<strong>Feature flags</strong>
						<span>Create rollout controls</span>
					</button>
					<button class="quick-action" onclick={() => navigate('/notifications')}>
						<strong>Notifications</strong>
						<span>Send push, SMS, or email</span>
					</button>
					<button class="quick-action" onclick={() => navigate('/queue')}>
						<strong>Queue</strong>
						<span>Inspect jobs and webhooks</span>
					</button>
					<button class="quick-action" onclick={() => navigate('/ai')}>
						<strong>AI search</strong>
						<span>Create collections and search</span>
					</button>
					<button class="quick-action" onclick={() => navigate('/settings')}>
						<strong>Settings</strong>
						<span>Review project metadata</span>
					</button>
				</div>
			</SectionCard>

			<SectionCard title="What needs attention" description="High-signal operational callouts for the active project." eyebrow="Attention">
				<div class="space-y-3">
					{#each attentionItems as item}
						<button class="attention-row" onclick={() => navigate(item.href)}>
							<div>
								<strong>{item.label}</strong>
								<p>{item.hint}</p>
							</div>
							<span class={`attention-pill ${item.tone}`}>{item.tone}</span>
						</button>
					{/each}
				</div>
			</SectionCard>
		</div>

		{#if newProject}
			<SectionCard title="Project quickstart" description="This workspace is still fresh. Complete the setup checklist to make the control plane useful." eyebrow="New project">
				<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
					<div class="check-card">
						<strong>Create your first table</strong>
						<p>Provision schema and browse rows from the table editor.</p>
						<button class="secondary" onclick={() => navigate('/table-editor')}>Open Table Editor</button>
					</div>
					<div class="check-card">
						<strong>Set rollout controls</strong>
						<p>Feature flags and remote config should be ready before demo traffic.</p>
						<button class="secondary" onclick={() => navigate('/flags')}>Open Flags</button>
					</div>
					<div class="check-card">
						<strong>Wire notifications</strong>
						<p>Configure DLT SMS, push, and email provider credentials.</p>
						<button class="secondary" onclick={() => navigate('/notifications')}>Open Notifications</button>
					</div>
					<div class="check-card">
						<strong>Load documentation</strong>
						<p>Use onboarding snippets and the public docs to complete setup.</p>
						<button class="secondary" onclick={() => navigate('/onboarding')}>Open Onboarding</button>
					</div>
				</div>
			</SectionCard>
		{/if}

		<div class="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
			<SectionCard title="Usage snapshot" description="Top project metrics from billing and infrastructure usage." eyebrow="Usage">
				{#if usageEntries.length === 0}
					<EmptyState title="No usage yet" message="Run a few requests or uploads to populate this section." icon="↗" />
				{:else}
					<div class="space-y-3">
						{#each usageEntries.slice(0, 8) as item}
							<div class="metric-row">
								<div>
									<strong>{metricLabel(item.metric)}</strong>
									<p>Billable usage metric</p>
								</div>
								<span>{metricValue(item.metric, item.total)}</span>
							</div>
						{/each}
					</div>
				{/if}
			</SectionCard>

			<SectionCard title="Notification delivery" description="Recent sends across push, SMS, and email." eyebrow="Comms">
				<div class="grid gap-3 sm:grid-cols-3">
					<TrendCard label="Total sent" value={formatNumber(notificationStats.total)} tone={notificationStats.total > 0 ? 'good' : 'default'} />
					<TrendCard label="Push" value={formatNumber(notificationStats.push)} tone={notificationStats.push > 0 ? 'good' : 'default'} />
					<TrendCard label="SMS / Email" value={`${formatNumber(notificationStats.sms)} / ${formatNumber(notificationStats.email)}`} tone={(notificationStats.sms + notificationStats.email) > 0 ? 'good' : 'default'} />
				</div>
			</SectionCard>
		</div>

		<div class="grid gap-4 xl:grid-cols-3">
			<SectionCard title="System health" description="Component state derived from the public status feed." eyebrow="Ops">
				{#if (snapshot?.components.length ?? 0) === 0}
					<EmptyState title="No health data" message="Status components have not reported yet." icon="◎" />
				{:else}
					<div class="space-y-3">
						{#each snapshot?.components ?? [] as component}
							<div class="health-row">
								<div>
									<strong>{String(component.name ?? component.slug ?? 'component')}</strong>
									<p>{String(component.description ?? 'Control-plane component')}</p>
								</div>
								<StatusBadge status={String(component.status ?? 'unknown')} />
							</div>
						{/each}
					</div>
				{/if}
			</SectionCard>

			<SectionCard title="Queue activity" description="Status mix from the most recent jobs." eyebrow="Queue">
				{#if queueStatusCounts.length === 0}
					<EmptyState title="No recent jobs" message="Enqueue work or configure a webhook to populate queue activity." icon="⇄" />
				{:else}
					<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
						{#each queueStatusCounts as status}
							<div class="queue-cell">
								<div>
									<strong>{status.status}</strong>
									<p>Recent jobs</p>
								</div>
								<span>{formatNumber(status.count)}</span>
							</div>
						{/each}
					</div>
				{/if}
			</SectionCard>

			<SectionCard title="Collections & audit" description="AI readiness and recent operator activity." eyebrow="Activity">
				<div class="space-y-4">
					<div class="summary-block">
						<div>
							<strong>Vector collections</strong>
							<p>Semantic search inventory</p>
						</div>
						<span>{formatNumber(snapshot?.collections.length ?? 0)}</span>
					</div>
					{#if recentAudit.length === 0}
						<EmptyState title="No recent audit events" message="Recent project activity will appear here." icon="☰" />
					{:else}
						<div class="space-y-3">
							{#each recentAudit as event}
								<button class="audit-row" onclick={() => navigate('/audit')}>
									<div>
										<strong>{event.action}</strong>
										<p>{event.resource_type || 'resource'} • {event.actor_email || 'system'} • {formatDateTime(event.created_at)}</p>
									</div>
									<SeverityBadge severity={event.severity} />
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</SectionCard>
		</div>
	{/if}
</div>

<style>
	.primary,
	.secondary,
	.quick-action,
	.attention-row,
	.check-card button,
	.audit-row {
		border-radius: 0.85rem;
		border: 1px solid var(--surface-6);
		background: var(--surface-2);
		color: var(--surface-12);
		cursor: pointer;
		transition: 160ms ease;
	}
	.primary,
	.secondary {
		padding: 0.65rem 0.95rem;
	}
	.primary {
		background: #f97316;
		border-color: #f97316;
		color: white;
	}
	.primary:hover,
	.secondary:hover,
	.quick-action:hover,
	.attention-row:hover,
	.check-card button:hover,
	.audit-row:hover {
		transform: translateY(-1px);
	}
	.secondary:hover,
	.quick-action:hover,
	.attention-row:hover,
	.check-card button:hover,
	.audit-row:hover {
		background: var(--surface-3);
	}
	.quick-action,
	.attention-row,
	.audit-row {
		text-align: left;
	}
	.quick-action {
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.quick-action strong,
	.metric-row strong,
	.health-row strong,
	.queue-cell strong,
	.summary-block strong,
	.audit-row strong,
	.attention-row strong,
	.check-card strong {
		font-size: 0.95rem;
	}
	.quick-action span,
	.metric-row p,
	.health-row p,
	.queue-cell p,
	.summary-block p,
	.audit-row p,
	.attention-row p,
	.check-card p {
		margin: 0.2rem 0 0;
		color: var(--surface-10);
		font-size: 0.82rem;
	}
	.attention-row,
	.metric-row,
	.health-row,
	.queue-cell,
	.summary-block,
	.audit-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.9rem 1rem;
		border: 1px solid var(--surface-6);
		border-radius: 0.95rem;
		background: var(--surface-1);
	}
	.attention-pill {
		border-radius: 999px;
		padding: 0.35rem 0.7rem;
		font-size: 0.74rem;
		text-transform: capitalize;
	}
	.attention-pill.good {
		background: rgba(74, 222, 128, 0.12);
		color: #86efac;
	}
	.attention-pill.warn {
		background: rgba(251, 191, 36, 0.12);
		color: #fde68a;
	}
	.attention-pill.danger {
		background: rgba(248, 113, 113, 0.12);
		color: #fca5a5;
	}
	.attention-pill.default {
		background: var(--surface-3);
		color: var(--surface-10);
	}
	.check-card {
		border: 1px solid var(--surface-6);
		border-radius: 1rem;
		padding: 1rem;
		background: var(--surface-1);
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}
	.check-card button {
		padding: 0.65rem 0.85rem;
	}
	.metric-row span,
	.queue-cell span,
	.summary-block span {
		font-size: 1rem;
		font-weight: 600;
		color: var(--surface-12);
	}
</style>

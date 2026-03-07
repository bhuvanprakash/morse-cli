<script lang="ts">
	import { onMount } from 'svelte';
	import { studioApi } from '$lib/api/studio';
	import { contextStore } from '$lib/stores/context';
	import { auth } from '$stores/auth';
	import { toastStore } from '$stores/toast';
	import PageHeader from '$lib/components/studio/PageHeader.svelte';
	import SectionCard from '$lib/components/studio/SectionCard.svelte';
	import StatCard from '$lib/components/studio/StatCard.svelte';
	import EmptyState from '$lib/components/studio/EmptyState.svelte';
	import ErrorState from '$lib/components/studio/ErrorState.svelte';
	import LoadingSkeleton from '$lib/components/studio/LoadingSkeleton.svelte';
	import FormField from '$lib/components/studio/FormField.svelte';
	import FormActions from '$lib/components/studio/FormActions.svelte';
	import StatusBadge from '$lib/components/studio/StatusBadge.svelte';
	import MetricChart from '$lib/components/studio/MetricChart.svelte';
	import JsonViewer from '$lib/components/studio/JsonViewer.svelte';
	import SlideOver from '$lib/components/studio/SlideOver.svelte';
	import PlanBadge from '$lib/components/studio/PlanBadge.svelte';
	import { formatDate, formatDateTime, formatINR, formatNumber } from '$lib/utils/format';
	import { confirmDialog } from '$lib/stores/confirm';

	type Plan = {
		id?: string;
		key: string;
		name: string;
		monthly_inr: number;
		currency?: string;
		limits?: Record<string, number>;
		overage_inr?: Record<string, number>;
	};

	type Subscription = {
		id: string;
		project_id: string;
		plan_key: string;
		status: string;
		business_name?: string;
		gstin?: string;
		billing_address?: string;
		state_code?: string;
		country_code?: string;
		updated_at?: string;
	};

	type Invoice = {
		id: string;
		period_start: string;
		period_end: string;
		currency: string;
		total_amount: number;
		tax_amount: number;
		subtotal: number;
		status: string;
		line_items?: unknown;
		created_at?: string;
	};

	type UsageDaily = {
		period: string;
		metric: string;
		quantity: number;
	};

	type InvoicePreview = {
		project_id: string;
		currency: string;
		period_start: string;
		period_end: string;
		plan?: Record<string, unknown>;
		usage_summary?: Record<string, number>;
		line_items?: unknown;
		subtotal?: number;
		gst_amount?: number;
		total?: number;
		amount_display?: string;
	};

	let loading = $state(false);
	let error = $state('');
	let plans = $state<Plan[]>([]);
	let usageSummary = $state<Record<string, number>>({});
	let usageDaily = $state<UsageDaily[]>([]);
	let invoices = $state<Invoice[]>([]);
	let preview = $state<InvoicePreview | null>(null);
	let activeSubscription = $state<Subscription | null>(null);
	let selectedInvoice = $state<Invoice | null>(null);
	let showInvoiceDetail = $state(false);
	let savingProfile = $state(false);
	let planChanging = $state<string>('');

	let billingProfile = $state({
		business_name: '',
		gstin: '',
		billing_address: '',
		state_code: '',
		country_code: 'IN'
	});

	const canManageBilling = $derived.by(() => {
		const role = String(auth.user?.role ?? '').toLowerCase();
		return role === 'admin' || role === 'owner';
	});

	const selectedPlan = $derived.by(() => {
		const key =
			activeSubscription?.plan_key ||
			String(preview?.plan?.key ?? '') ||
			(plans.find((plan) => plan.key === 'free')?.key ?? 'free');
		return plans.find((plan) => plan.key === key) ?? null;
	});

	const usageRows = $derived.by(() => {
		const limits = selectedPlan?.limits ?? {};
		const keys = new Set<string>([...Object.keys(usageSummary), ...Object.keys(limits)]);
		return Array.from(keys)
			.sort()
			.map((metric) => {
				const used = Number(usageSummary[metric] ?? 0);
				const limit = Number(limits[metric] ?? 0);
				const percentage = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
				return {
					metric,
					used,
					limit,
					percentage,
					over: limit > 0 && used > limit
				};
			});
	});

	const usageChart = $derived.by(() => {
		const totals = new Map<string, number>();
		for (const row of usageDaily) {
			totals.set(row.period, (totals.get(row.period) ?? 0) + Number(row.quantity ?? 0));
		}
		return Array.from(totals.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.slice(-14)
			.map(([period, value]) => ({
				label: period.slice(5),
				value,
				tone: 'orange' as const
			}));
	});

	const overageCount = $derived.by(() => usageRows.filter((row) => row.over).length);

	const invoiceLineItems = $derived.by(() => {
		if (!preview?.line_items) return [];
		if (Array.isArray(preview.line_items)) return preview.line_items as Array<Record<string, unknown>>;
		if (typeof preview.line_items === 'string') {
			try {
				const parsed = JSON.parse(preview.line_items);
				return Array.isArray(parsed) ? parsed : [];
			} catch {
				return [];
			}
		}
		return [];
	});

	function toPlan(plan: Record<string, unknown>): Plan {
		return {
			id: plan.id ? String(plan.id) : undefined,
			key: String(plan.key ?? ''),
			name: String(plan.name ?? plan.key ?? 'plan'),
			monthly_inr: Number(plan.monthly_inr ?? 0),
			currency: String(plan.currency ?? 'INR'),
			limits: (plan.limits as Record<string, number>) ?? {},
			overage_inr: (plan.overage_inr as Record<string, number>) ?? {}
		};
	}

	function toInvoice(row: Record<string, unknown>): Invoice {
		return {
			id: String(row.id ?? ''),
			period_start: String(row.period_start ?? ''),
			period_end: String(row.period_end ?? ''),
			currency: String(row.currency ?? 'INR'),
			total_amount: Number(row.total_amount ?? 0),
			tax_amount: Number(row.tax_amount ?? 0),
			subtotal: Number(row.subtotal ?? 0),
			status: String(row.status ?? 'unknown'),
			line_items: row.line_items,
			created_at: row.created_at ? String(row.created_at) : undefined
		};
	}

	function hydrateProfile() {
		billingProfile = {
			business_name: String(activeSubscription?.business_name ?? ''),
			gstin: String(activeSubscription?.gstin ?? ''),
			billing_address: String(activeSubscription?.billing_address ?? ''),
			state_code: String(activeSubscription?.state_code ?? ''),
			country_code: String(activeSubscription?.country_code ?? 'IN')
		};
	}

	async function loadBilling() {
		const projectId = contextStore.activeProjectId;
		if (!projectId) {
			error = '';
			return;
		}

		loading = true;
		error = '';
		try {
			const [plansData, usageData, usageDailyData, invoicesData, previewData, subscriptionData] = await Promise.all([
				studioApi.listBillingPlans(),
				studioApi.getBillingUsageSummary(projectId),
				studioApi.listBillingUsageDaily(projectId, 30),
				studioApi.listInvoices(projectId),
				studioApi.previewInvoice(projectId),
				studioApi.getActiveSubscription(projectId)
			]);

			plans = (plansData ?? []).map((row) => toPlan(row as Record<string, unknown>));
			usageSummary = (usageData ?? {}) as Record<string, number>;
			usageDaily = (usageDailyData ?? []).map((row) => ({
				period: String(row.period ?? ''),
				metric: String(row.metric ?? ''),
				quantity: Number(row.quantity ?? 0)
			}));
			invoices = (invoicesData ?? []).map((row) => toInvoice(row as Record<string, unknown>));
			preview = (previewData ?? null) as InvoicePreview | null;
			activeSubscription = subscriptionData ? (subscriptionData as Subscription) : null;
			hydrateProfile();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load billing data';
			toastStore.error(error);
		} finally {
			loading = false;
		}
	}

	async function saveProfile() {
		if (!contextStore.activeProjectId) return;
		if (!canManageBilling) {
			toastStore.error('Only owners/admins can update billing profile');
			return;
		}
		savingProfile = true;
		try {
			if (activeSubscription?.id) {
				await studioApi.updateSubscription(activeSubscription.id, billingProfile);
			} else {
				await studioApi.createSubscription({
					project_id: contextStore.activeProjectId,
					plan_key: selectedPlan?.key ?? 'free',
					...billingProfile
				});
			}
			toastStore.success('Billing profile saved');
			await loadBilling();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to save billing profile');
		} finally {
			savingProfile = false;
		}
	}

	async function changePlan(plan: Plan) {
		if (!contextStore.activeProjectId) return;
		if (!canManageBilling) {
			toastStore.error('Only owners/admins can change plans');
			return;
		}

		const ok = await confirmDialog.open({
			title: 'Change Billing Plan',
			message: `Switch plan to ${plan.name} (${formatINR(plan.monthly_inr)}/month)?`,
			confirmText: 'Confirm change'
		});
		if (!ok) return;

		planChanging = plan.key;
		try {
			if (activeSubscription?.id) {
				await studioApi.updateSubscription(activeSubscription.id, { plan_key: plan.key });
			} else {
				await studioApi.createSubscription({
					project_id: contextStore.activeProjectId,
					plan_key: plan.key,
					...billingProfile
				});
			}
			toastStore.success(`Plan changed to ${plan.name}`);
			await loadBilling();
		} catch (err) {
			toastStore.error(err instanceof Error ? err.message : 'Failed to change plan');
		} finally {
			planChanging = '';
		}
	}

	function openInvoice(invoice: Invoice) {
		selectedInvoice = invoice;
		showInvoiceDetail = true;
	}

	$effect(() => {
		contextStore.activeProjectId;
		contextStore.environment;
		loadBilling();
	});

	onMount(async () => {
		await contextStore.ensureLoaded();
		await loadBilling();
	});
</script>

<div class="space-y-6" data-testid="billing-page">
	<PageHeader title="Billing" description="Plan controls, usage metering, invoices, and GST billing profile for your active project.">
		{#snippet actions()}
			<button class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50" onclick={loadBilling} disabled={loading} data-testid="billing-refresh">
				{loading ? 'Refreshing...' : 'Refresh'}
			</button>
		{/snippet}
	</PageHeader>

	{#if !contextStore.activeProjectId}
		<EmptyState title="No active project" message="Select a project from the top bar to load billing data." />
	{:else}
		{#if error}
			<ErrorState message={error} onRetry={loadBilling} />
		{/if}

		{#if !canManageBilling}
			<div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
				You have read-only access to billing. Owner/admin role is required for plan and profile updates.
			</div>
		{/if}

		<div class="grid gap-4 md:grid-cols-4">
			<StatCard
				label="Current Plan"
				value={selectedPlan?.name || 'Free'}
				hint={contextStore.activeProject?.region || 'ap-south-1'}
			>
				{#snippet after()}
					{#if selectedPlan}
						<div class="mt-3">
							<PlanBadge plan={selectedPlan.key} />
						</div>
					{/if}
				{/snippet}
			</StatCard>
			<StatCard
				label="Monthly Estimate"
				value={preview?.total != null ? formatINR(preview.total) : formatINR(0)}
				hint="Includes GST"
			/>
			<StatCard
				label="Usage Metrics"
				value={formatNumber(usageRows.length)}
				hint="Billable dimensions tracked"
			/>
			<StatCard
				label="Overage Warnings"
				value={formatNumber(overageCount)}
				hint={overageCount > 0 ? 'Upgrade or optimize usage' : 'Within limits'}
				trend={overageCount > 0 ? 'action needed' : 'healthy'}
				trendTone={overageCount > 0 ? 'warn' : 'good'}
			/>
		</div>

		<div class="grid gap-6 lg:grid-cols-3">
			<SectionCard title="Usage Summary" description="Current billing period usage against plan limits.">
				{#if loading}
					<LoadingSkeleton lines={7} />
				{:else if usageRows.length === 0}
					<EmptyState title="No usage yet" message="Usage metrics will appear once your project starts receiving traffic." />
				{:else}
					<div class="space-y-4">
						{#each usageRows as row}
							<div class="space-y-1">
								<div class="flex items-center justify-between text-sm">
									<span class="font-medium text-gray-700">{row.metric.replaceAll('_', ' ')}</span>
									<span class="text-gray-500">
										{formatNumber(row.used)} / {row.limit > 0 ? formatNumber(row.limit) : 'unlimited'}
									</span>
								</div>
								<div class="h-2 rounded-full bg-gray-100">
									<div
										class={`h-2 rounded-full ${row.over ? 'bg-red-500' : row.percentage > 80 ? 'bg-amber-500' : 'bg-orange-500'}`}
										style={`width:${Math.max(4, row.percentage)}%`}
									></div>
								</div>
								{#if row.over}
									<p class="text-xs text-red-600">Overage active for this metric.</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</SectionCard>

			<SectionCard title="Usage Trend" description="Last 14 days aggregate usage events.">
				{#if loading}
					<LoadingSkeleton lines={6} />
				{:else if usageChart.length === 0}
					<EmptyState title="No trend data" message="Daily usage rollups have not been generated yet." />
				{:else}
					<MetricChart points={usageChart} height={180} />
				{/if}
			</SectionCard>

			<SectionCard title="Plan Catalog" description="Upgrade or downgrade with immediate billing profile continuity.">
				{#if loading}
					<LoadingSkeleton lines={7} />
				{:else if plans.length === 0}
					<EmptyState title="No plans configured" message="Billing plans were not returned by the billing service." />
				{:else}
					<div class="space-y-3">
						{#each plans as plan}
							<div class="rounded-lg border border-gray-200 p-3">
								<div class="flex items-center justify-between gap-2">
									<div>
										<p class="text-sm font-semibold text-gray-900">{plan.name}</p>
										<p class="text-xs text-gray-500">{plan.key}</p>
									</div>
									<StatusBadge status={activeSubscription?.plan_key === plan.key ? 'active' : 'available'} />
								</div>
								<p class="mt-2 text-lg font-semibold text-gray-900">{formatINR(plan.monthly_inr)}<span class="text-xs font-normal text-gray-500"> / month</span></p>
								<div class="mt-3">
									<button
										class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
										onclick={() => changePlan(plan)}
										disabled={!canManageBilling || planChanging === plan.key || activeSubscription?.plan_key === plan.key}
										data-testid={`billing-plan-${plan.key}`}
									>
										{planChanging === plan.key ? 'Applying...' : activeSubscription?.plan_key === plan.key ? 'Current plan' : 'Switch'}
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</SectionCard>
		</div>

		<div class="grid gap-6 lg:grid-cols-2">
			<SectionCard title="Billing Profile" description="GST-ready invoice identity fields for India payments.">
				<div class="space-y-3">
					<FormField label="Business Name">
						{#snippet children()}
								<input bind:value={billingProfile.business_name} class="input" placeholder="Acme Private Limited" data-testid="billing-business-name" />
						{/snippet}
					</FormField>
					<FormField label="GSTIN">
						{#snippet children()}
								<input bind:value={billingProfile.gstin} class="input" placeholder="27ABCDE1234F1Z5" data-testid="billing-gstin" />
						{/snippet}
					</FormField>
					<FormField label="Billing Address">
						{#snippet children()}
								<input bind:value={billingProfile.billing_address} class="input" placeholder="Mumbai, Maharashtra" data-testid="billing-address" />
						{/snippet}
					</FormField>
					<div class="grid gap-3 md:grid-cols-2">
						<FormField label="State Code">
							{#snippet children()}
								<input bind:value={billingProfile.state_code} class="input" placeholder="27" data-testid="billing-state-code" />
							{/snippet}
						</FormField>
						<FormField label="Country Code">
							{#snippet children()}
								<input bind:value={billingProfile.country_code} class="input" placeholder="IN" data-testid="billing-country-code" />
							{/snippet}
						</FormField>
					</div>
				</div>
				<FormActions>
					<button class="rounded-md border border-gray-300 px-3 py-2 text-sm" onclick={hydrateProfile}>Reset</button>
					<button
						class="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
						onclick={saveProfile}
						disabled={savingProfile || !canManageBilling}
						data-testid="billing-save-profile"
					>
						{savingProfile ? 'Saving...' : 'Save Profile'}
					</button>
				</FormActions>
			</SectionCard>

			<SectionCard title="Invoice Preview" description="Auto-calculated estimate for current period in INR.">
				{#if loading}
					<LoadingSkeleton lines={8} />
				{:else if !preview}
					<EmptyState title="No preview available" message="Invoice preview endpoint returned no data." />
				{:else}
					<div class="space-y-3" data-testid="billing-invoice-preview">
						<div class="grid gap-2 text-sm md:grid-cols-2">
							<div class="rounded-md bg-gray-50 p-2"><span class="text-gray-500">Period</span><div class="font-medium">{preview.period_start} → {preview.period_end}</div></div>
							<div class="rounded-md bg-gray-50 p-2"><span class="text-gray-500">Total</span><div class="font-medium">{formatINR(preview.total ?? 0)}</div></div>
							<div class="rounded-md bg-gray-50 p-2"><span class="text-gray-500">Subtotal</span><div class="font-medium">{formatINR(preview.subtotal ?? 0)}</div></div>
							<div class="rounded-md bg-gray-50 p-2"><span class="text-gray-500">GST</span><div class="font-medium">{formatINR(preview.gst_amount ?? 0)}</div></div>
						</div>
						{#if invoiceLineItems.length > 0}
							<div class="overflow-x-auto rounded-md border border-gray-200">
								<table class="min-w-full text-sm">
									<thead>
										<tr class="border-b border-gray-200 text-left text-gray-500">
											<th class="px-2 py-2">Line Item</th>
											<th class="px-2 py-2">Qty</th>
											<th class="px-2 py-2">Amount</th>
										</tr>
									</thead>
									<tbody>
										{#each invoiceLineItems as line}
											<tr class="border-b border-gray-100">
												<td class="px-2 py-2">{String((line as Record<string, unknown>).name ?? '-')}</td>
												<td class="px-2 py-2">{String((line as Record<string, unknown>).quantity ?? '-')}</td>
												<td class="px-2 py-2">{formatINR(Number((line as Record<string, unknown>).amount ?? 0))}</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
						<JsonViewer value={preview} maxHeight="14rem" />
					</div>
				{/if}
			</SectionCard>
		</div>

		<SectionCard title="Invoices" description="Recent invoices for the selected project with detail drill-down.">
			{#if loading}
				<LoadingSkeleton lines={10} />
			{:else if invoices.length === 0}
				<EmptyState title="No invoices yet" message="Invoices will appear once billing cycles begin." />
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full text-sm">
						<thead>
							<tr class="border-b border-gray-200 text-left text-gray-500">
								<th class="px-2 py-2">Invoice</th>
								<th class="px-2 py-2">Period</th>
								<th class="px-2 py-2">Total</th>
								<th class="px-2 py-2">Status</th>
								<th class="px-2 py-2">Created</th>
							</tr>
						</thead>
						<tbody>
							{#each invoices as invoice}
								<tr class="cursor-pointer border-b border-gray-100 hover:bg-gray-50" onclick={() => openInvoice(invoice)} data-testid={`billing-invoice-${invoice.id}`}>
									<td class="px-2 py-2 font-mono text-xs">{invoice.id}</td>
									<td class="px-2 py-2">{formatDate(invoice.period_start)} → {formatDate(invoice.period_end)}</td>
									<td class="px-2 py-2">{formatINR(invoice.total_amount)}</td>
									<td class="px-2 py-2"><StatusBadge status={invoice.status} /></td>
									<td class="px-2 py-2 text-gray-500">{formatDateTime(invoice.created_at)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</SectionCard>
	{/if}
</div>

<SlideOver open={showInvoiceDetail} title="Invoice Details" onclose={() => (showInvoiceDetail = false)}>
	{#snippet children()}
		{#if selectedInvoice}
			<div class="space-y-3 text-sm">
				<div class="rounded-md bg-gray-50 p-3">
					<div><strong>ID:</strong> <span class="font-mono text-xs">{selectedInvoice.id}</span></div>
					<div><strong>Period:</strong> {formatDate(selectedInvoice.period_start)} → {formatDate(selectedInvoice.period_end)}</div>
					<div><strong>Total:</strong> {formatINR(selectedInvoice.total_amount)}</div>
					<div><strong>Tax:</strong> {formatINR(selectedInvoice.tax_amount)}</div>
				</div>
				<JsonViewer value={selectedInvoice} maxHeight="18rem" />
			</div>
		{/if}
	{/snippet}
</SlideOver>

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
</style>

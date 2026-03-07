<script lang="ts">
	import { Badge, Button } from '$components/ui';
	import { onMount } from 'svelte';

	// DPDP Compliance Score (0-100)
	let complianceScore = $state(72);
	let lastAuditDate = $state('2024-03-01');
	let nextDeadline = $state('2027-05-15');

	// Calculate days until deadline
	let daysUntilDeadline = $state(0);
	
	onMount(() => {
		const deadline = new Date(nextDeadline);
		const today = new Date();
		daysUntilDeadline = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
	});

	// DPDP Section 4: Lawful Processing Requirements
	const lawfulProcessingItems = [
		{ id: 'lp1', name: 'Consent Management System', status: 'completed', section: '4' },
		{ id: 'lp2', name: 'Legitimate Use Documentation', status: 'completed', section: '4' },
		{ id: 'lp3', name: 'State Function Compliance', status: 'pending', section: '4' },
		{ id: 'lp4', name: 'Employment Purpose Tracking', status: 'completed', section: '4' },
	];

	// DPDP Section 6: Consent Management
	const consentItems = [
		{ id: 'c1', name: 'Granular Consent Capture', status: 'completed', section: '6' },
		{ id: 'c2', name: 'Consent Withdrawal Mechanism', status: 'completed', section: '6' },
		{ id: 'c3', name: 'Consent Audit Trail', status: 'completed', section: '6' },
		{ id: 'c4', name: 'Parental Consent for Minors', status: 'pending', section: '6' },
	];

	// DPDP Section 8: Data Quality
	const dataQualityItems = [
		{ id: 'dq1', name: 'Data Accuracy Procedures', status: 'completed', section: '8' },
		{ id: 'dq2', name: 'Data Completeness Checks', status: 'in_progress', section: '8' },
		{ id: 'dq3', name: 'Data Update Mechanisms', status: 'completed', section: '8' },
	];

	// DPDP Section 11: Right to Access
	const accessRightsItems = [
		{ id: 'ar1', name: 'Data Portability Interface', status: 'completed', section: '11' },
		{ id: 'ar2', name: 'Processing Disclosure', status: 'completed', section: '11' },
		{ id: 'ar3', name: 'Identity Verification for Access', status: 'completed', section: '11' },
	];

	// DPDP Section 12: Right to Correction/Erasure
	const correctionItems = [
		{ id: 'ce1', name: 'Data Correction Workflow', status: 'completed', section: '12' },
		{ id: 'ce2', name: 'Data Erasure (Right to be Forgotten)', status: 'completed', section: '12' },
		{ id: 'ce3', name: 'Completion Request Handling', status: 'pending', section: '12' },
	];

	// DPDP Section 17: Data Breach Notification
	const breachItems = [
		{ id: 'bn1', name: 'Breach Detection System', status: 'in_progress', section: '17' },
		{ id: 'bn2', name: 'Board Notification (72 hours)', status: 'pending', section: '17' },
		{ id: 'bn3', name: 'Data Principal Notification', status: 'pending', section: '17' },
	];

	// DPDP Section 9: Children\'s Data Protection
	const childrenItems = [
		{ id: 'cd1', name: 'Age Verification System', status: 'pending', section: '9' },
		{ id: 'cd2', name: 'Parental Consent Workflow', status: 'pending', section: '9' },
		{ id: 'cd3', name: 'Behavioral Monitoring Prohibition', status: 'completed', section: '9' },
	];

	// Data Localization Requirements (RBI/SEBI)
	const localizationItems = [
		{ id: 'dl1', name: 'Financial Data in India', status: 'completed', section: 'RBI' },
		{ id: 'dl2', name: 'Payment Data Localization', status: 'completed', section: 'RBI' },
		{ id: 'dl3', name: 'SEBI Sensitive Data Storage', status: 'in_progress', section: 'SEBI' },
		{ id: 'dl4', name: 'Cross-border Transfer Auditing', status: 'completed', section: 'RBI' },
	];

	// Combine all items
	const allItems = [
		...lawfulProcessingItems,
		...consentItems,
		...dataQualityItems,
		...accessRightsItems,
		...correctionItems,
		...breachItems,
		...childrenItems,
		...localizationItems,
	];

	// Quick Actions
	const quickActions = [
		{
			id: 'erasure',
			title: 'Data Erasure Requests',
			description: 'Process right to be forgotten requests',
			icon: '🗑️',
			count: 3,
			color: 'red'
		},
		{
			id: 'consent',
			title: 'Consent Management',
			description: 'Review and manage user consents',
			icon: '✅',
			count: 15234,
			color: 'blue'
		},
		{
			id: 'breach',
			title: 'Breach Notifications',
			description: 'Report and track data breaches',
			icon: '🚨',
			count: 0,
			color: 'orange'
		},
		{
			id: 'audit',
			title: 'Audit Log Export',
			description: 'Export compliance audit logs',
			icon: '📋',
			count: null,
			color: 'green'
		}
	];

	function getStatusColor(status: string): 'green' | 'yellow' | 'gray' {
		switch (status) {
			case 'completed':
				return 'green';
			case 'in_progress':
				return 'yellow';
			case 'pending':
				return 'gray';
			default:
				return 'gray';
		}
	}

	function getStatusLabel(status: string): string {
		switch (status) {
			case 'completed':
				return 'Completed';
			case 'in_progress':
				return 'In Progress';
			case 'pending':
				return 'Pending';
			default:
				return status;
		}
	}

	function getScoreColor(score: number): string {
		if (score >= 80) return 'text-green-600';
		if (score >= 60) return 'text-yellow-600';
		return 'text-red-600';
	}

	function getScoreBg(score: number): string {
		if (score >= 80) return 'bg-green-100';
		if (score >= 60) return 'bg-yellow-100';
		return 'bg-red-100';
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-gray-900">DPDP Compliance Center</h1>
			<p class="text-sm text-gray-500 mt-1">
				Digital Personal Data Protection Act, 2023 Compliance Dashboard
			</p>
		</div>
		<div class="flex items-center gap-3">
			<span class="text-sm text-gray-500">Last Audit: {lastAuditDate}</span>
			<Button variant="secondary" size="sm">Export Report</Button>
		</div>
	</div>

	<!-- Deadline Warning -->
	{#if daysUntilDeadline < 365}
		<div class="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-center gap-3">
			<span class="text-2xl">⚠️</span>
			<div class="flex-1">
				<h3 class="font-semibold text-orange-900">Compliance Deadline Approaching</h3>
				<p class="text-sm text-orange-700">
					Full DPDP compliance required by May 15, 2027. 
					<span class="font-semibold">{daysUntilDeadline} days remaining.</span>
				</p>
			</div>
			<Button variant="primary" size="sm">View Action Plan</Button>
		</div>
	{/if}

	<!-- Compliance Score Card -->
	<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
		<div class="md:col-span-1">
			<div class="bg-white rounded-lg border border-gray-200 p-6 text-center">
				<div class="text-sm font-medium text-gray-500 mb-2">Compliance Score</div>
				<div class="text-5xl font-bold {getScoreColor(complianceScore)} mb-2">
					{complianceScore}%
				</div>
				<div class="w-full bg-gray-200 rounded-full h-2 mb-2">
					<div 
						class="h-2 rounded-full transition-all duration-500 {complianceScore >= 80 ? 'bg-green-500' : complianceScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'}"
						style="width: {complianceScore}%"
					></div>
				</div>
				<div class="text-xs text-gray-500">
					{allItems.filter(i => i.status === 'completed').length} of {allItems.length} requirements met
				</div>
			</div>
		</div>

		<!-- Quick Stats -->
		<div class="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
			<div class="bg-white rounded-lg border border-gray-200 p-4">
				<div class="text-2xl font-bold text-green-600">
					{allItems.filter(i => i.status === 'completed').length}
				</div>
				<div class="text-sm text-gray-500">Completed</div>
			</div>
			<div class="bg-white rounded-lg border border-gray-200 p-4">
				<div class="text-2xl font-bold text-yellow-600">
					{allItems.filter(i => i.status === 'in_progress').length}
				</div>
				<div class="text-sm text-gray-500">In Progress</div>
			</div>
			<div class="bg-white rounded-lg border border-gray-200 p-4">
				<div class="text-2xl font-bold text-gray-600">
					{allItems.filter(i => i.status === 'pending').length}
				</div>
				<div class="text-sm text-gray-500">Pending</div>
			</div>
			<div class="bg-white rounded-lg border border-gray-200 p-4">
				<div class="text-2xl font-bold text-blue-600">8</div>
				<div class="text-sm text-gray-500">DPDP Sections</div>
			</div>
		</div>
	</div>

	<!-- Quick Actions Grid -->
	<div>
		<h2 class="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
		<div class="grid grid-cols-1 md:grid-cols-4 gap-4">
			{#each quickActions as action}
				<button class="bg-white border border-gray-200 rounded-lg p-4 text-left hover:border-blue-400 hover:shadow-md transition-all group">
					<div class="flex items-start justify-between mb-2">
						<span class="text-2xl">{action.icon}</span>
						{#if action.count !== null}
							<Badge variant={action.count > 0 ? 'red' : 'green'}>
								{action.count}
							</Badge>
						{/if}
					</div>
					<h3 class="font-semibold text-gray-900 group-hover:text-blue-600">{action.title}</h3>
					<p class="text-sm text-gray-500 mt-1">{action.description}</p>
				</button>
			{/each}
		</div>
	</div>

	<!-- DPDP Requirements Checklist -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Section 4: Lawful Processing -->
		<div class="bg-white rounded-lg border border-gray-200 p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="font-semibold text-gray-900">Section 4: Lawful Processing</h3>
				<Badge variant={lawfulProcessingItems.every(i => i.status === 'completed') ? 'green' : 'yellow'}>
					{lawfulProcessingItems.filter(i => i.status === 'completed').length}/{lawfulProcessingItems.length}
				</Badge>
			</div>
			<div class="space-y-2">
				{#each lawfulProcessingItems as item}
					<div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
						<span class="text-sm text-gray-700">{item.name}</span>
						<Badge variant={getStatusColor(item.status)} size="sm">
							{getStatusLabel(item.status)}
						</Badge>
					</div>
				{/each}
			</div>
		</div>

		<!-- Section 6: Consent -->
		<div class="bg-white rounded-lg border border-gray-200 p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="font-semibold text-gray-900">Section 6: Consent Management</h3>
				<Badge variant={consentItems.every(i => i.status === 'completed') ? 'green' : 'yellow'}>
					{consentItems.filter(i => i.status === 'completed').length}/{consentItems.length}
				</Badge>
			</div>
			<div class="space-y-2">
				{#each consentItems as item}
					<div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
						<span class="text-sm text-gray-700">{item.name}</span>
						<Badge variant={getStatusColor(item.status)} size="sm">
							{getStatusLabel(item.status)}
						</Badge>
					</div>
				{/each}
			</div>
		</div>

		<!-- Section 8: Data Quality -->
		<div class="bg-white rounded-lg border border-gray-200 p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="font-semibold text-gray-900">Section 8: Data Quality</h3>
				<Badge variant={dataQualityItems.every(i => i.status === 'completed') ? 'green' : 'yellow'}>
					{dataQualityItems.filter(i => i.status === 'completed').length}/{dataQualityItems.length}
				</Badge>
			</div>
			<div class="space-y-2">
				{#each dataQualityItems as item}
					<div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
						<span class="text-sm text-gray-700">{item.name}</span>
						<Badge variant={getStatusColor(item.status)} size="sm">
							{getStatusLabel(item.status)}
						</Badge>
					</div>
				{/each}
			</div>
		</div>

		<!-- Section 11: Right to Access -->
		<div class="bg-white rounded-lg border border-gray-200 p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="font-semibold text-gray-900">Section 11: Right to Access</h3>
				<Badge variant={accessRightsItems.every(i => i.status === 'completed') ? 'green' : 'yellow'}>
					{accessRightsItems.filter(i => i.status === 'completed').length}/{accessRightsItems.length}
				</Badge>
			</div>
			<div class="space-y-2">
				{#each accessRightsItems as item}
					<div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
						<span class="text-sm text-gray-700">{item.name}</span>
						<Badge variant={getStatusColor(item.status)} size="sm">
							{getStatusLabel(item.status)}
						</Badge>
					</div>
				{/each}
			</div>
		</div>

		<!-- Section 12: Correction/Erasure -->
		<div class="bg-white rounded-lg border border-gray-200 p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="font-semibold text-gray-900">Section 12: Right to Correction/Erasure</h3>
				<Badge variant={correctionItems.every(i => i.status === 'completed') ? 'green' : 'yellow'}>
					{correctionItems.filter(i => i.status === 'completed').length}/{correctionItems.length}
				</Badge>
			</div>
			<div class="space-y-2">
				{#each correctionItems as item}
					<div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
						<span class="text-sm text-gray-700">{item.name}</span>
						<Badge variant={getStatusColor(item.status)} size="sm">
							{getStatusLabel(item.status)}
						</Badge>
					</div>
				{/each}
			</div>
		</div>

		<!-- Section 17: Breach Notification -->
		<div class="bg-white rounded-lg border border-gray-200 p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="font-semibold text-gray-900">Section 17: Data Breach Notification</h3>
				<Badge variant={breachItems.every(i => i.status === 'completed') ? 'green' : 'red'}>
					{breachItems.filter(i => i.status === 'completed').length}/{breachItems.length}
				</Badge>
			</div>
			<div class="space-y-2">
				{#each breachItems as item}
					<div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
						<span class="text-sm text-gray-700">{item.name}</span>
						<Badge variant={getStatusColor(item.status)} size="sm">
							{getStatusLabel(item.status)}
						</Badge>
					</div>
				{/each}
			</div>
		</div>

		<!-- Section 9: Children's Data -->
		<div class="bg-white rounded-lg border border-gray-200 p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="font-semibold text-gray-900">Section 9: Children's Data Protection</h3>
				<Badge variant={childrenItems.every(i => i.status === 'completed') ? 'green' : 'yellow'}>
					{childrenItems.filter(i => i.status === 'completed').length}/{childrenItems.length}
				</Badge>
			</div>
			<div class="space-y-2">
				{#each childrenItems as item}
					<div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
						<span class="text-sm text-gray-700">{item.name}</span>
						<Badge variant={getStatusColor(item.status)} size="sm">
							{getStatusLabel(item.status)}
						</Badge>
					</div>
				{/each}
			</div>
		</div>

		<!-- Data Localization (RBI/SEBI) -->
		<div class="bg-white rounded-lg border border-gray-200 p-6">
			<div class="flex items-center justify-between mb-4">
				<h3 class="font-semibold text-gray-900">Data Localization (RBI/SEBI Mandate)</h3>
				<Badge variant={localizationItems.every(i => i.status === 'completed') ? 'green' : 'yellow'}>
					{localizationItems.filter(i => i.status === 'completed').length}/{localizationItems.length}
				</Badge>
			</div>
			<div class="space-y-2">
				{#each localizationItems as item}
					<div class="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
						<div class="flex items-center gap-2">
							<span class="text-sm text-gray-700">{item.name}</span>
							<Badge variant="gray" size="sm">{item.section}</Badge>
						</div>
						<Badge variant={getStatusColor(item.status)} size="sm">
							{getStatusLabel(item.status)}
						</Badge>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Compliance Resources -->
	<div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
		<h3 class="font-semibold text-blue-900 mb-2">DPDP Compliance Resources</h3>
		<div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
			<a href="https://www.meity.gov.in/data-protection-framework" target="_blank" class="text-blue-700 hover:underline">
				📄 Official DPDP Act, 2023
			</a>
			<a href="https://www.meity.gov.in/writereaddata/files/DPDP_Rules_2024.pdf" target="_blank" class="text-blue-700 hover:underline">
				📄 DPDP Rules, 2024
			</a>
			<a href="https://www.digitalpersonaldataprotection.in/" target="_blank" class="text-blue-700 hover:underline">
				ℹ️ Data Protection Board of India
			</a>
		</div>
	</div>
</div>

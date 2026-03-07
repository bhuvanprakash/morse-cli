<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Button, Badge } from '$components/ui';
	import { realtimeClient, type RealtimeMessage } from '$api/realtime';
	import { auth } from '$stores/auth';

	interface EventLog {
		id: string;
		timestamp: Date;
		message: RealtimeMessage;
	}

	let events = $state<EventLog[]>([]);
	let isConnected = $state(false);
	let selectedTopic = $state('public:users:*');
	let subscriptionId = $state<string | null>(null);

	const topics = [
		'public:users:*',
		'public:orders:*',
		'public:products:*',
		'*:*:*'
	];

	function handleRealtimeMessage(message: RealtimeMessage) {
		events = [{
			id: `${Date.now()}_${Math.random()}`,
			timestamp: new Date(),
			message
		}, ...events].slice(0, 100);
	}

	function connect() {
		if (subscriptionId) {
			realtimeClient.unsubscribe(subscriptionId);
			subscriptionId = null;
		}
		realtimeClient.connect(auth.accessToken || undefined);
		subscriptionId = realtimeClient.subscribe(selectedTopic, handleRealtimeMessage);
	}

	function disconnect() {
		if (subscriptionId) {
			realtimeClient.unsubscribe(subscriptionId);
			subscriptionId = null;
		}
		realtimeClient.disconnect();
	}

	function clearEvents() {
		events = [];
	}

	function getEventColor(action: string): 'success' | 'primary' | 'danger' | 'default' {
		switch (action) {
			case 'INSERT': return 'success';
			case 'UPDATE': return 'primary';
			case 'DELETE': return 'danger';
			default: return 'default';
		}
	}

	onMount(() => {
		realtimeClient.onConnect = () => {
			isConnected = true;
		};
		realtimeClient.onDisconnect = () => {
			isConnected = false;
		};
		realtimeClient.onError = () => {
			isConnected = false;
		};
		connect();

		return () => {
			realtimeClient.onConnect = undefined;
			realtimeClient.onDisconnect = undefined;
			realtimeClient.onError = undefined;
		};
	});

	onDestroy(() => {
		disconnect();
	});
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-surface-12">Realtime</h1>
			<p class="text-surface-10 mt-1">Live feed of database changes</p>
		</div>
		<div class="flex items-center gap-2">
			<div class="flex items-center gap-2 mr-4">
				<span class="w-2 h-2 rounded-full {isConnected ? 'bg-green-500' : 'bg-red-500'}"></span>
				<span class="text-sm text-surface-10">{isConnected ? 'Connected' : 'Disconnected'}</span>
			</div>
			<select
				bind:value={selectedTopic}
				class="px-3 py-2 bg-surface-2 border border-surface-6 rounded-md text-sm"
				onchange={() => { disconnect(); connect(); }}
			>
				{#each topics as topic}
					<option value={topic}>{topic}</option>
				{/each}
			</select>
			<Button variant="secondary" size="sm" onclick={clearEvents}>Clear</Button>
		</div>
	</div>

	<!-- Events Feed -->
	<div class="bg-surface-2 rounded-lg border border-surface-6 overflow-hidden">
		<div class="px-4 py-2 bg-surface-3 border-b border-surface-6">
			<span class="text-sm font-medium text-surface-12">
				Events ({events.length})
			</span>
		</div>
		<div class="divide-y divide-surface-6 max-h-[600px] overflow-auto">
			{#if events.length === 0}
				<div class="p-8 text-center text-surface-10">
					<p>No events yet. Waiting for database changes...</p>
				</div>
			{:else}
				{#each events as event}
					<div class="p-4 hover:bg-surface-1 transition-colors">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								<Badge variant={getEventColor(event.message.action)}>
									{event.message.action}
								</Badge>
								<span class="text-surface-12 font-medium">
									{event.message.schema}.{event.message.table}
								</span>
							</div>
							<span class="text-xs text-surface-10">
								{event.timestamp.toLocaleTimeString()}
							</span>
						</div>
						{#if event.message.record}
							<div class="mt-2 p-2 bg-surface-1 rounded text-xs font-mono text-surface-11 overflow-x-auto">
								<pre>{JSON.stringify(event.message.record, null, 2)}</pre>
							</div>
						{/if}
					</div>
				{/each}
			{/if}
		</div>
	</div>
</div>

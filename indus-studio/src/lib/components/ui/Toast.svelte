<script lang="ts">
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';

	interface Props {
		id: string;
		message: string;
		type?: 'success' | 'error' | 'loading' | 'info' | 'custom';
		duration?: number;
		icon?: string;
		onDismiss?: (id: string) => void;
	}

	let { id, message, type = 'info', duration = 3000, icon, onDismiss }: Props = $props();

	let progress = $state(100);
	let interval: ReturnType<typeof setInterval> | undefined;

	function clearTimer() {
		if (interval) {
			clearInterval(interval);
			interval = undefined;
		}
	}

	function startTimer() {
		if (type === 'loading' || duration <= 0) return;
		const remaining = Math.max(duration * (progress / 100), 50);
		const step = 100 / (remaining / 50);
		clearTimer();
		interval = setInterval(() => {
			progress = Math.max(0, progress - step);
			if (progress <= 0) {
				clearTimer();
				onDismiss?.(id);
			}
		}, 50);
	}

	onMount(() => {
		startTimer();
		return () => clearTimer();
	});

	const typeClasses = {
		success: 'bg-green-9 text-white border-green-8',
		error: 'bg-red-9 text-white border-red-8',
		loading: 'bg-blue-9 text-white border-blue-8',
		info: 'bg-surface-4 text-surface-12 border-surface-6',
		custom: 'bg-accent-9 text-white border-accent-8'
	};

	const icons = {
		success: '✓',
		error: '✕',
		loading: '◌',
		info: 'ℹ',
		custom: '•'
	};
</script>

<div
	class="relative flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border {typeClasses[type]} min-w-[300px] max-w-[400px]"
	transition:fly={{ x: 100, duration: 300 }}
	role="status"
	aria-live={type === 'error' ? 'assertive' : 'polite'}
	onmouseenter={clearTimer}
	onmouseleave={startTimer}
>
	<span class="text-lg font-bold">{icon ?? icons[type]}</span>
	<p class="flex-1 text-sm">{message}</p>
	<button
		type="button"
		class="text-current opacity-60 hover:opacity-100 transition-opacity"
		onclick={() => onDismiss?.(id)}
	>
		✕
	</button>
	{#if type !== 'loading' && duration > 0}
		<div
			class="absolute bottom-0 left-0 h-0.5 bg-white/50 transition-all duration-100"
			style="width: {progress}%"
		></div>
	{/if}
</div>

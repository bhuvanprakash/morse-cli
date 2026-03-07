<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { onMount } from 'svelte';

	interface Props {
		open?: boolean;
		children?: import('svelte').Snippet;
		onclose?: () => void;
	}

	let { open = false, children, onclose }: Props = $props();

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onclose?.();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && open) {
			onclose?.();
		}
	}

	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
		return () => document.removeEventListener('keydown', handleKeydown);
	});

	$effect(() => {
		if (open) {
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = '';
		}
	});
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		transition:fade={{ duration: 200 }}
	>
		<button
			type="button"
			class="absolute inset-0 bg-black/50 backdrop-blur-sm"
			aria-label="Close modal"
			onclick={handleBackdropClick}
		></button>
		<div
			class="relative bg-surface-1 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto"
			transition:fly={{ y: 20, duration: 300 }}
		>
			{@render children?.()}
		</div>
	</div>
{/if}

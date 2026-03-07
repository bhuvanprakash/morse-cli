<script lang="ts" module>
	export interface DropdownItem {
		label?: string;
		value?: string;
		href?: string;
		disabled?: boolean;
		divider?: boolean;
		onClick?: () => void;
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		items: DropdownItem[];
		children?: import('svelte').Snippet;
		align?: 'left' | 'right';
	}

	let { items, children, align = 'left' }: Props = $props();

	let isOpen = $state(false);
	let buttonRef = $state<HTMLButtonElement | null>(null);
	let menuRef = $state<HTMLDivElement | null>(null);

	function toggle() {
		isOpen = !isOpen;
	}

	function close() {
		isOpen = false;
	}

	function handleClickOutside(event: MouseEvent) {
		if (
			menuRef &&
			buttonRef &&
			!menuRef.contains(event.target as Node) &&
			!buttonRef.contains(event.target as Node)
		) {
			close();
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			close();
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		document.addEventListener('keydown', handleKeydown);
		return () => {
			document.removeEventListener('click', handleClickOutside);
			document.removeEventListener('keydown', handleKeydown);
		};
	});

	function handleItemClick(item: DropdownItem) {
		if (item.disabled || item.divider) return;
		item.onClick?.();
		close();
	}

	const alignClasses = {
		left: 'left-0',
		right: 'right-0'
	};
</script>

<div class="relative inline-block">
	<button
		bind:this={buttonRef}
		onclick={toggle}
		class="inline-flex items-center gap-1"
		aria-expanded={isOpen}
		aria-haspopup="true"
	>
		{@render children?.()}
		<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if isOpen}
		<div
			bind:this={menuRef}
			class="absolute z-50 mt-1 w-48 rounded-md bg-surface-1 shadow-lg ring-1 ring-black ring-opacity-5 {alignClasses[align]}"
		>
			<div class="py-1" role="menu">
				{#each items as item}
					{#if item.divider}
						<div class="my-1 border-t border-surface-6"></div>
					{:else if item.href}
						<a
							href={item.href}
							class="block px-4 py-2 text-sm text-surface-12 hover:bg-surface-3 {item.disabled ? 'opacity-50 cursor-not-allowed' : ''}"
							role="menuitem"
							onclick={() => handleItemClick(item)}
						>
							{item.label}
						</a>
					{:else}
						<button
							class="block w-full text-left px-4 py-2 text-sm text-surface-12 hover:bg-surface-3 {item.disabled ? 'opacity-50 cursor-not-allowed' : ''}"
							role="menuitem"
							onclick={() => handleItemClick(item)}
						>
							{item.label}
						</button>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>

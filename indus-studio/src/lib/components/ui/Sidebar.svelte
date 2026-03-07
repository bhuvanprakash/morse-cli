<script lang="ts" module>
	export interface SidebarItem {
		label: string;
		href?: string;
		icon?: string;
		active?: boolean;
		children?: SidebarItem[];
		badge?: string;
	}
</script>

<script lang="ts">
	import { slide } from 'svelte/transition';

	interface Props {
		items: SidebarItem[];
		collapsed?: boolean;
	}

	let { items, collapsed = false }: Props = $props();

	let expandedItems = $state<Set<string>>(new Set());

	$effect(() => {
		for (const item of items) {
			if (item.children?.some((child) => child.active)) {
				expandedItems.add(item.label);
			}
		}
		expandedItems = new Set(expandedItems);
	});

	function toggleItem(label: string) {
		if (expandedItems.has(label)) {
			expandedItems.delete(label);
		} else {
			expandedItems.add(label);
		}
		expandedItems = new Set(expandedItems);
	}

	function isExpanded(label: string): boolean {
		return expandedItems.has(label);
	}
</script>

<aside class="h-full bg-surface-2 border-r border-surface-6 flex flex-col {collapsed ? 'w-16' : 'w-72'} transition-all duration-200">
	<div class="border-b border-surface-6 px-4 py-4">
		<div class="flex items-center gap-3 rounded-xl bg-surface-1 px-3 py-3">
			<div class="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-9 text-base font-bold text-white">IB</div>
			{#if !collapsed}
				<div class="min-w-0">
					<div class="truncate text-sm font-semibold text-surface-12">Indus Studio</div>
					<div class="truncate text-xs text-surface-10">Premium control plane</div>
				</div>
			{/if}
		</div>
	</div>
	<nav class="flex-1 py-4 overflow-y-auto">
		<ul class="space-y-1 px-2">
			{#each items as item}
				<li>
					{#if item.children && item.children.length > 0}
						<button
							class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium text-surface-10 hover:bg-surface-3 hover:text-surface-12 transition-colors"
							onclick={() => toggleItem(item.label)}
						>
							{#if item.icon}
								<span class="w-5 h-5 flex items-center justify-center">{item.icon}</span>
							{/if}
							{#if !collapsed}
								<span class="flex-1 text-left uppercase tracking-[0.14em] text-[11px]">{item.label}</span>
								<svg
									class="w-4 h-4 transition-transform {isExpanded(item.label) ? 'rotate-180' : ''}"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								</svg>
							{/if}
						</button>
						{#if isExpanded(item.label) && !collapsed}
							<ul class="mt-1 ml-4 space-y-1" transition:slide={{ duration: 200 }}>
								{#each item.children as child}
									<li>
										<a
											href={child.href || '#'}
											class="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-surface-11 hover:bg-surface-3 hover:text-surface-12 transition-colors {child.active ? 'bg-accent-3 text-accent-11 shadow-sm' : ''}"
											data-testid={child.href ? `nav-${child.href.replaceAll('/', '-').replace(/^-/, '')}` : undefined}
										>
											{#if child.icon}
												<span class="w-5 h-5 flex items-center justify-center">{child.icon}</span>
											{/if}
											<span class="flex-1">{child.label}</span>
											{#if child.badge}
												<span class="px-2 py-0.5 text-xs bg-accent-9 text-white rounded-full">{child.badge}</span>
											{/if}
										</a>
									</li>
								{/each}
							</ul>
						{/if}
					{:else}
						<a
							href={item.href || '#'}
							class="flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-colors {item.active ? 'bg-accent-3 text-accent-11 shadow-sm' : 'text-surface-11 hover:bg-surface-3 hover:text-surface-12'}"
							data-testid={item.href ? `nav-${item.href.replaceAll('/', '-').replace(/^-/, '')}` : undefined}
						>
							{#if item.icon}
								<span class="w-5 h-5 flex items-center justify-center">{item.icon}</span>
							{/if}
							{#if !collapsed}
								<span class="flex-1">{item.label}</span>
								{#if item.badge}
									<span class="px-2 py-0.5 text-xs bg-accent-9 text-white rounded-full">{item.badge}</span>
								{/if}
							{/if}
						</a>
					{/if}
				</li>
			{/each}
		</ul>
	</nav>
</aside>

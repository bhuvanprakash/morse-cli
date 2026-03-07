<script lang="ts">
	import { onMount } from 'svelte';
	import { commandPaletteStore } from '$lib/stores/commandPalette';
	import { contextStore } from '$lib/stores/context';
	let inputEl = $state<HTMLInputElement | null>(null);
	const filtered = $derived(commandPaletteStore.filtered);
	const grouped = $derived.by(() => {
		const order = ['Navigate', 'Projects', 'Environment', 'Actions', 'Docs'];
		return order
			.map((group) => ({
				group,
				items: filtered.filter((item) => item.group === group)
			}))
			.filter((entry) => entry.items.length > 0);
	});

	function closePalette() {
		commandPaletteStore.hide();
	}

	function openPalette() {
		void contextStore.ensureLoaded();
		commandPaletteStore.show();
		setTimeout(() => inputEl?.focus(), 0);
	}

	function onKeydown(event: KeyboardEvent) {
		const isPaletteShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
		if (isPaletteShortcut) {
			event.preventDefault();
			if (commandPaletteStore.open) closePalette();
			else openPalette();
			return;
		}

		if (!commandPaletteStore.open) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			closePalette();
			return;
		}
		if (event.key === 'ArrowDown') {
			event.preventDefault();
			commandPaletteStore.move(1);
			return;
		}
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			commandPaletteStore.move(-1);
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			const target = filtered[commandPaletteStore.selectedIndex];
			if (target) void commandPaletteStore.execute(target);
		}
	}

	onMount(() => {
		document.addEventListener('keydown', onKeydown);
		return () => document.removeEventListener('keydown', onKeydown);
	});
</script>

<button type="button" class="palette-trigger" onclick={openPalette} aria-label="Open command palette" data-testid="command-palette-trigger">
	<span>⌘K</span>
	<small>Search</small>
</button>

{#if commandPaletteStore.open}
	<div class="overlay" role="button" tabindex="0" onclick={(event) => event.currentTarget === event.target && closePalette()} onkeydown={(event) => (event.key === 'Escape' || event.key === 'Enter') && closePalette()}>
		<div class="palette" role="dialog" aria-modal="true" aria-label="Command palette">
			<input
				bind:this={inputEl}
				bind:value={commandPaletteStore.query}
				placeholder="Search pages, projects, and quick actions..."
				aria-label="Search commands"
				data-testid="command-palette-input"
			/>
			<div class="results">
				{#if grouped.length === 0}
					<div class="empty">No matching commands</div>
				{:else}
					{#each grouped as section}
						<div class="group">
							<div class="group-label">{section.group}</div>
							{#each section.items as command (command.id)}
								<button
									type="button"
									class:selected={filtered[commandPaletteStore.selectedIndex]?.id === command.id}
									onmouseenter={() => {
										const idx = filtered.findIndex((item) => item.id === command.id);
										commandPaletteStore.selectedIndex = idx >= 0 ? idx : 0;
									}}
									onclick={() => void commandPaletteStore.execute(command)}
								>
									<strong>{command.label}</strong>
									<small>{command.description}</small>
								</button>
							{/each}
						</div>
					{/each}
				{/if}
			</div>
			<div class="footer">
				<span>{contextStore.activeProject?.name || 'No active project'}</span>
				<span>{contextStore.environment}</span>
			</div>
		</div>
	</div>
{/if}

<style>
	.palette-trigger {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		border: 1px solid var(--surface-6);
		background: var(--surface-2);
		color: var(--surface-11);
		border-radius: 0.8rem;
		font-size: 0.74rem;
		padding: 0.45rem 0.6rem;
		cursor: pointer;
	}
	.palette-trigger small {
		color: var(--surface-10);
	}
	.overlay {
		position: fixed;
		inset: 0;
		background: rgba(2, 6, 23, 0.55);
		display: grid;
		place-items: start center;
		padding: 12vh 1rem 1rem;
		z-index: 70;
	}
	.palette {
		width: min(720px, 100%);
		background: var(--surface-1);
		border: 1px solid var(--surface-6);
		border-radius: 0.95rem;
		box-shadow: 0 20px 40px rgba(2, 6, 23, 0.4);
		overflow: hidden;
	}
	.palette input {
		width: 100%;
		border: none;
		border-bottom: 1px solid var(--surface-6);
		background: var(--surface-2);
		color: var(--surface-12);
		padding: 0.85rem 0.9rem;
	}
	.results {
		max-height: 420px;
		overflow: auto;
		display: flex;
		flex-direction: column;
		padding: 0.35rem;
		gap: 0.55rem;
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.group-label {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.16em;
		color: var(--surface-10);
		padding: 0.35rem 0.55rem 0.15rem;
	}
	.results button {
		border: none;
		background: transparent;
		color: inherit;
		padding: 0.7rem 0.9rem;
		text-align: left;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		cursor: pointer;
	}
	.results button:hover,
	.results button.selected {
		background: rgba(251, 146, 60, 0.16);
	}
	.results strong {
		font-size: 0.92rem;
		color: var(--surface-12);
	}
	.results small {
		color: var(--surface-10);
		font-size: 0.78rem;
	}
	.empty {
		padding: 0.95rem;
		color: var(--surface-10);
	}
	.footer {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.7rem 0.9rem;
		border-top: 1px solid var(--surface-6);
		font-size: 0.75rem;
		color: var(--surface-10);
		background: var(--surface-2);
	}
</style>

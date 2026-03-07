<script lang="ts">
	import NavSidebar from './NavSidebar.svelte';
	import Header from './Header.svelte';

	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="min-h-screen bg-surface-1 flex">
	<!-- Sidebar -->
	<div class="sticky top-0 hidden h-screen xl:block">
		<NavSidebar />
	</div>

	<!-- Main content area -->
	<div class="flex-1 flex flex-col min-w-0">
		<Header />
		
		<main class="flex-1 overflow-auto p-5 lg:p-6 xl:p-8">
			{@render children?.()}
		</main>
	</div>
</div>

<script lang="ts">
	import { onMount } from 'svelte';
	import ToastViewport from '$components/ui/ToastViewport.svelte';
	import ConfirmDialog from '$lib/components/studio/ConfirmDialog.svelte';
	import { auth } from '$stores/auth';
	import '../app.css';

	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();

	onMount(() => {
		auth.loadFromStorage();
	});
</script>

<ToastViewport />
<ConfirmDialog />

{@render children?.()}

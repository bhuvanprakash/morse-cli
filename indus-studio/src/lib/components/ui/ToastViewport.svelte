<script lang="ts">
	import { toastState, toastStore } from '$stores/toast';
	import Toast from './Toast.svelte';

	const positionClasses = {
		'top-left': 'top-4 left-4 items-start',
		'top-center': 'top-4 left-1/2 -translate-x-1/2 items-center',
		'top-right': 'top-4 right-4 items-end',
		'bottom-left': 'bottom-4 left-4 items-start',
		'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2 items-center',
		'bottom-right': 'bottom-4 right-4 items-end'
	} as const;

	const positions = Object.keys(positionClasses) as Array<keyof typeof positionClasses>;
</script>

{#each positions as position}
	{@const items = $toastState.filter((toast) => toast.position === position)}
	{#if items.length > 0}
		<div class="fixed z-[100] flex w-full max-w-md flex-col gap-3 pointer-events-none {positionClasses[position]}">
			{#each items as toast (toast.id)}
				<div class="pointer-events-auto">
					<Toast
						id={toast.id}
						message={toast.message}
						type={toast.type}
						duration={toast.duration}
						icon={toast.icon}
						onDismiss={toastStore.dismiss}
					/>
				</div>
			{/each}
		</div>
	{/if}
{/each}

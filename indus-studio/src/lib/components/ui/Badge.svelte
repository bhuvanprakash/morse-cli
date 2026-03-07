<script lang="ts">
	type Variant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'green' | 'red' | 'yellow' | 'blue' | 'gray';
	interface Props {
		variant?: Variant;
		size?: 'sm' | 'md';
		children?: import('svelte').Snippet;
	}

	let { variant = 'default', size = 'md', children }: Props = $props();

	const variantClasses: Record<Variant, string> = {
		default: 'bg-surface-4 text-surface-12',
		primary: 'bg-accent-9 text-white',
		success: 'bg-green-9 text-white',
		warning: 'bg-amber-9 text-white',
		danger: 'bg-red-9 text-white',
		info: 'bg-blue-9 text-white',
		green: 'bg-green-9 text-white',
		red: 'bg-red-9 text-white',
		yellow: 'bg-amber-9 text-white',
		blue: 'bg-blue-9 text-white',
		gray: 'bg-surface-6 text-surface-12'
	};

	const sizeClasses = {
		sm: 'px-2 py-0.5 text-xs',
		md: 'px-2.5 py-1 text-sm'
	};
</script>

<span class="inline-flex items-center rounded-full font-medium {variantClasses[variant]} {sizeClasses[size]}">
	{@render children?.()}
</span>

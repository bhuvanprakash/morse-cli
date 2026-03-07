<script lang="ts">
	interface Props {
		type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'url';
		label?: string;
		placeholder?: string;
		value?: string;
		error?: string;
		disabled?: boolean;
		required?: boolean;
		readonly?: boolean;
		id?: string;
		class?: string;
		oninput?: (e: Event) => void;
		onchange?: (e: Event) => void;
		onblur?: (e: Event) => void;
	}

	let {
		type = 'text',
		label,
		placeholder,
		value = $bindable(''),
		error,
		disabled = false,
		required = false,
		readonly = false,
		id,
		class: className = '',
		oninput,
		onchange,
		onblur
	}: Props = $props();

	const generatedId = `input-${Math.random().toString(36).slice(2, 11)}`;
	const inputId = $derived(id ?? generatedId);
</script>

<div class="w-full">
	{#if label}
		<label for={inputId} class="block text-sm font-medium text-surface-12 mb-1">
			{label}
			{#if required}
				<span class="text-red-9">*</span>
			{/if}
		</label>
	{/if}
	<input
		id={inputId}
		{type}
		{placeholder}
		{disabled}
		{required}
		{readonly}
		bind:value
		oninput={oninput}
		onchange={onchange}
		onblur={onblur}
		class="w-full px-3 py-2 bg-surface-2 border border-surface-6 rounded-md text-surface-12 placeholder:text-surface-10 focus:outline-none focus:ring-2 focus:ring-accent-7 focus:border-accent-8 disabled:opacity-50 disabled:cursor-not-allowed transition-colors {error ? 'border-red-9 focus:ring-red-7 focus:border-red-8' : ''} {className}"
	/>
	{#if error}
		<p class="mt-1 text-sm text-red-9">{error}</p>
	{/if}
</div>

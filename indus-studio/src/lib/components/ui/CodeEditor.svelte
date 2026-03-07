<script lang="ts">
	interface Props {
		value?: string;
		language?: 'sql' | 'javascript' | 'typescript' | 'json' | 'yaml';
		readonly?: boolean;
		placeholder?: string;
		onChange?: (value: string) => void;
	}

	let { 
		value = $bindable(''), 
		language = 'sql', 
		readonly = false,
		placeholder = '',
		onChange
	}: Props = $props();

	let textareaRef: HTMLTextAreaElement;

	function handleInput(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		value = target.value;
		onChange?.(value);
	}

	function handleKeydown(e: KeyboardEvent) {
		// Tab support
		if (e.key === 'Tab' && !e.shiftKey) {
			e.preventDefault();
			const start = textareaRef.selectionStart;
			const end = textareaRef.selectionEnd;
			value = value.substring(0, start) + '  ' + value.substring(end);
			textareaRef.selectionStart = textareaRef.selectionEnd = start + 2;
			onChange?.(value);
		}

		// Ctrl/Cmd + Enter to submit
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			// Dispatch submit event
			textareaRef.dispatchEvent(new CustomEvent('submit', { bubbles: true }));
		}
	}

	const languageLabels: Record<string, string> = {
		sql: 'SQL',
		javascript: 'JavaScript',
		typescript: 'TypeScript',
		json: 'JSON',
		yaml: 'YAML'
	};
</script>

<div class="border border-surface-6 rounded-lg overflow-hidden bg-surface-1">
	<div class="flex items-center justify-between px-4 py-2 bg-surface-2 border-b border-surface-6">
		<span class="text-xs font-medium text-surface-11 uppercase">{languageLabels[language]}</span>
		<div class="flex items-center gap-2">
			{#if !readonly}
				<span class="text-xs text-surface-10">Tab: indent • Ctrl+Enter: run</span>
			{/if}
		</div>
	</div>
	<div class="relative">
		<textarea
			bind:this={textareaRef}
			{value}
			{readonly}
			{placeholder}
			oninput={handleInput}
			onkeydown={handleKeydown}
			class="w-full h-64 p-4 font-mono text-sm bg-surface-1 text-surface-12 resize-none focus:outline-none {readonly ? 'cursor-text' : ''}"
			spellcheck="false"
			autocomplete="off"
			autocapitalize="off"
		></textarea>
	</div>
</div>

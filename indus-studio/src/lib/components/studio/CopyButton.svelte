<script lang="ts">
  import { toastStore } from '$stores/toast';
  interface Props {
    value: string;
    label?: string;
    successLabel?: string;
    disabled?: boolean;
    testId?: string;
  }
  let { value, label = 'Copy', successLabel = 'Copied', disabled = false, testId = '' }: Props = $props();
  let copied = $state(false);

  async function copy(): Promise<void> {
    if (disabled || !value) return;
    try {
      await navigator.clipboard.writeText(value);
      copied = true;
      toastStore.success('Copied to clipboard');
      setTimeout(() => (copied = false), 1200);
    } catch {
      toastStore.error('Failed to copy');
    }
  }
</script>

<button
  type="button"
  data-testid={testId || undefined}
  onclick={copy}
  disabled={disabled}
  class="rounded-md border border-surface-6 px-2 py-1 text-xs text-surface-11 transition hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-50"
>
  {copied ? successLabel : label}
</button>

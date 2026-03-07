<script lang="ts">
  interface SegmentOption {
    key: string;
    label: string;
  }

  interface Props {
    options: SegmentOption[];
    value: string;
    onChange?: (key: string) => void;
  }

  let { options = [], value = '', onChange }: Props = $props();
</script>

<div class="inline-flex rounded-xl border border-surface-6 bg-surface-2 p-1">
  {#each options as option}
    <button
      type="button"
      class={`rounded-lg px-3 py-1.5 text-sm transition ${
        option.key === value
          ? 'bg-accent-9 text-white shadow-sm'
          : 'text-surface-10 hover:text-surface-12'
      }`}
      onclick={() => onChange?.(option.key)}
    >
      {option.label}
    </button>
  {/each}
</div>

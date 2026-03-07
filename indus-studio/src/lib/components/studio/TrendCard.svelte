<script lang="ts">
  interface Props {
    label: string;
    value: string;
    trend?: string;
    hint?: string;
    tone?: 'default' | 'good' | 'warn' | 'danger';
  }

  let { label, value, trend = '', hint = '', tone = 'default' }: Props = $props();

  const toneClass = $derived.by(() =>
    tone === 'good'
      ? 'text-green-400 bg-green-500/10'
      : tone === 'warn'
        ? 'text-amber-300 bg-amber-500/10'
        : tone === 'danger'
          ? 'text-red-300 bg-red-500/10'
          : 'text-surface-10 bg-surface-3'
  );
</script>

<div class="rounded-2xl border border-surface-6 bg-surface-2 p-4 shadow-sm">
  <p class="text-xs uppercase tracking-[0.18em] text-surface-10">{label}</p>
  <div class="mt-3 flex items-start justify-between gap-3">
    <strong class="text-2xl font-semibold text-surface-12">{value}</strong>
    {#if trend}
      <span class={`rounded-full px-2.5 py-1 text-xs font-medium ${toneClass}`}>{trend}</span>
    {/if}
  </div>
  {#if hint}
    <p class="mt-2 text-sm text-surface-10">{hint}</p>
  {/if}
</div>

<script lang="ts">
  interface Props {
    severity?: string;
  }

  let { severity = 'info' }: Props = $props();

  const normalized = $derived.by(() => String(severity || 'info').toLowerCase());
  const tone = $derived.by(() => {
    if (normalized.includes('critical')) return 'critical';
    if (normalized.includes('error') || normalized.includes('high')) return 'high';
    if (normalized.includes('warn') || normalized.includes('medium')) return 'medium';
    if (normalized.includes('low') || normalized.includes('info')) return 'low';
    return 'neutral';
  });
</script>

<span class={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
  tone === 'critical'
    ? 'bg-red-500/15 text-red-200'
    : tone === 'high'
      ? 'bg-red-400/10 text-red-300'
      : tone === 'medium'
        ? 'bg-amber-400/10 text-amber-200'
        : tone === 'low'
          ? 'bg-blue-400/10 text-blue-200'
          : 'bg-surface-3 text-surface-10'
}`}>
  {normalized}
</span>

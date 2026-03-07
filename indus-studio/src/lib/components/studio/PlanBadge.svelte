<script lang="ts">
  interface Props {
    plan?: string;
  }

  let { plan = 'free' }: Props = $props();
  const normalized = $derived.by(() => String(plan || 'free').toLowerCase());
</script>

<span class={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
  normalized.includes('enterprise')
    ? 'bg-violet-500/15 text-violet-200'
    : normalized.includes('pro')
      ? 'bg-orange-500/15 text-orange-200'
      : 'bg-surface-3 text-surface-10'
}`}>
  {normalized}
</span>

<script lang="ts">
  import Badge from './Badge.svelte';
  interface Props {
    status: string;
  }
  let { status }: Props = $props();
  const tone = $derived.by(() => {
    const normalized = status.toLowerCase();
    if (
      normalized.includes('fail') ||
      normalized.includes('error') ||
      normalized.includes('dead') ||
      normalized.includes('critical') ||
      normalized.includes('revoked') ||
      normalized.includes('disabled') ||
      normalized.includes('inactive')
    ) {
      return 'danger';
    }
    if (
      normalized.includes('warn') ||
      normalized.includes('pending') ||
      normalized.includes('queued') ||
      normalized.includes('running') ||
      normalized.includes('partial')
    ) {
      return 'warning';
    }
    if (
      normalized.includes('success') ||
      normalized.includes('ok') ||
      normalized.includes('active') ||
      normalized.includes('available') ||
      normalized.includes('verified') ||
      normalized.includes('delivered') ||
      normalized.includes('resolved') ||
      normalized.includes('healthy')
    ) {
      return 'success';
    }
    return 'default';
  });
</script>
<Badge {tone} text={status} />

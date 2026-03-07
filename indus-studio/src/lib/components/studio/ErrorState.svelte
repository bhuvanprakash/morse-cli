<script lang="ts">
  interface Props {
    title?: string;
    message: string;
    details?: string;
    onRetry?: () => void;
  }
  let { title = 'Something went wrong', message, details = '', onRetry }: Props = $props();
  let show = $state(false);
</script>

<div class="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200">
  <h3 class="font-semibold">{title}</h3>
  <p class="mt-1 text-sm">{message}</p>
  {#if details}
    <button class="mt-2 text-xs underline" onclick={() => (show = !show)}>{show ? 'Hide' : 'Show'} details</button>
    {#if show}
      <pre class="mt-2 max-h-40 overflow-auto rounded bg-black/20 p-2 text-xs">{details}</pre>
    {/if}
  {/if}
  <div class="mt-3">
    {#if onRetry}
      <button class="rounded-md border border-red-400/40 bg-transparent px-3 py-1 text-sm hover:bg-red-500/10" onclick={onRetry}>Retry</button>
    {/if}
  </div>
</div>

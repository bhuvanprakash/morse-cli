<script lang="ts">
  import { prettyJson } from '$lib/utils/json';
  import CopyButton from './CopyButton.svelte';
  interface Props {
    value: unknown;
    maxHeight?: string;
  }
  let { value, maxHeight = '20rem' }: Props = $props();
  const text = $derived(prettyJson(value));
</script>

<div class="overflow-hidden rounded-xl border border-white/10 bg-slate-950/80 shadow-inner">
  <div class="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-2">
    <div class="flex items-center gap-2">
      <span class="h-2 w-2 rounded-full bg-emerald-400/80"></span>
      <span class="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">JSON</span>
    </div>
    <CopyButton value={text} testId="json-viewer-copy" />
  </div>
  <pre class="overflow-auto bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.08),transparent_38%)] p-3 text-xs leading-6 text-slate-200" style={`max-height:${maxHeight}`}>{text}</pre>
</div>

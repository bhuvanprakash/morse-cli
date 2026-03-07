<script lang="ts">
  interface Point { label: string; value: number; tone?: 'orange' | 'blue' | 'green' | 'red'; }
  interface Props { points: Point[]; height?: number; }
  let { points = [], height = 140 }: Props = $props();
  const maxValue = $derived(Math.max(1, ...points.map((p) => p.value)));
  const toneClass = {
    orange: 'bg-orange-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    red: 'bg-red-500',
  };
</script>

<div class="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
  <div class="flex items-end gap-2" style={`height:${height}px`}>
    {#each points as point}
      <div class="flex min-w-0 flex-1 flex-col items-center gap-1">
        <div
          class={`w-full rounded-t ${toneClass[point.tone ?? 'orange']}`}
          style={`height:${Math.max(6, (point.value / maxValue) * (height - 30))}px`}
          title={`${point.label}: ${point.value}`}
        ></div>
        <span class="truncate text-[10px] text-gray-500">{point.label}</span>
      </div>
    {/each}
  </div>
</div>

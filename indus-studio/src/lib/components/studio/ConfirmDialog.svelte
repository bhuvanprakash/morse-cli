<script lang="ts">
  import { confirmState, confirmDialog } from '$lib/stores/confirm';
</script>

{#if $confirmState.open}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
    <div class="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-800 dark:bg-gray-950">
      <h3 class="text-base font-semibold text-gray-900 dark:text-gray-100">{$confirmState.title}</h3>
      <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">{$confirmState.message}</p>
      <div class="mt-4 flex justify-end gap-2">
        <button class="rounded-md border border-gray-300 px-3 py-2 text-sm" onclick={() => confirmDialog.resolve(false)}>{$confirmState.cancelText}</button>
        <button
          class={`rounded-md px-3 py-2 text-sm text-white ${$confirmState.variant === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}`}
          onclick={() => confirmDialog.resolve(true)}
        >
          {$confirmState.confirmText}
        </button>
      </div>
    </div>
  </div>
{/if}

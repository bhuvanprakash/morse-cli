<script lang="ts">
  interface Props {
    value: string;
    placeholder?: string;
    oninput?: (value: string) => void;
  }
  let { value = '', placeholder = 'Search...', oninput }: Props = $props();
</script>

<input
  class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
  {placeholder}
  {value}
  oninput={(e) => oninput?.((e.target as HTMLInputElement).value)}
/>

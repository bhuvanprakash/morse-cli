<script lang="ts">
  import type { EnvironmentName } from '$lib/types/api';

  interface ScopeOption {
    id: string;
    label: string;
    meta?: string;
  }

  interface Props {
    organizationOptions?: ScopeOption[];
    projectOptions?: ScopeOption[];
    activeOrganizationId?: string;
    activeProjectId?: string;
    environment?: EnvironmentName;
    loading?: boolean;
    onOrganizationChange?: (id: string) => void;
    onProjectChange?: (id: string) => void;
    onEnvironmentChange?: (value: EnvironmentName) => void;
  }

  let {
    organizationOptions = [],
    projectOptions = [],
    activeOrganizationId = '',
    activeProjectId = '',
    environment = 'production',
    loading = false,
    onOrganizationChange,
    onProjectChange,
    onEnvironmentChange
  }: Props = $props();
</script>

<div class="grid gap-3 lg:grid-cols-[minmax(12rem,18rem)_minmax(16rem,1fr)_11rem]" data-testid="scope-switcher">
  <label class="scope-field">
    <span>Organization</span>
    <select
      data-testid="scope-org-select"
      value={activeOrganizationId}
      onchange={(event) => onOrganizationChange?.((event.currentTarget as HTMLSelectElement).value)}
      disabled={loading || organizationOptions.length === 0}
    >
      {#if organizationOptions.length === 0}
        <option value="">No organizations</option>
      {/if}
      {#each organizationOptions as option}
        <option value={option.id}>{option.label}</option>
      {/each}
    </select>
  </label>

  <label class="scope-field">
    <span>Project</span>
    <select
      data-testid="scope-project-select"
      value={activeProjectId}
      onchange={(event) => onProjectChange?.((event.currentTarget as HTMLSelectElement).value)}
      disabled={loading || projectOptions.length === 0}
    >
      {#if projectOptions.length === 0}
        <option value="">No projects</option>
      {/if}
      {#each projectOptions as option}
        <option value={option.id}>{option.label}{option.meta ? ` • ${option.meta}` : ''}</option>
      {/each}
    </select>
  </label>

  <label class="scope-field">
    <span>Environment</span>
    <select
      data-testid="scope-environment-select"
      value={environment}
      onchange={(event) => onEnvironmentChange?.((event.currentTarget as HTMLSelectElement).value as EnvironmentName)}
    >
      <option value="development">development</option>
      <option value="staging">staging</option>
      <option value="production">production</option>
    </select>
  </label>
</div>

<style>
  .scope-field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .scope-field span {
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--surface-10);
  }

  .scope-field select {
    min-height: 2.7rem;
    border-radius: 0.85rem;
    border: 1px solid var(--surface-6);
    background: var(--surface-2);
    color: var(--surface-12);
    padding: 0.65rem 0.8rem;
  }
</style>

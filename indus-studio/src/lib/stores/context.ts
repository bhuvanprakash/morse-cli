import { browser } from '$app/environment';
import { apiClient } from '$api/client';
import type { EnvironmentName } from '$lib/types/api';

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  plan?: string;
}

export interface ProjectSummary {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  db_schema?: string;
  region?: string;
  status?: string;
}

class ContextStore {
  organizations = $state<OrganizationSummary[]>([]);
  projects = $state<ProjectSummary[]>([]);
  activeOrganizationId = $state<string>('');
  activeProjectId = $state<string>('');
  environment = $state<EnvironmentName>('production');
  loading = $state(false);
  error = $state<string | null>(null);
  loaded = $state(false);

  activeProject = $derived(
    this.projects.find((p) => p.id === this.activeProjectId) ?? null
  );
  activeOrganization = $derived(
    this.organizations.find((org) => org.id === this.activeOrganizationId) ?? null
  );
  projectsForActiveOrganization = $derived.by(() =>
    this.activeOrganizationId
      ? this.projects.filter((project) => project.org_id === this.activeOrganizationId)
      : this.projects
  );

  constructor() {
    if (browser) {
      this.activeOrganizationId = localStorage.getItem('active_org_id') || '';
      this.activeProjectId = localStorage.getItem('active_project_id') || '';
      this.environment = (localStorage.getItem('active_environment') as EnvironmentName) || 'production';
    }
  }

  persist(): void {
    if (!browser) return;
    localStorage.setItem('active_org_id', this.activeOrganizationId || '');
    localStorage.setItem('active_project_id', this.activeProjectId || '');
    localStorage.setItem('active_environment', this.environment);
  }

  setEnvironment(env: EnvironmentName): void {
    this.environment = env;
    this.persist();
    apiClient.setContext(this.activeProjectId, this.environment, this.activeOrganizationId);
  }

  setActiveOrg(orgId: string): void {
    this.activeOrganizationId = orgId;
    const activeProjectInOrg = this.projects.find((p) => p.id === this.activeProjectId && p.org_id === orgId);
    if (!activeProjectInOrg) {
      const orgProject = this.projects.find((p) => p.org_id === orgId);
      this.activeProjectId = orgProject?.id ?? '';
    }
    this.persist();
    apiClient.setContext(this.activeProjectId, this.environment, this.activeOrganizationId);
  }

  setActiveProject(projectId: string): void {
    this.activeProjectId = projectId;
    const selected = this.projects.find((p) => p.id === projectId);
    if (selected) {
      this.activeOrganizationId = selected.org_id;
    }
    this.persist();
    apiClient.setContext(this.activeProjectId, this.environment, this.activeOrganizationId);
  }

  async load(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const orgs = await apiClient.getNormalized<OrganizationSummary[] | OrganizationSummary>('/meta/organizations');
      const orgList = Array.isArray(orgs) ? orgs : (orgs ? [orgs] : []);
      this.organizations = orgList;

      const projects = await apiClient.getNormalized<ProjectSummary[]>('/meta/projects');
      this.projects = projects ?? [];

      if (this.activeOrganizationId && !this.organizations.some((org) => org.id === this.activeOrganizationId)) {
        this.activeOrganizationId = '';
      }
      if (!this.activeOrganizationId && this.organizations.length) {
        this.activeOrganizationId = this.organizations[0].id;
      }
      if (this.activeProjectId && !this.projects.some((project) => project.id === this.activeProjectId)) {
        this.activeProjectId = '';
      }
      if (!this.activeProjectId && this.projects.length) {
        const candidate = this.projects.find((p) => p.org_id === this.activeOrganizationId) ?? this.projects[0];
        this.activeProjectId = candidate.id;
      }

      if (this.activeProjectId && this.activeOrganizationId) {
        const activeProject = this.projects.find((project) => project.id === this.activeProjectId);
        if (activeProject && activeProject.org_id !== this.activeOrganizationId) {
          const candidate = this.projects.find((project) => project.org_id === this.activeOrganizationId);
          this.activeProjectId = candidate?.id ?? activeProject.id;
        }
      }

      this.persist();
      apiClient.setContext(this.activeProjectId, this.environment, this.activeOrganizationId);
      this.loaded = true;
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'Failed to load context';
      this.loaded = false;
    } finally {
      this.loading = false;
    }
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded || this.loading) return;
    await this.load();
  }
}

export const contextStore = new ContextStore();

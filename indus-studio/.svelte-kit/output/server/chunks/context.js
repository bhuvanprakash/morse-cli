import { a as apiClient } from "./client2.js";
class ContextStore {
  organizations = $state([]);
  projects = $state([]);
  activeOrganizationId = $state("");
  activeProjectId = $state("");
  environment = $state("production");
  loading = $state(false);
  error = $state(null);
  loaded = $state(false);
  activeProject = $derived(
    this.projects.find((p) => p.id === this.activeProjectId) ?? null
  );
  activeOrganization = $derived(
    this.organizations.find((org) => org.id === this.activeOrganizationId) ?? null
  );
  projectsForActiveOrganization = $derived.by(
    () => this.activeOrganizationId ? this.projects.filter((project) => project.org_id === this.activeOrganizationId) : this.projects
  );
  constructor() {
  }
  persist() {
    return;
  }
  setEnvironment(env) {
    this.environment = env;
    this.persist();
    apiClient.setContext(this.activeProjectId, this.environment, this.activeOrganizationId);
  }
  setActiveOrg(orgId) {
    this.activeOrganizationId = orgId;
    const activeProjectInOrg = this.projects.find((p) => p.id === this.activeProjectId && p.org_id === orgId);
    if (!activeProjectInOrg) {
      const orgProject = this.projects.find((p) => p.org_id === orgId);
      this.activeProjectId = orgProject?.id ?? "";
    }
    this.persist();
    apiClient.setContext(this.activeProjectId, this.environment, this.activeOrganizationId);
  }
  setActiveProject(projectId) {
    this.activeProjectId = projectId;
    const selected = this.projects.find((p) => p.id === projectId);
    if (selected) {
      this.activeOrganizationId = selected.org_id;
    }
    this.persist();
    apiClient.setContext(this.activeProjectId, this.environment, this.activeOrganizationId);
  }
  async load() {
    this.loading = true;
    this.error = null;
    try {
      const orgs = await apiClient.getNormalized("/meta/organizations");
      const orgList = Array.isArray(orgs) ? orgs : orgs ? [orgs] : [];
      this.organizations = orgList;
      const projects = await apiClient.getNormalized("/meta/projects");
      this.projects = projects ?? [];
      if (this.activeOrganizationId && !this.organizations.some((org) => org.id === this.activeOrganizationId)) {
        this.activeOrganizationId = "";
      }
      if (!this.activeOrganizationId && this.organizations.length) {
        this.activeOrganizationId = this.organizations[0].id;
      }
      if (this.activeProjectId && !this.projects.some((project) => project.id === this.activeProjectId)) {
        this.activeProjectId = "";
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
      this.error = error instanceof Error ? error.message : "Failed to load context";
      this.loaded = false;
    } finally {
      this.loading = false;
    }
  }
  async ensureLoaded() {
    if (this.loaded || this.loading) return;
    await this.load();
  }
}
const contextStore = new ContextStore();
export {
  contextStore as c
};

import { browser } from '$app/environment';

export interface Project {
    id: string;
    name: string;
    description?: string;
    created_at: string;
    updated_at: string;
}

export interface Schema {
    name: string;
    tables: Table[];
}

export interface Table {
    name: string;
    schema: string;
    columns: Column[];
    primary_key: string[];
}

export interface Column {
    name: string;
    type: string;
    is_nullable: boolean;
    default_value?: string;
    is_identity?: boolean;
}

// Project store using Svelte 5 runes
class ProjectStore {
    // State
    projects = $state<Project[]>([]);
    activeProject = $state<Project | null>(null);
    activeSchema = $state<string>('public');
    schemas = $state<Schema[]>([]);
    loading = $state(false);
    error = $state<string | null>(null);

    // Derived state
    activeProjectTables = $derived(
        this.schemas.find(s => s.name === this.activeSchema)?.tables ?? []
    );

    constructor() {
        if (browser) {
            this.loadFromStorage();
        }
    }

    setProjects(projects: Project[]): void {
        this.projects = projects;
    }

    setActiveProject(project: Project | null): void {
        this.activeProject = project;

        if (browser && project) {
            localStorage.setItem('active_project_id', project.id);
            localStorage.setItem('active_project', JSON.stringify(project));
        }

        // Reset schema when project changes
        this.activeSchema = 'public';
        this.schemas = [];
    }

    setActiveSchema(schema: string): void {
        this.activeSchema = schema;

        if (browser) {
            localStorage.setItem('active_schema', schema);
        }
    }

    setSchemas(schemas: Schema[]): void {
        this.schemas = schemas;
    }

    addSchema(schema: Schema): void {
        const existing = this.schemas.find(s => s.name === schema.name);
        if (!existing) {
            this.schemas = [...this.schemas, schema];
        }
    }

    updateTables(schemaName: string, tables: Table[]): void {
        this.schemas = this.schemas.map(schema =>
            schema.name === schemaName
                ? { ...schema, tables }
                : schema
        );
    }

    loadFromStorage(): void {
        if (!browser) return;

        try {
            // Load active project
            const projectJson = localStorage.getItem('active_project');
            if (projectJson) {
                this.activeProject = JSON.parse(projectJson);
            }

            // Load active schema
            const schema = localStorage.getItem('active_schema');
            if (schema) {
                this.activeSchema = schema;
            }
        } catch (e) {
            console.error('Failed to load project from storage:', e);
        }
    }

    clear(): void {
        this.activeProject = null;
        this.activeSchema = 'public';
        this.schemas = [];

        if (browser) {
            localStorage.removeItem('active_project_id');
            localStorage.removeItem('active_project');
            localStorage.removeItem('active_schema');
        }
    }

    getTable(schema: string, table: string): Table | undefined {
        return this.schemas
            .find(s => s.name === schema)
            ?.tables.find(t => t.name === table);
    }

    getColumn(schema: string, table: string, column: string): Column | undefined {
        return this.getTable(schema, table)?.columns.find(c => c.name === column);
    }
}

// Export singleton instance
export const project = new ProjectStore();

// Legacy store compatibility
import { writable, derived } from 'svelte/store';

export const projectsStore = writable<Project[]>([]);
export const activeProjectStore = writable<Project | null>(null);
export const activeSchemaStore = writable<string>('public');

export const projectTables = derived(
    [activeProjectStore, activeSchemaStore],
    ([$project, $schema]) => {
        // This would be populated from project store
        return project.activeProjectTables;
    }
);

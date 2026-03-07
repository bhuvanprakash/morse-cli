import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { contextStore } from '$lib/stores/context';
import { auth } from '$stores/auth';
import { getDocsUrl } from '$lib/utils/urls';

export type CommandAction =
	| { type: 'navigate'; href: string }
	| { type: 'project'; projectId: string; href?: string }
	| { type: 'environment'; environment: 'development' | 'staging' | 'production' }
	| { type: 'external'; href: string };

export interface CommandItem {
	id: string;
	label: string;
	description: string;
	group: 'Navigate' | 'Projects' | 'Environment' | 'Actions' | 'Docs';
	keywords?: string[];
	action: CommandAction;
	adminOnly?: boolean;
}

class CommandPaletteStore {
	open = $state(false);
	query = $state('');
	selectedIndex = $state(0);

	get commands(): CommandItem[] {
		const role = String(auth.user?.role ?? '').toLowerCase();
		const isAdmin = role === 'admin' || role === 'owner';
		const projectCommands: CommandItem[] = contextStore.projects.map((project) => ({
			id: `project-${project.id}`,
			label: `Switch project: ${project.name}`,
			description: `${project.slug} • ${project.region || 'ap-south-1'}`,
			group: 'Projects' as const,
			keywords: [project.slug, project.name, project.region || ''],
			action: { type: 'project' as const, projectId: project.id, href: '/dashboard' }
		}));

		const commands: CommandItem[] = [
			{
				id: 'nav-dashboard',
				label: 'Open Dashboard',
				description: 'Project overview and quick actions',
				group: 'Navigate',
				keywords: ['home', 'overview'],
				action: { type: 'navigate', href: '/dashboard' }
			},
			{
				id: 'nav-settings',
				label: 'Open Settings',
				description: 'Project metadata, preferences, and health',
				group: 'Navigate',
				keywords: ['preferences', 'config'],
				action: { type: 'navigate', href: '/settings' }
			},
			{
				id: 'nav-ai',
				label: 'Open AI Search',
				description: 'Collections, upserts, and semantic search',
				group: 'Navigate',
				keywords: ['vector', 'embeddings'],
				action: { type: 'navigate', href: '/ai' }
			},
			{
				id: 'nav-queue',
				label: 'Open Queue',
				description: 'Jobs, webhooks, and cron schedules',
				group: 'Navigate',
				keywords: ['jobs', 'webhooks', 'cron'],
				action: { type: 'navigate', href: '/queue' }
			},
			{
				id: 'nav-notify',
				label: 'Open Notifications',
				description: 'Push, SMS, email, templates, and history',
				group: 'Navigate',
				keywords: ['sms', 'push', 'email'],
				action: { type: 'navigate', href: '/notifications' }
			},
			{
				id: 'nav-flags',
				label: 'Open Feature Flags',
				description: 'Flags, environments, and remote config',
				group: 'Navigate',
				keywords: ['config', 'rollout', 'feature'],
				action: { type: 'navigate', href: '/flags' }
			},
			{
				id: 'nav-audit',
				label: 'Open Audit Logs',
				description: 'Filters, exports, and event details',
				group: 'Navigate',
				keywords: ['events', 'logs'],
				action: { type: 'navigate', href: '/audit' }
			},
			{
				id: 'nav-status',
				label: 'Open Status',
				description: 'Components, incidents, and maintenance',
				group: 'Navigate',
				keywords: ['incidents', 'ops', 'health'],
				action: { type: 'navigate', href: '/status' }
			},
			{
				id: 'action-onboarding',
				label: 'Create Project',
				description: 'Open onboarding and bootstrap a project',
				group: 'Actions',
				keywords: ['new project', 'bootstrap'],
				action: { type: 'navigate', href: '/onboarding' }
			},
			{
				id: 'action-enterprise',
				label: 'Open Enterprise SSO',
				description: 'Verified domains, SSO, and SCIM',
				group: 'Actions',
				keywords: ['sso', 'scim', 'saml', 'oidc'],
				action: { type: 'navigate', href: '/enterprise/sso' }
			},
			{
				id: 'action-support',
				label: 'Open Support Console',
				description: 'User/project lookup and support context',
				group: 'Actions',
				keywords: ['support', 'admin'],
				action: { type: 'navigate', href: '/support' },
				adminOnly: true
			},
			{
				id: 'env-development',
				label: 'Switch to development',
				description: 'Use development environment context',
				group: 'Environment',
				keywords: ['dev'],
				action: { type: 'environment', environment: 'development' }
			},
			{
				id: 'env-staging',
				label: 'Switch to staging',
				description: 'Use staging environment context',
				group: 'Environment',
				keywords: ['preprod'],
				action: { type: 'environment', environment: 'staging' }
			},
			{
				id: 'env-production',
				label: 'Switch to production',
				description: 'Use production environment context',
				group: 'Environment',
				keywords: ['prod'],
				action: { type: 'environment', environment: 'production' }
			},
			{
				id: 'docs-overview',
				label: 'Open Studio Docs',
				description: 'Open the product documentation site',
				group: 'Docs',
				keywords: ['documentation', 'guide'],
				action: { type: 'external', href: getDocsUrl('/') }
			},
			{
				id: 'docs-flags',
				label: 'Open Feature Flag Docs',
				description: 'Read rollout and config guidance',
				group: 'Docs',
				keywords: ['docs', 'flags'],
				action: { type: 'external', href: getDocsUrl('/feature-flags/overview') }
			}
		];

		return commands
			.filter((command) => !command.adminOnly || isAdmin)
			.concat(projectCommands);
	}

	get filtered(): CommandItem[] {
		const query = this.query.trim().toLowerCase();
		if (!query) return this.commands;
		return this.commands.filter((command) => {
			const haystack = [command.label, command.description, ...(command.keywords ?? [])]
				.join(' ')
				.toLowerCase();
			return haystack.includes(query);
		});
	}

	show(): void {
		this.open = true;
		this.selectedIndex = 0;
	}

	hide(): void {
		this.open = false;
		this.query = '';
		this.selectedIndex = 0;
	}

	toggle(): void {
		if (this.open) this.hide();
		else this.show();
	}

	move(delta: number): void {
		const count = this.filtered.length;
		if (count === 0) {
			this.selectedIndex = 0;
			return;
		}
		const next = this.selectedIndex + delta;
		this.selectedIndex = Math.max(0, Math.min(count - 1, next));
	}

	async execute(command: CommandItem): Promise<void> {
		switch (command.action.type) {
			case 'navigate':
				this.hide();
				await goto(command.action.href);
				return;
			case 'project':
				contextStore.setActiveProject(command.action.projectId);
				this.hide();
				await goto(command.action.href ?? '/dashboard');
				return;
			case 'environment':
				contextStore.setEnvironment(command.action.environment);
				this.hide();
				return;
			case 'external':
				this.hide();
				if (browser) {
					window.open(command.action.href, '_blank', 'noopener,noreferrer');
				}
				return;
		}
	}
}

export const commandPaletteStore = new CommandPaletteStore();

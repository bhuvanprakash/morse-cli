import type { APIRequestContext, APIResponse, Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:8000';
export const STUDIO_BASE_URL = process.env.STUDIO_BASE_URL || 'http://127.0.0.1:3000';
export const E2E_EMAIL = process.env.E2E_EMAIL || 'admin@indusbase.local';
export const E2E_PASSWORD = process.env.E2E_PASSWORD || 'AdminPass123!';

type SigninData = {
	access_token: string;
	refresh_token: string;
	user?: Record<string, unknown>;
};

type SeedContext = {
	token: string;
	refreshToken: string;
	user: Record<string, unknown>;
	orgId: string;
	projectId: string;
	projectAnonKey?: string;
};

async function readJson(response: APIResponse): Promise<any> {
	try {
		return await response.json();
	} catch {
		return {};
	}
}

async function apiRequest(
	request: APIRequestContext,
	method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
	path: string,
	token?: string,
	body?: unknown
): Promise<any> {
	const response = await request.fetch(`${API_BASE_URL}${path}`, {
		method,
		headers: {
			'Content-Type': 'application/json',
			...(token ? { Authorization: `Bearer ${token}` } : {})
		},
		data: body
	});
	const payload = await readJson(response);
	if (!response.ok || payload?.error) {
		const message =
			payload?.error?.message ||
			payload?.error ||
			`${method} ${path} failed (${response.status()})`;
		throw new Error(String(message));
	}
	return payload?.data ?? payload;
}

export async function isPlatformReady(request: APIRequestContext): Promise<boolean> {
	try {
		const [apiHealth, studioLogin] = await Promise.all([
			request.get(`${API_BASE_URL}/health`, { timeout: 5_000 }),
			request.get(`${STUDIO_BASE_URL}/login`, { timeout: 5_000 })
		]);
		return apiHealth.ok() && studioLogin.ok();
	} catch {
		return false;
	}
}

export async function loginFromUI(page: Page): Promise<void> {
	await page.goto('/login');
	await page.getByLabel('Email').fill(E2E_EMAIL);
	await page.getByLabel('Password').fill(E2E_PASSWORD);
	await page.getByRole('button', { name: 'Sign In' }).click();
	await expect(page).toHaveURL(/dashboard|onboarding/);
}

async function ensureOrgAndProject(request: APIRequestContext, token: string): Promise<{
	orgId: string;
	projectId: string;
	projectAnonKey?: string;
}> {
	const orgsRaw = await apiRequest(request, 'GET', '/meta/organizations', token);
	const orgs = Array.isArray(orgsRaw) ? orgsRaw : orgsRaw ? [orgsRaw] : [];

	let orgId: string;
	if (orgs.length > 0) {
		orgId = String(orgs[0].id);
	} else {
		const created = await apiRequest(request, 'POST', '/meta/organizations', token, {
			name: 'E2E Organization',
			slug: `e2e-org-${Date.now()}`
		});
		orgId = String(created.id);
	}

	const projectsRaw = await apiRequest(request, 'GET', `/meta/projects?org_id=${encodeURIComponent(orgId)}`, token);
	const projects = Array.isArray(projectsRaw) ? projectsRaw : projectsRaw ? [projectsRaw] : [];
	if (projects.length > 0) {
		return { orgId, projectId: String(projects[0].id) };
	}

	const createdProject = await apiRequest(request, 'POST', '/meta/projects', token, {
		name: `e2e-project-${Date.now()}`,
		slug: `e2e-${Date.now().toString().slice(-8)}`,
		org_id: orgId,
		region: 'ap-south-1'
	});

	return {
		orgId,
		projectId: String(createdProject.id),
		projectAnonKey: createdProject.anon_key ? String(createdProject.anon_key) : undefined
	};
}

export async function seedSession(request: APIRequestContext): Promise<SeedContext> {
	const signin = (await apiRequest(request, 'POST', '/auth/signin', undefined, {
		email: E2E_EMAIL,
		password: E2E_PASSWORD
	})) as SigninData;

	const token = String(signin.access_token || '');
	const refreshToken = String(signin.refresh_token || '');
	if (!token) {
		throw new Error('No access token received from /auth/signin');
	}

	const identity = (signin.user as Record<string, unknown> | undefined) || (await apiRequest(request, 'GET', '/auth/user', token));
	const seeded = await ensureOrgAndProject(request, token);

	return {
		token,
		refreshToken,
		user: identity,
		orgId: seeded.orgId,
		projectId: seeded.projectId,
		projectAnonKey: seeded.projectAnonKey
	};
}

export async function bootstrapAuthenticatedStudio(page: Page, request: APIRequestContext): Promise<SeedContext> {
	const ctx = await seedSession(request);
	await page.addInitScript((state) => {
		localStorage.setItem('access_token', state.token);
		localStorage.setItem('refresh_token', state.refreshToken);
		localStorage.setItem('user', JSON.stringify(state.user || {}));
		localStorage.setItem('onboarding_complete', 'true');
		localStorage.setItem('active_org_id', state.orgId);
		localStorage.setItem('active_project_id', state.projectId);
		localStorage.setItem('active_environment', 'production');
		if (state.projectAnonKey) {
			localStorage.setItem('active_project_anon_key', state.projectAnonKey);
		}
	}, ctx);
	return ctx;
}

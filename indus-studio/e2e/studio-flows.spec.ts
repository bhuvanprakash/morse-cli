import { test, expect } from '@playwright/test';
import { bootstrapAuthenticatedStudio, isPlatformReady, loginFromUI } from './helpers';

test.describe.configure({ mode: 'serial' });

test('login flow', async ({ page, request }) => {
	test.skip(!(await isPlatformReady(request)), 'Studio/API not reachable');
	await page.goto('/login');
	await loginFromUI(page);
	await expect(page).toHaveURL(/dashboard|onboarding/);
});

test('onboarding flow loads and supports skip', async ({ page, request }) => {
	test.skip(!(await isPlatformReady(request)), 'Studio/API not reachable');
	const session = await bootstrapAuthenticatedStudio(page, request);
	await page.addInitScript((state) => {
		localStorage.setItem('onboarding_complete', 'false');
		localStorage.setItem('active_org_id', state.orgId);
		localStorage.setItem('active_project_id', state.projectId);
	}, session);
	await page.goto('/onboarding');
	await expect(page.getByRole('heading', { name: 'Welcome to IndusBase' })).toBeVisible();
	await page.getByRole('button', { name: 'Skip for now' }).click();
	await page.getByRole('button', { name: 'Skip for now' }).click();
	await expect(page).toHaveURL(/dashboard|onboarding/);
});

test('project creation flow from onboarding', async ({ page, request }) => {
	test.skip(!(await isPlatformReady(request)), 'Studio/API not reachable');
	const session = await bootstrapAuthenticatedStudio(page, request);
	await page.addInitScript((state) => {
		localStorage.setItem('onboarding_complete', 'false');
		localStorage.setItem('active_org_id', state.orgId);
		localStorage.setItem('active_project_id', state.projectId);
	}, session);
	await page.goto('/onboarding');
	await page.getByRole('button', { name: 'Start Onboarding' }).click();
	const unique = `e2e-studio-${Date.now()}`;
	await page.locator('#project_name').fill(unique);
	await page.getByRole('button', { name: 'Create Project' }).click();
	await expect(page.getByRole('heading', { name: 'Project created successfully' })).toBeVisible({ timeout: 30_000 });
});

test('AI collection create/search basic flow', async ({ page, request }) => {
	test.skip(!(await isPlatformReady(request)), 'Studio/API not reachable');
	await bootstrapAuthenticatedStudio(page, request);
	await page.goto('/ai');
	await expect(page.getByRole('heading', { name: 'AI Vector Search' })).toBeVisible();

	const collection = `e2e-ai-${Date.now()}`;
	await page.getByTestId('ai-new-collection').click();
	await page.locator('#collection-name').fill(collection);
	await page.getByTestId('ai-create-collection-submit').click();
	await expect(page.getByText(collection)).toBeVisible({ timeout: 20_000 });

	await page.getByRole('button', { name: 'Documents' }).click();
	await page.getByRole('button', { name: 'Upload / Upsert' }).click();
	await page.locator('#upload-content').fill('IndusBase is a Postgres-native BaaS for India.');
	await page.getByRole('button', { name: 'Upsert' }).click();
	await page.getByRole('button', { name: 'Semantic Search' }).click();
	await page.locator('#search-query').fill('India BaaS backend');
	await page.getByTestId('ai-run-search').click();
	await expect(page.getByText(/result\(s\)/)).toBeVisible();
});

test('flag create/update flow', async ({ page, request }) => {
	test.skip(!(await isPlatformReady(request)), 'Studio/API not reachable');
	await bootstrapAuthenticatedStudio(page, request);
	await page.goto('/flags');
	await expect(page.getByRole('heading', { name: 'Feature Flags & Remote Config' })).toBeVisible();

	const key = `e2e_flag_${Date.now().toString().slice(-8)}`;
	await page.getByTestId('flags-new-flag').click();
	await page.locator('input[placeholder="new_dashboard"]').fill(key);
	await page.getByTestId('flags-save-flag').click();
	await expect(page.getByText(key)).toBeVisible({ timeout: 20_000 });
	await page.getByRole('button', { name: 'Edit' }).first().click();
	await page.locator('input[placeholder="Controls rollout of the new dashboard"]').fill('Updated by e2e');
	await page.getByTestId('flags-save-flag').click();
	await expect(page.getByText('Updated by e2e')).toBeVisible();
});

test('notification template create/preview flow', async ({ page, request }) => {
	test.skip(!(await isPlatformReady(request)), 'Studio/API not reachable');
	await bootstrapAuthenticatedStudio(page, request);
	await page.goto('/notifications');
	await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();

	await page.getByRole('button', { name: 'Templates' }).click();
	await page.getByTestId('notifications-new-template').click();
	const name = `e2e-template-${Date.now().toString().slice(-8)}`;
	await page.locator('input[placeholder="payment-success-sms"]').fill(name);
	await page.locator('textarea[placeholder="Dear {{name}}, your payment was successful."]').fill('Hi {{name}}, test');
	await page.locator('input[placeholder="name,amount,merchant,method,ref_id"]').fill('name');
	await page.getByTestId('notifications-save-template').click();
	await expect(page.getByText(name)).toBeVisible({ timeout: 20_000 });
});

test('audit page loads and filters', async ({ page, request }) => {
	test.skip(!(await isPlatformReady(request)), 'Studio/API not reachable');
	await bootstrapAuthenticatedStudio(page, request);
	await page.goto('/audit');
	await expect(page.getByRole('heading', { name: 'Audit Logs' })).toBeVisible();
	await page.locator('input[placeholder="create_project"]').fill('signin');
	await page.getByRole('button', { name: 'Apply Filters' }).click();
	await expect(page.getByText(/Page \d+ of \d+/)).toBeVisible();
});

test('secrets page create/rotate flow', async ({ page, request }) => {
	test.skip(!(await isPlatformReady(request)), 'Studio/API not reachable');
	await bootstrapAuthenticatedStudio(page, request);
	await page.goto('/secrets');
	await expect(page.getByRole('heading', { name: 'Secrets Manager' })).toBeVisible();

	const secretName = `E2E_SECRET_${Date.now()}`;
	await page.getByTestId('secret-name-input').fill(secretName);
	await page.getByTestId('secret-value-input').fill('e2e-secret-value-1');
	await page.getByTestId('create-secret-submit').click();
	await expect(page.getByText(secretName)).toBeVisible({ timeout: 20_000 });

	const row = page.locator('tr', { hasText: secretName }).first();
	await row.getByRole('button', { name: 'Versions' }).click();
	await page.getByTestId('rotate-secret-value').fill('e2e-secret-value-2');
	await page.getByTestId('rotate-secret-submit').click();
	const confirmRotate = page.getByRole('button', { name: /^Rotate$/ }).nth(1);
	if (await confirmRotate.isVisible().catch(() => false)) {
		await confirmRotate.click();
	}
	await expect(page.getByText(/v\d+/).first()).toBeVisible();
});

test('scope switching and settings preference flow', async ({ page, request }) => {
	test.skip(!(await isPlatformReady(request)), 'Studio/API not reachable');
	await bootstrapAuthenticatedStudio(page, request);
	await page.goto('/dashboard');
	await expect(page.getByTestId('scope-switcher')).toBeVisible();
	await page.getByTestId('scope-environment-select').selectOption('staging');
	await expect(page.getByText('staging')).toBeVisible();
	await page.goto('/settings');
	await expect(page.getByTestId('settings-page')).toBeVisible();
	await page.getByTestId('settings-api-url-input').fill(process.env.API_BASE_URL || 'http://127.0.0.1:8000');
	const save = page.getByTestId('save-settings-preferences');
	if (await save.isEnabled()) {
		await save.click();
	}
});

test('queue interaction basic flow', async ({ page, request }) => {
	test.skip(!(await isPlatformReady(request)), 'Studio/API not reachable');
	await bootstrapAuthenticatedStudio(page, request);
	await page.goto('/queue');
	await expect(page.getByTestId('queue-page')).toBeVisible();
	await page.getByText('Webhooks').click();
	await expect(page.getByTestId('queue-new-webhook')).toBeVisible();
	await page.getByText('Cron').click();
	await expect(page.getByTestId('queue-new-cron')).toBeVisible();
	await page.getByText('Jobs').click();
	await page.getByTestId('queue-enqueue-open').click();
	await page.getByTestId('queue-enqueue-payload').fill('{\n  "type": "e2e_test",\n  "payload": { "ok": true }\n}');
	await page.getByTestId('queue-enqueue-submit').click();
});

test('enterprise sso page interaction basics', async ({ page, request }) => {
	test.skip(!(await isPlatformReady(request)), 'Studio/API not reachable');
	await bootstrapAuthenticatedStudio(page, request);
	await page.goto('/enterprise/sso');
	await expect(page.getByTestId('enterprise-sso-page')).toBeVisible();
	await page.getByText('Verified Domains').click();
	await page.getByTestId('enterprise-domain-open').click();
	await page.getByTestId('enterprise-domain-input').fill(`e2e-${Date.now()}.example.com`);
	await page.getByRole('button', { name: 'Cancel' }).last().click();
});

test('billing page loads usage summary', async ({ page, request }) => {
	test.skip(!(await isPlatformReady(request)), 'Studio/API not reachable');
	await bootstrapAuthenticatedStudio(page, request);
	await page.goto('/billing');
	await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible();
	await expect(page.getByText('Current Plan')).toBeVisible();
});

test('security page load and filters', async ({ page, request }) => {
	test.skip(!(await isPlatformReady(request)), 'Studio/API not reachable');
	await bootstrapAuthenticatedStudio(page, request);
	await page.goto('/security');
	await expect(page.getByTestId('security-page')).toBeVisible();
	await page.getByTestId('security-search').fill('sbom');
	await page.getByTestId('security-status').selectOption('');
});

test('status page create/resolve incident flow', async ({ page, request }) => {
	test.skip(!(await isPlatformReady(request)), 'Studio/API not reachable');
	await bootstrapAuthenticatedStudio(page, request);
	await page.goto('/status');
	await expect(page.getByRole('heading', { name: 'Status & Incident Ops' })).toBeVisible();

	await page.getByRole('button', { name: 'Incidents' }).click();
	const incidentTitle = `E2E Incident ${Date.now()}`;
	await page.getByTestId('incident-title-input').fill(incidentTitle);
	await page.locator('textarea[placeholder="Summary"]').fill('E2E incident summary');
	await page.getByTestId('create-incident-submit').click();
	await expect(page.getByText(incidentTitle)).toBeVisible({ timeout: 20_000 });

	const card = page.locator('div.rounded-md', { hasText: incidentTitle }).first();
	const resolveBtn = card.getByRole('button', { name: 'Resolve' });
	if (await resolveBtn.isVisible().catch(() => false)) {
		await resolveBtn.click();
		const confirmResolve = page.getByRole('button', { name: /^Resolve$/ }).nth(1);
		if (await confirmResolve.isVisible().catch(() => false)) {
			await confirmResolve.click();
		}
	}
});

test('support page search flow', async ({ page, request }) => {
	test.skip(!(await isPlatformReady(request)), 'Studio/API not reachable');
	await bootstrapAuthenticatedStudio(page, request);
	await page.goto('/support');
	await expect(page.getByRole('heading', { name: 'Support Console' })).toBeVisible();
	await page.getByTestId('support-user-search').fill('admin');
	await page.getByTestId('support-project-search').fill('e2e');
	await expect(page.getByText('Support Context')).toBeVisible();
});

test('command palette basic navigation', async ({ page, request }) => {
	test.skip(!(await isPlatformReady(request)), 'Studio/API not reachable');
	await bootstrapAuthenticatedStudio(page, request);
	await page.goto('/dashboard');
	await page.getByTestId('command-palette-trigger').click();
	await page.getByTestId('command-palette-input').fill('billing');
	await page.getByRole('button', { name: /Billing/ }).first().click();
	await expect(page).toHaveURL(/\/billing$/);
});

test('@screens dashboard screenshot smoke', async ({ page, request }) => {
	test.skip(!(await isPlatformReady(request)), 'Studio/API not reachable');
	await bootstrapAuthenticatedStudio(page, request);
	await page.goto('/dashboard');
	await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

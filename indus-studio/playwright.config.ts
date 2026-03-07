import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.STUDIO_BASE_URL || 'http://127.0.0.1:3000';

export default defineConfig({
	testDir: './e2e',
	timeout: 90_000,
	expect: {
		timeout: 10_000
	},
	fullyParallel: false,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL,
		trace: 'retain-on-failure',
		video: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	]
});

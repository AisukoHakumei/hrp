import { test, expect } from '@playwright/test';

test.describe('smoke tests', () => {
	test('login page loads', async ({ page }) => {
		await page.goto('/login');
		await expect(page.locator('h1, h2, h3').first()).toBeVisible();
		await expect(page.locator('input[name="email"]')).toBeVisible();
		await expect(page.locator('input[name="password"]')).toBeVisible();
	});

	test('unauthenticated user is redirected to login', async ({ page }) => {
		await page.goto('/dashboard');
		await page.waitForURL('**/login');
		expect(page.url()).toContain('/login');
	});

	test('health endpoint returns ok', async ({ request }) => {
		const response = await request.get('/api/health');
		expect(response.ok()).toBeTruthy();
		const body = await response.json();
		expect(body.status).toBe('ok');
	});
});

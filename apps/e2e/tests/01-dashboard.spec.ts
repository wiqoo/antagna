import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test('loads with greeting + nav', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/);

    // Greeting present (any of صباح الخير / مرحباً / مساء الخير).
    const body = page.locator('body');
    await expect(body).toContainText(/صباح الخير|مرحباً|مساء الخير/);

    // Side dock has 5 primary nav items (PRIMARY_NAV in AppShell).
    // We assert by checking a few labels are reachable.
    await expect(page.getByRole('link', { name: 'المشاريع' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'الوارد' }).first()).toBeVisible();
  });

  test('View-As bar visible for admin', async ({ page }) => {
    await page.goto('/dashboard');
    // The bar contains "View as…" text.
    await expect(page.getByText('View as', { exact: false }).first()).toBeVisible();
  });
});

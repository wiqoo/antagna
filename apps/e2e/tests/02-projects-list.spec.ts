import { test, expect } from '@playwright/test';

test.describe('/projects', () => {
  test('list renders', async ({ page }) => {
    await page.goto('/projects');
    await expect(page).toHaveURL(/\/projects/);
    // Page header / title in Arabic.
    await expect(page.locator('h1, [class*="PageHeader"]').first()).toBeVisible();
    // Create button exists somewhere on the page.
    const createLink = page.locator('a[href="/projects/new"]').first();
    await expect(createLink).toBeVisible();
  });

  test('wizard opens on /projects/new', async ({ page }) => {
    await page.goto('/projects/new');
    await expect(page).toHaveURL(/\/projects\/new/);
    // Match a VISIBLE form input — hidden Server Action inputs come first
    // in the DOM, so filter on type and visibility.
    const visibleInput = page
      .locator('input:not([type="hidden"]), textarea, [role="combobox"]')
      .first();
    await expect(visibleInput).toBeVisible({ timeout: 10_000 });
  });
});

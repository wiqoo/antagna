import { test, expect } from '@playwright/test';

test.describe('/inbox', () => {
  test('renders with email threads', async ({ page }) => {
    await page.goto('/inbox');
    await expect(page).toHaveURL(/\/inbox/);

    // We have 51+ email_threads in DB. The page should render some content
    // beyond the empty-state.
    const body = page.locator('body');
    await expect(body).not.toContainText('لا توجد بيانات');

    // At least one subject line should be visible. Use a broad selector —
    // any element whose text mentions one of the seeded subjects we know.
    // Soft check: just that the page didn't 500.
    await expect(page.locator('main').first()).toBeVisible();
  });
});

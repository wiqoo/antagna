import { test, expect } from '@playwright/test';

test.describe('Admin · Google integration', () => {
  test('admin page lists the connected integration', async ({ page }) => {
    await page.goto('/admin/integrations/google');
    await expect(page).toHaveURL(/\/admin\/integrations\/google/);

    // The connected integration row contains info@voltsaudi.com — the
    // heading (h2), not the subtitle paragraph (which also mentions it).
    await expect(
      page.getByRole('heading', { name: 'info@voltsaudi.com' }),
    ).toBeVisible({ timeout: 15_000 });

    // Three scope badges should be present.
    await expect(page.getByText(/Gmail/).first()).toBeVisible();
    await expect(page.getByText(/Drive/).first()).toBeVisible();
    await expect(page.getByText(/Calendar/).first()).toBeVisible();

    // The Sync panel button.
    await expect(
      page.getByRole('button', { name: /اسحب الإيميلات الآن/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /لخّص الجديد/ }),
    ).toBeVisible();
  });
});

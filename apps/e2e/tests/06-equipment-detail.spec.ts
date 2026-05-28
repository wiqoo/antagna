import { test, expect } from '@playwright/test';

/**
 * C1 equipment detail flow — the QR/scan/kits work shipped this round.
 * Verifies the surfaces render without auth/data assumptions about specific rows.
 */
test.describe('Equipment', () => {
  test('list shows QR-scan + kits actions', async ({ page }) => {
    await page.goto('/equipment');
    await expect(page.getByRole('link', { name: /مسح QR/ }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /الكيتات/ }).first()).toBeVisible();
  });

  test('scan page renders the camera surface + manual fallback', async ({ page }) => {
    await page.goto('/equipment/scan');
    await expect(page.getByText('مسح ملصق المعدة')).toBeVisible();
    await expect(page.getByPlaceholder(/UUID أو رابط/)).toBeVisible();
  });

  test('kits page shows create-kit form', async ({ page }) => {
    await page.goto('/equipment/kits');
    await expect(page.getByText('إنشاء كيت جديد')).toBeVisible();
    await expect(page.getByRole('button', { name: /أضف كيت/ })).toBeVisible();
  });
});

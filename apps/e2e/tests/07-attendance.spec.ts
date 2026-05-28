import { test, expect } from '@playwright/test';

/**
 * C3 attendance PWA — verify the check-in panel + offline queue UI surfaces.
 * Camera capture itself needs a real device + getUserMedia permission, so
 * we only assert the form scaffolding here.
 */
test.describe('Attendance', () => {
  test('check-in panel renders with type select + camera button', async ({ page }) => {
    await page.goto('/attendance');
    await expect(page.getByRole('heading', { name: 'الحضور والانصراف' })).toBeVisible();
    await expect(page.getByText('نوع التسجيل')).toBeVisible();
    // The "start camera" button is conditionally shown.
    const cam = page.getByText(/فتح الكاميرا|التقاط|إعادة/);
    await expect(cam.first()).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

/**
 * Smoke coverage for the production-readiness page expansion.
 *
 * Asserts every new/expanded route renders without a server error and exposes
 * a top-level heading. The storage state is the E2E admin (promoted to
 * system_admin in auth.setup.ts and reused by both the `user` and `admin`
 * Playwright projects), so the admin-gated routes below are reachable.
 *
 * Auth is provided by the shared storage state; if E2E_* secrets are absent
 * the `setup` project throws and these tests never run — matching the existing
 * CI guard (the e2e job is skipped when E2E_SUPABASE_SERVICE_KEY is unset).
 */

const ROUTES: { path: string; name: string }[] = [
  { path: '/approvals', name: 'الاعتمادات' },
  { path: '/notifications', name: 'مركز الإشعارات' },
  { path: '/contacts', name: 'جهات الاتصال' },
  { path: '/employees', name: 'الموظفون' },
  { path: '/meetings', name: 'محاضر الاجتماعات' },
  { path: '/assets', name: 'أصول الشركة' },
  { path: '/admin/system', name: 'وحدة تحكّم النظام' },
  { path: '/admin/departments', name: 'الأقسام' },
  { path: '/admin/skills', name: 'كتالوج المهارات' },
  { path: '/admin/locations', name: 'المواقع والسياجات' },
  { path: '/orders', name: 'أوامر الشراء' },
  { path: '/equipment/reservations', name: 'حجوزات المعدات' },
  { path: '/equipment/repairs', name: 'الصيانة والتشخيص' },
  { path: '/social/accounts', name: 'الحسابات المُدارة' },
  { path: '/my-day', name: 'يومك' },
];

test.describe('new pages — render + heading', () => {
  for (const { path, name } of ROUTES) {
    test(`${path} renders with a heading`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' });

      // Never a 5xx. Some routes may 200 even on auth redirect; status null
      // (from client nav) is tolerated.
      if (response) {
        expect(
          response.status(),
          `${path} returned HTTP ${response.status()}`,
        ).toBeLessThan(500);
      }

      // Landed on the route (or a sensible auth redirect — never an error page).
      await expect(page).not.toHaveURL(/\/(error|404|not-found)/);

      // Next.js error overlay / boundary text must not be present.
      const body = page.locator('body');
      await expect(body).not.toContainText('Application error');
      await expect(body).not.toContainText('Internal Server Error');
      await expect(body).not.toContainText('This page could not be found');

      // A top-level heading is visible. Prefer an exact name match; fall back
      // to "any visible h1/h2" so a copy tweak doesn't turn the smoke red.
      const named = page.getByRole('heading', { name, exact: false }).first();
      const anyHeading = page.locator('h1, h2').first();
      await expect(named.or(anyHeading)).toBeVisible({ timeout: 15_000 });
    });
  }
});

import { test, expect } from '@playwright/test';

test.describe('View-As impersonation', () => {
  test('admin sees the bar, can pick a non-admin, and gets locked out of /admin', async ({
    page,
  }) => {
    await page.goto('/dashboard');

    // Open the View-As dropdown.
    const trigger = page.getByRole('button', { name: /View as/i }).first();
    await expect(trigger).toBeVisible();
    await trigger.click();

    // Pick the first non-admin user (any row whose role is not Admin).
    // The dropdown rows have role label badges; we click on "محسن" since
    // it's a stable seeded fake profile (user).
    const mohsenRow = page.getByRole('button', { name: /محسن/ }).first();
    await mohsenRow.click();

    // Wait for the impersonation banner to flip to yellow.
    await expect(page.getByText(/تشاهد كـ/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/محسن/).first()).toBeVisible();

    // Visiting /admin should kick us off the admin page. The chain is
    // /admin → /login?next=/admin → /dashboard (login bounces signed-in
    // users back). Either is fine — the key signal is we're NOT on /admin.
    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin\/?$/);

    // Switch back via the "رجوع" button (the bar persists on every page).
    await page.goto('/dashboard');
    const back = page.getByRole('button', { name: /رجوع/ });
    await back.click();

    // Bar should leave impersonating state.
    await expect(page.getByText(/تشاهد كـ/)).not.toBeVisible({ timeout: 10_000 });
  });
});

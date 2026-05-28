import { test, expect } from '@playwright/test';

/**
 * D4 ⌘K global search — verifies the palette opens via keyboard and accepts a
 * query. We don't assert specific result rows (data-dependent), only that the
 * palette dialog + input become visible.
 */
test.describe('Command palette', () => {
  test('opens on ⌘K and accepts a query', async ({ page }) => {
    await page.goto('/dashboard');
    // Cross-platform Meta/Ctrl.
    await page.keyboard.press('ControlOrMeta+k');
    const input = page.getByPlaceholder(/بحث|search/i).first();
    await expect(input).toBeVisible();
    await input.fill('test');
    // Either we see "no results" copy or a result list — both are valid.
    await expect(
      page.locator('text=/لا نتائج|projects|clients|equipment|people/i').first(),
    ).toBeVisible({ timeout: 5000 });
  });
});

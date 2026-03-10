const { test, expect } = require('@playwright/test');

test('webkit mobile smoke check', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#trackList li')).toHaveCount(3);
  await expect(page.locator('#trackModeBtn')).toContainText('Piano');
  await expect(page.locator('#viewToggleBtn')).toContainText('全体');
  await expect(page.locator('#emptyStateText')).toContainText('メニューを開いて');
});

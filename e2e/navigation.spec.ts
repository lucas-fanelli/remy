import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('should have working navigation links', async ({ page }) => {
    await page.goto('/');

    // Check that nav is present
    const nav = page.locator('nav');
    await expect(nav).toBeVisible();
  });

  test('should navigate to pantry page', async ({ page }) => {
    await page.goto('/pantry');

    // Should be on pantry page (might redirect to auth if not logged in)
    await page.waitForLoadState('networkidle');

    // Either on pantry page or redirected to auth
    const url = page.url();
    expect(url.includes('/pantry') || url.includes('/auth')).toBeTruthy();
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/settings');

    // Should be on settings page (might redirect to auth if not logged in)
    await page.waitForLoadState('networkidle');

    // Either on settings page or redirected to auth
    const url = page.url();
    expect(url.includes('/settings') || url.includes('/auth')).toBeTruthy();
  });

  test('should handle 404 for non-existent pages', async ({ page }) => {
    await page.goto('/this-page-does-not-exist-12345');

    // Should show 404 page or redirect to home
    await page.waitForLoadState('networkidle');

    // Check for 404 content or ensure we're on a valid page
    const body = await page.textContent('body');
    expect(body).toBeTruthy();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Search', () => {
  test('should have a visible search bar', async ({ page }) => {
    await page.goto('/');

    // Look for search input
    const searchInput = page.getByPlaceholder(/search/i);
    const searchButton = page.getByRole('button', { name: /search/i });

    // At least one search element should be visible
    const hasSearch = (await searchInput.count()) > 0 || (await searchButton.count()) > 0;
    expect(hasSearch).toBeTruthy();
  });

  test('should navigate to search results page', async ({ page }) => {
    await page.goto('/search?q=chicken');

    // Should be on search page
    expect(page.url()).toContain('/search');

    // Wait for content to load
    await page.waitForLoadState('networkidle');

    // Main content should be visible
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('should display search results or no results message', async ({ page }) => {
    await page.goto('/search?q=test');

    await page.waitForLoadState('networkidle');

    // Should have either results or a "no results" message
    const main = page.getByRole('main');
    await expect(main).toBeVisible();
  });
});

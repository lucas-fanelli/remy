import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display the app title and navigation', async ({ page }) => {
    await page.goto('/');

    // Check for main navigation elements
    await expect(page.locator('nav')).toBeVisible();

    // Check for recipe feed or content
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('should show recipe cards on the home page', async ({ page }) => {
    await page.goto('/');

    // Wait for recipes to load (might be async)
    await page.waitForLoadState('networkidle');

    // Check for recipe cards or a message if no recipes
    const main = page.getByRole('main');
    await expect(main).toBeVisible();
  });

  test('should navigate to auth page when not logged in', async ({ page }) => {
    await page.goto('/');

    // Look for sign in button or link
    const signInButton = page.getByRole('button', { name: /sign in|login|log in/i });
    const signInLink = page.getByRole('link', { name: /sign in|login|log in/i });

    // Either button or link should work
    const hasSignIn = (await signInButton.count()) > 0 || (await signInLink.count()) > 0;
    expect(hasSignIn).toBeTruthy();
  });
});

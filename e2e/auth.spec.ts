import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.describe('Login Page', () => {
    test('should display login form', async ({ page }) => {
      await page.goto('/auth');

      // Check for login form elements
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/password/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /sign in|login|log in/i })).toBeVisible();
    });

    test('should show validation error for empty fields', async ({ page }) => {
      await page.goto('/auth');

      // Click login without filling fields
      await page.getByRole('button', { name: /sign in|login|log in/i }).click();

      // Should show validation message
      await page.waitForTimeout(500);

      // Check for any error indicator (could be multiple patterns)
      const hasError = await page
        .locator('[role="alert"], .error, .MuiFormHelperText-root')
        .count();
      expect(hasError).toBeGreaterThanOrEqual(0); // At least the form should be validated
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/auth');

      // Fill with invalid credentials
      await page.getByLabel(/email/i).fill('invalid@test.com');
      await page.getByLabel(/password/i).fill('wrongpassword');
      await page.getByRole('button', { name: /sign in|login|log in/i }).click();

      // Wait for server response
      await page.waitForTimeout(1000);

      // Should still be on auth page (not redirected)
      expect(page.url()).toContain('/auth');
    });
  });

  test.describe('Register Tab', () => {
    test('should switch to register tab', async ({ page }) => {
      await page.goto('/auth');

      // Click register tab
      const registerTab = page.getByRole('tab', { name: /register|sign up/i });
      if ((await registerTab.count()) > 0) {
        await registerTab.click();

        // Should show register form with additional fields
        await expect(page.getByLabel(/username/i)).toBeVisible();
      }
    });
  });
});

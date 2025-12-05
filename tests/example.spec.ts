import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Agent Chat UI/);
});

test('get started link', async ({ page }) => {
  await page.goto('/');

  // Expect an element "to be visible".
  await expect(page.locator('h1')).toBeVisible();
});
import { expect, test } from '@playwright/test';

test('home page renders the project shell', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'GTO-SELF', level: 1 })).toBeVisible();
});

import { expect, test } from '@playwright/test';

test('home page renders the project shell in Korean', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'GTO-SELF', level: 1 })).toBeVisible();
  // The document declares Korean, and the copy is Korean.
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await expect(page.getByTestId('new-session-link')).toHaveText('새 세션');
  await expect(page.locator('main')).toContainText('핸드는 직접 입력합니다');
});

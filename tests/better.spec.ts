// tests/better.spec.ts
import { test, expect } from '@playwright/test';

test('Search for a product on Amazon', async ({ page }) => {
  await page.goto('https://www.amazon.com');
  await page.fill('#twotabsearchtextbox', 'laptop');
  await page.click('#nav-search-submit-button');
  
  
  await expect(page).toHaveTitle('Non-existent title', { timeout: 2000 });
});
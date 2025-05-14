/* eslint-disable testing-library/prefer-screen-queries */
import { test, expect } from '@playwright/test';
// {testing email = cp@cheerchampion.com}
test('test', async ({ page }) => {
  await page.goto('https://www.cheerchampion.com/');


  await page.getByRole('link', { name: 'Login' }).click();
  await expect(page).toHaveURL('https://www.cheerchampion.com/login');



  await page.getByRole('button', { name: 'Request OTP' }).click();


  await page.getByRole('textbox', { name: 'Email Id' }).fill('cp@cheerchampion.com');
  await page.getByRole('button', { name: 'Request OTP' }).click();


   await page.getByText('Enter the OTP sent to your').isVisible();


  await page.getByRole('button', { name: 'Login/Signup' }).isVisible();


  await page.getByRole('textbox', { name: 'OTP' }).click();
  await page.getByRole('textbox', { name: 'OTP' }).fill('153966');
  await page.getByRole('button', { name: 'Login/Signup' }).click();



  await expect(page).toHaveURL('https://www.cheerchampion.com/');



  await page.getByRole('heading', { name: 'Type Message' }).click();

  await page.getByRole('textbox', { name: 'E.g. Hey Jen! You were' }).click();
  await page.getByRole('textbox', { name: 'E.g. Hey Jen! You were' }).fill('test');


  await page.getByRole('button', { name: 'Next >>' }).click();
  await page.getByRole('heading', { name: 'Select Image / GIF' }).click();


 


  await page.locator('.giphy-gif').first().click();



  await expect(page).toHaveURL('https://www.cheerchampion.com/kudo/recipients');




  await page.getByRole('heading', { name: 'Preview' }).click();
  await page.getByRole('img', { name: 'Image' }).click();
  await page.getByText('test').isVisible();




  await page.getByRole('textbox', { name: 'Email Id' }).click();
  await page.getByRole('textbox', { name: 'Email Id' }).fill('raj.mansuri@quantuminfoway.com');
  await page.getByRole('button', { name: 'Send' }).click();
  await page.getByRole('img', { name: 'SuccessImage' }).click();

  await page.getByRole('link', { name: 'Go To Feed' }).click();

  await expect(page).toHaveURL('https://www.cheerchampion.com/feeds');

  const cards = page.locator('.col-span-1');

  const firstCard = cards.first();

  const textContent = firstCard.locator('div.p-3.lg\\:p-4.font-libre.font-normal.text-600');

  await expect(textContent).toHaveText('test');

});

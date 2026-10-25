import { expect, test } from '@playwright/test';

test('debug country focus order', async ({ page }) => {
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email address').fill('sara.benali@example.edu');
  await page.getByLabel('Password').fill('PrototypePass1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.goto('/onboarding');
  await page.getByRole('button', { name: 'Start here' }).first().click();
  await page.getByRole('radio', { name: /Study in another country/ }).click();
  await page.getByRole('radio', { name: 'Research internship' }).click();
  await expect(
    page.getByRole('heading', { name: 'Where could you realistically study or work?' }),
  ).toBeVisible();

  const search = page.getByLabel('Search countries');
  await search.click();
  await search.fill('Nether');

  const probe = async (label: string) =>
    console.log(
      label,
      await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return 'none';
        return `${el.tagName}#${el.id}[type=${(el as HTMLInputElement).type ?? ''}] "${(el as HTMLInputElement).getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 60) ?? ''}"`;
      }),
    );

  await probe('after fill:');
  await page.keyboard.press('Tab');
  await probe('tab1:');
  await page.keyboard.press('Tab');
  await probe('tab2:');
  await page.keyboard.press('Tab');
  await probe('tab3:');
});

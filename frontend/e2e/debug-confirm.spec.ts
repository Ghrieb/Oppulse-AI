import { expect, test } from '@playwright/test';

/** Temporary diagnostic: what happens on the confirm PATCH? */
test('debug confirm fact', async ({ page }) => {
  page.on('console', (m) => console.log(`[console.${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}`));
  page.on('response', async (r) => {
    if (r.url().includes('/api/v1/profile')) {
      console.log(`[net] ${r.request().method()} ${r.url()} -> ${r.status()}`);
      if (r.request().method() === 'PATCH') {
        try {
          console.log('[net] PATCH body:', r.request().postData());
          console.log('[net] PATCH response:', (await r.text()).slice(0, 300));
        } catch {
          /* ignore */
        }
      }
    }
  });

  await page.goto('/auth/sign-in');
  await page.getByLabel('Email address').fill('sara.benali@example.edu');
  await page.getByLabel('Password').fill('PrototypePass1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  await page.goto('/profile');
  await page.getByRole('button', { name: 'Languages and certificates' }).click();
  await page.getByRole('button', { name: /English \(CEFR\)/ }).click();
  await expect(page.getByText(/Holding up \d+ requirement/)).toBeVisible();

  console.log('--- clicking Confirm ---');
  await page.getByRole('button', { name: 'Confirm' }).click();

  // Give it time, then dump the state.
  await page.waitForTimeout(4000);
  const body = await page.locator('main').innerText();
  console.log('--- MAIN after confirm ---\n' + body);
  const settled = await page
    .getByText('Every requirement that depends on this is settled.')
    .count();
  console.log('--- settled message count:', settled);
});

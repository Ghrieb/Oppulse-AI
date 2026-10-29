import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

/**
 * The privacy journeys.
 *
 * Two rules that the interface has to make visible, not just implement:
 * no email goes to an unverified address, and a date of birth is used only
 * to check an age rule — and is never shown again in the answer.
 */

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];

  page.on('console', (message: ConsoleMessage) => {
    if (message.type() !== 'error') return;
    errors.push(message.text());
  });
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });

  return errors;
}

async function signIn(page: Page): Promise<void> {
  await page.goto('/auth/sign-in');
  await page.getByLabel('Email address').fill('sara.benali@example.edu');
  await page.getByLabel('Password').fill('PrototypePass1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('main')).toBeVisible();
}

test('the first MVP delivers in-app alerts only, and does not advertise email', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);

  await signIn(page);
  await page.goto('/settings');

  // In-app is the only channel, and the interface says so plainly rather
  // than offering a control that cannot deliver anything.
  await expect(page.getByText('In-app only, for now')).toBeVisible();
  await expect(page.getByText(/Email notifications are not available yet/)).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Daily digest' })).toHaveCount(0);

  // And the capability strip does not claim email is live. (The public
  // landing page lives at `/` since guests can explore; the strip is on
  // the signed-in workspace.)
  await page.goto('/home');
  await expect(page.getByText('Email notifications')).toBeVisible();
  await expect(page.getByText('Not configured').first()).toBeVisible();

  // The alert list still shows every alert in the app.
  await page.goto('/monitoring');
  await page.getByRole('tab', { name: /Alerts/ }).click();
  await expect(page.getByRole('heading', { name: /funding increased/ })).toBeVisible();

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('a date of birth decides an age requirement, and is never shown in the answer', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);

  await signIn(page);

  // Before: the age requirement is unresolved, because the date is unknown.
  await page.goto('/opportunities');
  await page.getByRole('link', { name: 'Meridian AI Summer School 2027' }).first().click();
  await page.getByRole('tab', { name: 'Eligibility' }).click();
  await expect(page.getByText(/date of birth is not available/)).toBeVisible();

  // Give a date in the passport.
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Protected details' }).click();
  await page.getByRole('button', { name: 'Add it' }).click();
  await page.getByLabel('Your date of birth').fill('2004-03-12');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Your date of birth is saved').first()).toBeVisible();

  // After: the requirement is decided, and the answer never repeats the date.
  await page.goto('/opportunities');
  await page.getByRole('link', { name: 'Meridian AI Summer School 2027' }).first().click();
  await page.getByRole('tab', { name: 'Eligibility' }).click();

  await expect(page.getByText(/The age requirement appears satisfied/)).toBeVisible();
  await expect(page.getByText('2004-03-12')).toHaveCount(0);

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

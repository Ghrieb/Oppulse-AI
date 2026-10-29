import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

/**
 * The live-mode journeys.
 *
 * The same product, running against the real FastAPI service instead of the
 * mock. It runs only when the frontend is in live mode:
 *
 *     pwsh scripts/run-live-journeys.ps1
 *
 * Two things differ from the demo mode, and both are deliberate:
 *
 * - there is no "sample data" banner, because the data is not synthetic;
 * - the capabilities say what is actually live, per service.
 */

const LIVE = process.env.LIVE === '1';

test.describe('the live service', () => {
  test.skip(!LIVE, 'Only runs against the local FastAPI service.');

  function collectConsoleErrors(page: Page): string[] {
    const errors: string[] = [];

    page.on('console', (message: ConsoleMessage) => {
      if (message.type() !== 'error') return;
      // A signed-out visitor legitimately triggers a 401 when the session
      // is checked. The browser logs it; it is not a defect.
      if (message.text().includes('401')) return;
      errors.push(message.text());
    });
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    return errors;
  }

  test('the capability menu says what is actually live', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto('/');
    // The public landing page makes no capability claim at all.
    await expect(page.getByText('What works right now')).toHaveCount(0);

    // Signed in, the shell states it per service.
    await page.goto('/auth/sign-in');
    await page.getByLabel('Email address').fill('sara.benali@example.edu');
    await page.getByLabel('Password').fill('PrototypePass1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/onboarding/);
    await page.goto('/home');
    await expect(page.getByRole('heading', { name: /Hi Sara!/ })).toBeVisible();

    await page.getByRole('button', { name: /Live API/ }).click();
    const menu = page.getByRole('menu');
    await expect(menu.getByText('Connection status')).toBeVisible();
    const rows = menu.getByRole('listitem');
    await expect(
      rows.filter({ hasText: 'Profile and opportunities' }).getByText('Live'),
    ).toBeVisible();

    // No provider key is configured in this run, so the reasoning and the
    // search are honestly reported as simulated, and monitoring as
    // not configured.
    await expect(rows.filter({ hasText: 'AI reasoning' }).getByText('Simulated')).toBeVisible();
    await expect(
      rows.filter({ hasText: 'Change monitoring' }).getByText('Not configured'),
    ).toBeVisible();

    expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('the demo student signs in and reaches the workspace', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto('/auth/sign-in');
    await page.getByLabel('Email address').fill('sara.benali@example.edu');
    await page.getByLabel('Password').fill('PrototypePass1');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // The sign-in page sends the student to the onboarding by default.
    await expect(page).toHaveURL(/\/onboarding/);
    await page.goto('/home');
    await expect(page.getByRole('heading', { name: /Hi Sara!/ })).toBeVisible();

    // The opportunities came from the service, not from a fixture in the
    // browser.
    await expect(page.getByText('Netherlands').first()).toBeVisible();

    expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('the next action comes from the service', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto('/auth/sign-in');
    await page.getByLabel('Email address').fill('sara.benali@example.edu');
    await page.getByLabel('Password').fill('PrototypePass1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    // The sign-in page sends the student to the onboarding by default.
    await expect(page).toHaveURL(/\/onboarding/);
    await page.goto('/home');

    await expect(page.getByText('Next best action')).toBeVisible();
    await expect(page.getByText(/Confirm your English/i)).toBeVisible();

    expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('confirming a fact resolves the requirement it was blocking', async ({ page }) => {
    const errors = collectConsoleErrors(page);

    await page.goto('/auth/sign-in');
    await page.getByLabel('Email address').fill('sara.benali@example.edu');
    await page.getByLabel('Password').fill('PrototypePass1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    // The sign-in page sends the student to the onboarding by default.
    await expect(page).toHaveURL(/\/onboarding/);
    await page.goto('/home');

    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'My profile' })).toBeVisible();
    await page.getByRole('button', { name: 'Languages and certificates' }).click();
    await page.getByRole('button', { name: /English \(CEFR\)/ }).click();

    await expect(page.getByText(/Holding up \d+ requirement/)).toBeVisible();

    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(
      page.getByText('Every requirement that depends on this is settled.'),
    ).toBeVisible();

    // And the opportunity agrees.
    await page.goto('/opportunities');
    await page
      .getByRole('link', { name: 'Helios Research Fellowship in Computational Biology' })
      .first()
      .click();
    await page.getByRole('tab', { name: 'Eligibility' }).click();
    await expect(
      page.getByText(/Your confirmed english \(cefr\) — B2 \(IELTS 6\.5\) — satisfies/i),
    ).toBeVisible();

    expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('the protected date of birth decides an age requirement, and is not repeated', async ({
    page,
  }) => {
    const errors = collectConsoleErrors(page);

    await page.goto('/auth/sign-in');
    await page.getByLabel('Email address').fill('sara.benali@example.edu');
    await page.getByLabel('Password').fill('PrototypePass1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    // The sign-in page sends the student to the onboarding by default.
    await expect(page).toHaveURL(/\/onboarding/);
    await page.goto('/home');

    await page.goto('/profile');
    await page.getByRole('button', { name: 'Protected details' }).click();
    await page.getByRole('button', { name: 'Add it' }).click();
    await page.getByLabel('Your date of birth').fill('2004-03-12');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Your date of birth is saved').first()).toBeVisible();

    await page.goto('/opportunities');
    await page.getByRole('link', { name: 'Meridian AI Summer School 2027' }).first().click();
    await page.getByRole('tab', { name: 'Eligibility' }).click();
    await expect(page.getByText(/The age requirement appears satisfied/)).toBeVisible();
    await expect(page.getByText('2004-03-12')).toHaveCount(0);

    expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
  });
});

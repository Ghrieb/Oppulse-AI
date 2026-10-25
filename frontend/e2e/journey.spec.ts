import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

/**
 * The complete user journey.
 *
 * This is the demo path a judge will follow: land on the public page, start
 * with a goal, answer a short adaptive sequence, review the mission, run
 * the research, then read the findings, the evidence, the application
 * workspace, the draft proposal and the monitoring alerts.
 *
 * The test fails on any console error, so a broken page cannot pass.
 */

function collectConsoleErrors(page: Page, options: { allowUnauthorized?: boolean } = {}): string[] {
  const errors: string[] = [];

  page.on('console', (message: ConsoleMessage) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // A signed-out visitor legitimately triggers a 401 when the session is
    // checked. The browser logs it; it is not a defect.
    if (options.allowUnauthorized && text.includes('401')) return;
    errors.push(text);
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

test('a visitor can understand Oppulse before registering', async ({ page }) => {
  const errors = collectConsoleErrors(page, { allowUnauthorized: true });

  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      name: /Find the opportunities worth your time/i,
    }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Explore opportunities' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Upload my CV' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Analyse an opportunity' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Explore opportunities/i }).first()).toBeVisible();

  await expect(page.getByText('Evidence attached to every important claim')).toBeVisible();
  await expect(page.getByText('What works right now')).toHaveCount(0);

  expect(errors, `Console errors during the landing page:\n${errors.join('\n')}`).toEqual([]);
});

test('starting with a goal routes through registration to onboarding', async ({ page }) => {
  const errors = collectConsoleErrors(page, { allowUnauthorized: true });

  await page.goto('/');
  await page.getByRole('button', { name: 'Start with my goal' }).last().click();

  // A signed-out visitor is sent to register, and the destination is kept.
  await expect(page).toHaveURL(/\/auth\/sign-up/);
  await expect(page.getByRole('heading', { name: 'Create your workspace' })).toBeVisible();

  await page.getByLabel('Full name').fill('Sara Benali');
  await page.getByLabel('Email address').fill('sara.benali@example.edu');
  await page.getByLabel('Password').fill('PrototypePass1');
  await page.getByRole('button', { name: 'Create my workspace' }).click();

  // The intended destination is honoured: onboarding, not a generic home.
  await expect(page).toHaveURL(/\/onboarding/);
  await expect(page.getByRole('heading', { name: 'Let Oppulse get to know you' })).toBeVisible();

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('a signed-in student walks through the real onboarding flow', async ({ page }) => {
  const errors = collectConsoleErrors(page, { allowUnauthorized: true });

  await signIn(page);
  await page.goto('/onboarding');
  await expect(page.getByRole('heading', { name: 'How would you like to start?' })).toBeVisible();

  // The demo profile already answers three questions, so the agent skips them.
  await expect(page.getByText(/answered from your confirmed profile/i)).toBeVisible();

  await page.getByRole('button', { name: 'Start here' }).first().click();

  await expect(
    page.getByRole('heading', { name: 'What are you hoping to achieve?' }),
  ).toBeVisible();
  await page.getByRole('radio', { name: /Study in another country/ }).click();

  await expect(
    page.getByRole('heading', { name: 'Which type of opportunity are you considering?' }),
  ).toBeVisible();
  await page.getByRole('radio', { name: 'Research internship' }).click();

  await expect(
    page.getByRole('heading', { name: 'Where could you realistically study or work?' }),
  ).toBeVisible();
  await page.getByRole('checkbox', { name: /Netherlands/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(
    page.getByRole('heading', { name: 'What does funding need to cover for you?' }),
  ).toBeVisible();
  await page.getByRole('radio', { name: 'Fully funded' }).click();

  // A research internship can carry an age limit, so the agent asks for the
  // date of birth — and the student is allowed to decline.
  await expect(page.getByRole('heading', { name: 'What is your date of birth?' })).toBeVisible();
  await expect(page.getByText(/Some age-restricted checks may stay unresolved/)).toBeVisible();
  await page.getByRole('button', { name: 'Prefer not to say' }).click();

  // Every other question was answered from the confirmed profile, so the
  // mission preview is already waiting.
  await expect(page.getByRole('heading', { name: 'Here is what I will do' })).toBeVisible();
  await expect(page.getByText('What this mission cannot promise')).toBeVisible();

  // And it can be edited before anything runs.
  await page.getByRole('button', { name: 'Change' }).first().click();
  await expect(page.getByRole('radio', { name: 'Show me a range' })).toBeVisible();

  await page.getByRole('button', { name: 'Run research' }).click();
  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByRole('heading', { name: /Hi Sara!/ })).toBeVisible();
  expect(errors, `Console errors during onboarding:\n${errors.join('\n')}`).toEqual([]);
});

test('a student can complete the primary journey', async ({ page }) => {
  const errors = collectConsoleErrors(page);

  // 1. Sign in.
  await signIn(page);

  // 2. The workspace loads with the agent, the results and the detail panel.
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: /Hi Sara!/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Top opportunities' })).toBeVisible();

  // 2a. The action hierarchy: what Oppulse is working on, then what to do next.
  await expect(page.getByText('Active mission')).toBeVisible();
  await expect(page.getByText('Next best action')).toBeVisible();
  await expect(page.getByRole('link', { name: /Review the fact/i })).toBeVisible();

  // 2b. The mission strip shows the real last run and next check.
  await expect(page.getByText(/Last run/i)).toBeVisible();
  await expect(page.getByText(/Next check/i)).toBeVisible();

  // 3. The fit score is explicitly not an admission probability.
  await expect(
    page.getByRole('img', { name: /not an admission probability/i }).first(),
  ).toBeVisible();

  // 3a. A list card shows the country and the institution identity.
  await expect(page.getByText('Netherlands').first()).toBeVisible();
  await expect(
    page.getByRole('img', { name: /Helios Institute for Applied Genomics mark/i }),
  ).toBeVisible();

  // 4. Open the deepest analysis of an opportunity.
  await page.goto('/opportunities');
  await page
    .getByRole('link', { name: 'Helios Research Fellowship in Computational Biology' })
    .first()
    .click();
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Helios Research Fellowship in Computational Biology',
    }),
  ).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Eligibility' })).toBeVisible();

  // 5. The eligibility tab explains each requirement.
  await page.getByRole('tab', { name: 'Eligibility' }).click();
  await expect(page.getByText(/Enrolled in a Master/)).toBeVisible();

  // 6. The evidence is reachable and cites a source.
  await page.getByRole('tab', { name: 'Evidence' }).click();
  await expect(page.getByRole('heading', { name: 'Source references' })).toBeVisible();
  await page.getByRole('button', { name: 'Open drawer' }).click();
  await expect(page.getByRole('dialog', { name: 'Source evidence' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  // 7. The application workspace shows a checklist and a next action.
  await page.goto('/applications');
  await expect(page.getByRole('heading', { name: 'Application workspace' })).toBeVisible();
  await page.getByRole('link', { name: 'Continue application' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Next best action:')).toBeVisible();

  // 8. The writing studio shows a reviewable proposal, not an applied edit.
  await page.goto('/writing/60000000-0000-4000-8000-000000000001');
  await expect(page.getByRole('heading', { name: /Motivation letter/ })).toBeVisible();
  await expect(page.getByText('Proposal ready')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reject' })).toBeVisible();

  // 9. Monitoring shows real check times, not a live promise.
  await page.goto('/monitoring');
  await expect(page.getByRole('heading', { name: 'Monitoring and alerts' })).toBeVisible();
  await expect(page.getByText('Last successful check').first()).toBeVisible();
  await expect(page.getByText('Next scheduled check').first()).toBeVisible();

  // 10. The profile requires confirmation of extracted facts.
  await page.goto('/documents');
  await expect(page.getByRole('heading', { name: 'My documents' })).toBeVisible();
  await expect(page.getByText(/facts waiting for your confirmation/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Review in your passport' })).toBeVisible();

  expect(errors, `Console errors during the journey:\n${errors.join('\n')}`).toEqual([]);
});

test('a protected route sends a signed-out visitor to sign in and back again', async ({ page }) => {
  const errors = collectConsoleErrors(page, { allowUnauthorized: true });

  await page.goto('/documents');
  await expect(page).toHaveURL(/\/auth\/sign-in\?next=/);

  await page.getByLabel('Email address').fill('sara.benali@example.edu');
  await page.getByLabel('Password').fill('PrototypePass1');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // The intended destination is restored.
  await expect(page).toHaveURL(/\/documents/);
  await expect(page.getByRole('heading', { name: 'My documents' })).toBeVisible();

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('confirming a fact in the passport resolves the requirement it was blocking', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page, { allowUnauthorized: true });

  await signIn(page);

  // The passport opens on the profile, with the completeness ring and the
  // section navigation.
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'My profile' })).toBeVisible();
  await expect(page.getByText('Profile completeness')).toBeVisible();

  // Find the fact that is holding a requirement up.
  await page.getByRole('button', { name: 'Languages and certificates' }).click();
  await page.getByRole('button', { name: /English \(CEFR\)/ }).click();

  await expect(page.getByText(/Holding up \d+ requirement/)).toBeVisible();
  await expect(page.getByText('From IELTS_2025.pdf')).toBeVisible();

  // Confirm it.
  await page.getByRole('button', { name: 'Confirm' }).click();

  // The requirement it was blocking is now settled.
  await expect(page.getByText('Every requirement that depends on this is settled.')).toBeVisible();

  // And the opportunity agrees.
  await page.goto('/opportunities');
  await page
    .getByRole('link', { name: 'Helios Research Fellowship in Computational Biology' })
    .first()
    .click();
  await page.getByRole('tab', { name: 'Eligibility' }).click();

  const requirement = page.getByText('English proficiency').first();
  await expect(requirement).toBeVisible();
  await expect(
    page.getByText(/Your confirmed english \(cefr\) — B2 \(IELTS 6\.5\) — satisfies/i),
  ).toBeVisible();

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('the opportunities list makes no image requests', async ({ page }) => {
  const imageRequests: string[] = [];

  page.on('request', (request) => {
    if (request.resourceType() === 'image') imageRequests.push(request.url());
  });

  await signIn(page);
  await page.goto('/opportunities');
  await expect(page.getByRole('heading', { name: 'Opportunities' })).toBeVisible();
  await page.waitForTimeout(1500);

  // Institution identity is generated locally. The shared shell logo is the
  // only expected image request on this route.
  expect(
    imageRequests.filter((url) => !url.endsWith('/brand/oppulse-mark-white.svg')),
    `Unexpected image requests:\n${imageRequests.join('\n')}`,
  ).toEqual([]);
});

test('every primary route renders without console errors', async ({ page }) => {
  const errors = collectConsoleErrors(page);

  await signIn(page);

  const routes = [
    '/home',
    '/goals',
    '/opportunities',
    '/documents',
    '/applications',
    '/monitoring',
    '/assistant',
    '/settings',
  ];

  for (const route of routes) {
    await page.goto(route);
    await expect(page.getByRole('main')).toBeVisible();
    // The prototype banner must be visible: a judge must never mistake a
    // prototype for a working product.
    await expect(page.getByText('Prototype data')).toBeVisible();
  }

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

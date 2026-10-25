import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

/**
 * Journey 7 — the run's progress, pause, cancel and failure.
 *
 * A research run is the product's central promise, so the student must be
 * able to watch it, stop it, and see an honest answer when it cannot even
 * start. The mock backend derives run progress from the clock, so this
 * journey exercises the same request path production will.
 */

declare global {
  interface Window {
    /** Development-only chaos switch, attached by the mock worker. */
    __oppulse?: {
      chaos: {
        set: (rule: {
          pattern: string;
          mode: 'error' | 'slow' | 'empty' | 'offline';
          status?: number;
          delayMs: number;
        }) => void;
        clear: () => void;
      };
    };
  }
}

function collectConsoleErrors(
  page: Page,
  options: { allowUnauthorized?: boolean; allowFailedResource?: boolean } = {},
): string[] {
  const errors: string[] = [];

  page.on('console', (message: ConsoleMessage) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (options.allowUnauthorized && text.includes('401')) return;
    // An intentionally failed request is logged by the browser as a failed
    // resource; the application still reports it in its own words.
    if (options.allowFailedResource && text.includes('Failed to load resource')) return;
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

test('a run can be watched, paused, resumed and cancelled', async ({ page }) => {
  const errors = collectConsoleErrors(page, { allowUnauthorized: true });

  await signIn(page);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: /Hi Sara!/ })).toBeVisible();

  // Start a run from the strip.
  await page.getByRole('button', { name: 'Run research' }).click();

  // The run is in flight: the badge says so, and pause and cancel appear.
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole('button', { name: 'Cancel run' })).toBeVisible();
  await expect(page.getByText('Queued').or(page.getByText('Researching')).first()).toBeVisible();

  // Pause: the timeline freezes and the badge says the run is paused.
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText('Research paused').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0);

  // Resume: pause comes back.
  await page.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole('button', { name: 'Resume', exact: true })).toHaveCount(0);

  // Cancel: the run stops for good, says so, and the strip offers a fresh run.
  await page.getByRole('button', { name: 'Cancel run' }).click();
  await expect(page.getByText('Run cancelled')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run research' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel run' })).toHaveCount(0);

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('a run that cannot start says so and queues nothing', async ({ page }) => {
  const errors = collectConsoleErrors(page, { allowUnauthorized: true, allowFailedResource: true });

  await signIn(page);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: /Hi Sara!/ })).toBeVisible();

  // The provider is down for run requests only — the same chaos switch the
  // in-app developer console uses, so the failure runs through the real
  // client and the real error mapping.
  await page.evaluate(() => {
    window.__oppulse?.chaos.set({ pattern: '/runs', mode: 'error', status: 503, delayMs: 0 });
  });

  await page.getByRole('button', { name: 'Run research' }).click();

  // The failure is named, not swallowed, and nothing pretends to be running.
  await expect(page.getByText('We could not start the research run', { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await page.evaluate(() => window.__oppulse?.chaos.clear());
  await expect(page.getByRole('button', { name: 'Run research' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancel run' })).toHaveCount(0);

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

/* -------------------------------------------------------------------------- *
 * C3.6 — the connection-critical journeys the spec still had gaps in:        *
 * 2 (no-CV start), 3 (upload stays honest), 4 (exclude un-settles),          *
 * 5 (declined date of birth), 6 (keyboard country select), 8 (unreachable    *
 * source), 11 (media states), 14 (expired session), 15 (capability labels).  *
 * -------------------------------------------------------------------------- */

test('a new student can start from documents and finish onboarding without uploading', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page, { allowUnauthorized: true });

  // The CV entry point keeps its destination through registration.
  await page.goto('/');
  await page.getByRole('button', { name: 'Upload my CV' }).click();
  await expect(page).toHaveURL(/\/auth\/sign-up/);
  await page.getByLabel('Full name').fill('Sara Benali');
  await page.getByLabel('Email address').fill('sara.benali@example.edu');
  await page.getByLabel('Password').fill('PrototypePass1');
  await page.getByRole('button', { name: 'Create my workspace' }).click();

  await expect(page).toHaveURL(/\/onboarding\?intent=materials/);
  await expect(page.getByRole('heading', { name: 'Upload your documents' })).toBeVisible();

  // No file? Then answer the questions — nothing demands an upload.
  await page
    .getByRole('button', { name: 'Skip for now — I will just answer the questions' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'What are you hoping to achieve?' }),
  ).toBeVisible();
  await page.getByRole('radio', { name: /I am not sure yet/ }).click();

  // One answer is enough to derive a mission; the rest can be skipped honestly.
  await page.getByRole('button', { name: 'Skip the rest and show me the mission' }).click();
  await expect(page.getByRole('heading', { name: 'Here is what I will do' })).toBeVisible();
  await page.getByRole('button', { name: 'Run research' }).click();

  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByRole('heading', { name: /Hi Sara!/ })).toBeVisible();

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('an upload is read as processing, and claims nothing until confirmed', async ({ page }) => {
  const errors = collectConsoleErrors(page, { allowUnauthorized: true });

  await signIn(page);
  await page.goto('/documents');
  await expect(page.getByRole('heading', { name: 'My documents' })).toBeVisible();

  // Facts a document already proposed wait for confirmation, and say so.
  const pending = page.getByText(/facts? waiting for your confirmation/);
  await expect(pending).toBeVisible();
  const pendingText = await pending.innerText();
  await expect(
    page.getByText('Unconfirmed facts are not used to decide your eligibility.'),
  ).toBeVisible();
  await expect(
    page.getByText(
      'We found facts in this document that you have not confirmed yet. Nothing from it is used for matching until you confirm it.',
    ),
  ).toBeVisible();
  await expect(
    page.getByText(/Read successfully\. \d+ profile facts? proposed from it\./),
  ).toBeVisible();

  // A fresh upload is honestly still being read, and proposes nothing yet.
  await page.locator('input[type="file"]').setInputFiles({
    name: 'recommendation_letter.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n% simulated upload for the C3.6 journey\n'),
  });
  await expect(page.getByText('Document received', { exact: true })).toBeVisible();
  await expect(page.locator('[aria-label="Processing: recommendation_letter.pdf"]')).toBeVisible();
  await expect(
    page.getByText(
      'Reading the text in your document. You can leave this page — it will keep working.',
    ),
  ).toBeVisible();
  await expect(page.locator('[aria-label="Ready: recommendation_letter.pdf"]')).toHaveCount(0);

  // The processing document adds no claim of any kind: the count does not move.
  await expect(pending).toHaveText(pendingText);

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('excluding a fact un-settles the requirement it was holding up', async ({ page }) => {
  const errors = collectConsoleErrors(page, { allowUnauthorized: true });

  await signIn(page);

  // Settle the fact first, so there is something to take back.
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'My profile' })).toBeVisible();
  await page.getByRole('button', { name: 'Languages and certificates' }).click();
  await page.getByRole('button', { name: /English \(CEFR\)/ }).click();
  await expect(page.getByText(/Holding up \d+ requirement/)).toBeVisible();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Every requirement that depends on this is settled.')).toBeVisible();

  // The opportunity agrees while the fact counts.
  await page.goto('/opportunities');
  await page
    .getByRole('link', { name: 'Helios Research Fellowship in Computational Biology' })
    .first()
    .click();
  await page.getByRole('tab', { name: 'Eligibility' }).click();
  const satisfied = page.getByText(
    /Your confirmed english \(cefr\) — B2 \(IELTS 6\.5\) — satisfies/i,
  );
  await expect(satisfied).toBeVisible();

  // Take the fact back out of the agent's context.
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Languages and certificates' }).click();
  await page.getByRole('button', { name: /English \(CEFR\)/ }).click();
  await page.getByRole('button', { name: 'Exclude from AI use' }).click();
  await expect(page.getByText('Every requirement that depends on this is settled.')).toHaveCount(0);
  await expect(page.getByText('Requirements that depend on it stay unresolved.')).toBeVisible();

  // And the opportunity un-settles with it — no stale claim is left behind.
  await page.goto('/opportunities');
  await page
    .getByRole('link', { name: 'Helios Research Fellowship in Computational Biology' })
    .first()
    .click();
  await page.getByRole('tab', { name: 'Eligibility' }).click();
  await expect(satisfied).toHaveCount(0);

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('declining the date of birth keeps the age check unresolved, and says why', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page, { allowUnauthorized: true });

  await signIn(page);
  await page.goto('/onboarding');
  await expect(page.getByRole('heading', { name: 'How would you like to start?' })).toBeVisible();
  await page.getByRole('button', { name: 'Start here' }).first().click();

  // A research internship can carry an age limit, so the date is asked for.
  await page.getByRole('radio', { name: /Study in another country/ }).click();
  await page.getByRole('radio', { name: 'Research internship' }).click();
  await page.getByRole('checkbox', { name: /Netherlands/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('radio', { name: 'Fully funded' }).click();
  await expect(page.getByRole('heading', { name: 'What is your date of birth?' })).toBeVisible();
  await page.getByRole('button', { name: 'Prefer not to say' }).click();
  await expect(page.getByRole('heading', { name: 'Here is what I will do' })).toBeVisible();
  await page.getByRole('button', { name: 'Run research' }).click();
  await expect(page).toHaveURL(/\/home/);

  // The refusal is recorded as a refusal, not as a missing value.
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Protected details' }).click();
  await expect(
    page.getByText('You chose not to share it. Age requirements stay unresolved.'),
  ).toBeVisible();

  // After the run, the age-restricted opportunity is still honestly unresolved.
  await page.goto('/opportunities');
  await page.getByRole('link', { name: 'Meridian AI Summer School 2027' }).first().click();
  await page.getByRole('tab', { name: 'Eligibility' }).click();
  await expect(
    page.getByText(/Your date of birth is not available, so this age requirement stays unresolved/),
  ).toBeVisible();

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('the country step supports accessible selection and keyboard removal', async ({ page }) => {
  const errors = collectConsoleErrors(page, { allowUnauthorized: true });

  await signIn(page);
  await page.goto('/onboarding');
  await expect(page.getByRole('heading', { name: 'How would you like to start?' })).toBeVisible();
  await page.getByRole('button', { name: 'Start here' }).first().click();
  await page.getByRole('radio', { name: /Study in another country/ }).click();
  await page.getByRole('radio', { name: 'Research internship' }).click();
  await expect(
    page.getByRole('heading', { name: 'Where could you realistically study or work?' }),
  ).toBeVisible();

  // "Global" explains itself before any country is chosen.
  await expect(page.getByText('Show me anywhere. This is not a country.')).toBeVisible();

  const search = page.getByLabel('Search countries');
  await search.click();
  await search.fill('Nether');
  const netherlands = page.getByRole('checkbox', { name: /Netherlands/ });
  await page.getByText('Netherlands', { exact: true }).click();
  await expect(netherlands).toBeChecked();
  await expect(page.getByRole('list', { name: 'Selected countries' })).toBeVisible();
  const chip = page.getByRole('button', { name: /Remove Netherlands/ });
  await expect(chip).toBeVisible();

  // The chip removes it just as plainly, also from the keyboard.
  await chip.focus();
  await chip.press('Enter');
  await expect(chip).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /Netherlands/ })).not.toBeChecked();

  // A country that does not exist says so instead of showing nothing.
  await search.click();
  await search.fill('Atlantis');
  await expect(page.getByText(/No country matches .Atlantis./)).toBeVisible();

  // Select it again, and carry the choice into the mission.
  await search.fill('Nether');
  await page.getByText('Netherlands', { exact: true }).click();
  await expect(chip).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(
    page.getByRole('heading', { name: 'What does funding need to cover for you?' }),
  ).toBeVisible();

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('an unreachable source is reported honestly, and the results it could not read still appear', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page, { allowUnauthorized: true });

  await signIn(page);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: /Hi Sara!/ })).toBeVisible();

  // The run found opportunities and still names the source it could not reach.
  await expect(page.getByText('7 found')).toBeVisible();
  await expect(page.getByText('A source could not be checked')).toBeVisible();

  // The alert says the check failed — not that the programme is gone.
  await page.goto('/monitoring');
  await expect(page.getByRole('heading', { name: 'Monitoring and alerts' })).toBeVisible();
  await page.getByRole('tab', { name: /Alerts/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Northwind Summer Research Programme could not be checked' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      'The scheduled check did not reach the source. No conclusion is drawn about the programme. Open the page manually or upload the announcement PDF.',
    ),
  ).toBeVisible();

  // The list is not empty because one source failed: the partial result stands.
  await page.goto('/opportunities');
  await expect(
    page.getByText(
      'We could not verify anything about this programme. Open the official page or upload the announcement PDF so we can analyse it properly.',
    ),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Northwind Summer Research Programme' }).first().click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Northwind Summer Research Programme' }),
  ).toBeVisible();
  await expect(
    page.getByText(
      /could not open the official page, so nothing about this programme is verified yet/,
    ),
  ).toBeVisible();
  await expect(page.getByText('No deadline has been verified yet.').first()).toBeVisible();
  await expect(
    page.getByText(
      'The official announcement could not be reached, so no requirement has been verified for this programme.',
    ),
  ).toBeVisible();
  await page.getByRole('tab', { name: 'Eligibility' }).click();
  await expect(
    page.getByText(
      'We could not open the official announcement, so the requirements have not been extracted. Open the official page or upload the announcement PDF to complete this analysis.',
    ),
  ).toBeVisible();

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('the assistant shows every media state and links only what still exists', async ({ page }) => {
  const errors = collectConsoleErrors(page, { allowUnauthorized: true });

  await signIn(page);
  await page.goto('/opportunities');
  await page
    .getByRole('link', { name: 'Helios Research Fellowship in Computational Biology' })
    .first()
    .click();
  await page.getByRole('button', { name: 'Ask about this opportunity' }).click();
  await expect(page).toHaveURL(/\/assistant/);

  await page.getByLabel('Message to Oppulse').fill('What does the official page show?');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('Media context — secondary source')).toBeVisible();
  await expect(
    page.getByText(
      'What the official page for Helios Research Fellowship in Computational Biology shows',
    ),
  ).toBeVisible();

  // What still exists keeps its link...
  await expect(page.getByRole('link', { name: /introduction/ })).toBeVisible();
  await expect(page.getByText('Not reviewed')).toBeVisible();

  // ...and what is gone is named, explained, and never linked.
  await expect(page.getByText('Unavailable')).toBeVisible();
  await expect(
    page.getByText('This asset could not be opened, so what it shows is not claimed here.'),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /prospectus/ })).toHaveCount(0);
  await expect(page.getByText('Removed')).toBeVisible();
  await expect(page.getByText('The page no longer carries this asset.')).toBeVisible();
  await expect(page.getByRole('link', { name: /campus tour/ })).toHaveCount(0);

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('an expired session sends the student to sign-in and back to where they were', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page, {
    allowUnauthorized: true,
    allowFailedResource: true,
  });

  await signIn(page);
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'My profile' })).toBeVisible();

  // The session ends server-side while the passport is open.
  await page.evaluate(() => {
    window.__oppulse?.chaos.set({
      pattern: '/opportunities',
      mode: 'error',
      status: 401,
      delayMs: 0,
    });
  });

  // Any change re-evaluates the opportunities — and this response is a 401.
  await page.getByRole('button', { name: 'Languages and certificates' }).click();
  await page.getByRole('button', { name: /English \(CEFR\)/ }).click();
  await page.getByRole('button', { name: 'Exclude from AI use' }).click();
  await expect(page.getByText('Requirements that depend on it stay unresolved.')).toBeVisible();

  // Opening the list shows the expiry on the page the student asked for.
  await page.getByRole('link', { name: 'Opportunities', exact: true }).first().click();
  await expect(page).toHaveURL(/\/opportunities/);
  const signInAgain = page.getByRole('link', { name: 'Sign in again' });
  await expect(signInAgain).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('Your session has expired')).toBeVisible();
  await expect(
    page.getByText('Sign in again and we will return you to where you were.'),
  ).toBeVisible();
  await expect(signInAgain).toHaveAttribute('href', /next=%2Fopportunities$/);

  // The way back is the same destination, not a generic home screen.
  await signInAgain.click();
  await expect(page).toHaveURL(/\/auth\/sign-in\?next=%2Fopportunities/);
  await page.getByLabel('Email address').fill('sara.benali@example.edu');
  await page.getByLabel('Password').fill('PrototypePass1');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/opportunities/);
  await expect(page.getByRole('heading', { name: 'Opportunities' })).toBeVisible();

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('the capability disclosure names what is simulated and what is offline', async ({ page }) => {
  const errors = collectConsoleErrors(page, {
    allowUnauthorized: true,
    allowFailedResource: true,
  });

  await signIn(page);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: /Hi Sara!/ })).toBeVisible();

  // The shell states the mode per service, not as one blanket claim.
  await page
    .getByRole('button', { name: /Demo data/ })
    .first()
    .click();
  const menu = page.getByRole('menu');
  await expect(menu.getByText('Connection status')).toBeVisible();
  const rows = menu.getByRole('listitem');
  await expect(
    rows.filter({ hasText: 'Profile and opportunities' }).getByText('Simulated'),
  ).toBeVisible();
  await expect(rows.filter({ hasText: 'AI reasoning' }).getByText('Simulated')).toBeVisible();
  await expect(rows.filter({ hasText: 'Web research' }).getByText('Simulated')).toBeVisible();
  await expect(rows.filter({ hasText: 'In-app alerts' }).getByText('Live')).toBeVisible();
  await expect(
    rows.filter({ hasText: 'Email notifications' }).getByText('Not configured'),
  ).toBeVisible();
  await page.keyboard.press('Escape');

  // The home workspace agrees.
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Model provider' }).getByText('Simulated'),
  ).toBeVisible();
  await expect(
    page.getByRole('listitem').filter({ hasText: 'Database' }).getByText('Simulated'),
  ).toBeVisible();
  await expect(
    page
      .getByRole('listitem')
      .filter({ hasText: 'Email notifications' })
      .getByText('Not configured'),
  ).toBeVisible();

  // Going offline is announced in plain words, and so is coming back.
  await page.context().setOffline(true);
  await expect(
    page.getByText(
      'You are offline. Your last local changes are preserved and will sync when you reconnect.',
    ),
  ).toBeVisible({ timeout: 15_000 });
  await page.context().setOffline(false);
  await expect(
    page.getByText(
      'You are offline. Your last local changes are preserved and will sync when you reconnect.',
    ),
  ).toHaveCount(0);

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

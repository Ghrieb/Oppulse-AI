import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';

/**
 * The agent journeys.
 *
 * Sprint 4 is about cohesion: one agent, one thread, one working context.
 * These tests follow the thread across surfaces — from an opportunity, into
 * the assistant, into the writing studio — and check that the context the
 * student chose is the context the agent used.
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

test('the context follows the student from an opportunity into the assistant', async ({ page }) => {
  const errors = collectConsoleErrors(page);

  await signIn(page);

  await page.goto('/opportunities');
  await page
    .getByRole('link', { name: 'Helios Research Fellowship in Computational Biology' })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Ask about this opportunity' }).click();

  await expect(page).toHaveURL(/\/assistant/);

  // The agent is working on the opportunity the student chose, and it says so.
  await expect(page.getByText('Working on', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Helios Research Fellowship in Computational Biology').first(),
  ).toBeVisible();

  // Asking a question now answers from that opportunity, not from thin air.
  await page.getByLabel('Message to Oppulse').fill('Am I eligible for this?');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('Am I eligible for this?')).toBeVisible();
  await expect(
    page.getByText('What Helios Research Fellowship in Computational Biology requires'),
  ).toBeVisible();

  // And the answer is grounded in sources, not asserted.
  await expect(page.getByText('Official source').first()).toBeVisible();

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('the assistant can prepare a document, and it says that it did not send it', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);

  await signIn(page);

  await page.goto('/applications');
  await page.getByRole('link', { name: 'Continue application' }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Ask Oppulse' }).click();
  await expect(page).toHaveURL(/\/assistant/);

  // The application is in context, so the answer is the outstanding work.
  await expect(page.getByText('Working on', { exact: true })).toBeVisible();
  await page.getByLabel('Message to Oppulse').fill('What is left to do?');
  await page.getByRole('button', { name: 'Send message' }).click();

  await expect(page.getByText('Still to do for').first()).toBeVisible();

  // The offered document prepares — it does not send.
  await expect(page.getByText('Prepares only')).toBeVisible();

  await page.getByRole('button', { name: 'Start this document' }).click();
  await page.getByRole('button', { name: 'Create the draft' }).click();

  await expect(page.getByText('Draft created. Nothing has been sent.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open the application workspace' })).toBeVisible();

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('the same thread follows the student from the dashboard to the assistant', async ({
  page,
}) => {
  const errors = collectConsoleErrors(page);

  await signIn(page);
  await page.goto('/home');

  await page.getByLabel('Message to Oppulse').fill('Compare these two programmes for me.');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByText('Compare these two programmes for me.')).toBeVisible();

  // The assistant route shows the same conversation, not a new one.
  await page.goto('/assistant');
  await expect(page.getByText('Compare these two programmes for me.')).toBeVisible();

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('selecting text scopes the revision to that selection', async ({ page }) => {
  const errors = collectConsoleErrors(page);

  await signIn(page);
  await page.goto('/writing/60000000-0000-4000-8000-000000000001');
  await expect(page.getByRole('heading', { name: /Motivation letter/ })).toBeVisible();

  // Clear the proposal that is already waiting, so the assistant can be asked
  // for a new one.
  await page.getByRole('button', { name: 'Reject' }).click();
  await expect(page.getByText('What should change?')).toBeVisible();

  // Select a phrase in the document.
  await page.locator('.ProseMirror p').first().click();
  await page
    .locator('.ProseMirror p')
    .first()
    .evaluate((element) => {
      const node = element.firstChild;
      if (!node) return;
      const range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, Math.min(40, node.textContent?.length ?? 0));
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
      element.dispatchEvent(new Event('mouseup', { bubbles: true }));
    });

  // The interface now says the revision is scoped.
  await expect(page.getByText('Revising a selection')).toBeVisible();
  await expect(page.getByText('What should change in this selection?')).toBeVisible();

  await page
    .getByLabel('What should change in this selection?')
    .fill('Make this more specific to the host laboratory.');
  await page.getByRole('button', { name: 'Propose a revision for this selection' }).click();

  // The proposal says it was scoped, and it is still only a proposal.
  await expect(page.getByText(/Proposed revision for your selection/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Accept' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reject' })).toBeVisible();

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

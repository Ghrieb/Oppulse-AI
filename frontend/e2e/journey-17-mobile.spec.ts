import { expect, test, type ConsoleMessage, type Locator, type Page } from '@playwright/test';

/**
 * Journey 17 - the opportunity panel on a phone.
 *
 * On a wide screen the selected opportunity opens in a controllable
 * right-hand panel. A phone has no room for that, so the student gets the
 * full detail route instead - and the swap must not cost the workspace its
 * selection, or the chat its thread. The layout decides which behaviour the
 * student gets, so this journey runs in the `mobile` project (a Pixel 7
 * viewport) only.
 */

const HELIOS = 'Helios Research Fellowship in Computational Biology';
const MERIDIAN = 'Meridian AI Summer School 2027';
const MERIDIAN_ID = 'd4000000-0000-4000-8000-000000000002';

function collectConsoleErrors(page: Page, options: { allowUnauthorized?: boolean } = {}): string[] {
  const errors: string[] = [];

  page.on('console', (message: ConsoleMessage) => {
    if (message.type() !== 'error') return;
    const text = message.text();
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

/**
 * A control, centred before it is tapped.
 *
 * The fixed "Ask Oppulse" pill appears after scrolling and owns the
 * bottom-right corner; the sticky bar owns the top. Centring first keeps
 * every tap clear of both, without hiding real behaviour behind a forced
 * click.
 */
async function tap(control: Locator): Promise<void> {
  await control.evaluate((element) =>
    element.scrollIntoView({ block: 'center', inline: 'center' }),
  );
  await control.click();
}

test('an opportunity opened from the assistant becomes the full detail route', async ({ page }) => {
  const errors = collectConsoleErrors(page, { allowUnauthorized: true });

  await signIn(page);

  // A student opens a call and hands it to the agent as working context.
  await page.goto('/opportunities');
  await tap(page.getByRole('link', { name: HELIOS }).first());
  await expect(page.getByRole('heading', { level: 1, name: HELIOS })).toBeVisible();

  await tap(page.getByRole('button', { name: 'Ask Oppulse' }));
  await expect(page).toHaveURL(/\/assistant/);
  await expect(page.getByText('Working on', { exact: true })).toBeVisible();

  // The answer points back at the call it came from.
  await page.getByLabel('Message to Oppulse').fill('Am I eligible for this?');
  await tap(page.getByRole('button', { name: 'Send message' }));
  await expect(page.getByText('Am I eligible for this?')).toBeVisible();

  // There is no side panel to open on a phone: the desktop link is in the
  // document but hidden, and the phone link is the one on screen.
  const panelLink = page.locator('a', { hasText: 'Open in the panel' });
  const routeLink = page.locator('a', { hasText: 'Open the opportunity' });
  await expect(panelLink).toHaveCount(1);
  await expect(panelLink).toBeHidden();
  await expect(routeLink).toHaveCount(1);
  await expect(routeLink).toBeVisible();

  // The reference opens the full detail route - the panel's stand-in.
  await tap(routeLink);
  await expect(page).toHaveURL(/\/opportunities\/d4000000-/);
  await expect(page.getByRole('heading', { level: 1, name: HELIOS })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'AI overview' })).toBeVisible();
  await expect(page.getByText('Deadline', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Back to results' })).toBeVisible();

  // Sources are on the phone too, not behind a hover or a wide screen.
  await tap(page.getByRole('tab', { name: 'Sources' }));
  await expect(page.getByRole('heading', { name: 'Sources' })).toBeVisible();
  await expect(page.getByText('Official source').first()).toBeVisible();

  // Going back returns to the same conversation - the thread was never lost.
  await page.goBack();
  await expect(page).toHaveURL(/\/assistant/);
  await expect(page.getByText('Am I eligible for this?')).toBeVisible();
  await expect(page.getByText('Working on', { exact: true })).toBeVisible();
  await expect(routeLink).toHaveCount(1);

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

test('the home panel stacks below the results and keeps its state in the URL', async ({ page }) => {
  const errors = collectConsoleErrors(page, { allowUnauthorized: true });

  await signIn(page);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: /Hi Sara!/ })).toBeVisible();

  // The phone shell is what decides the layout.
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();

  const railHeading = page.getByRole('heading', { name: 'Top opportunities' });
  await expect(railHeading).toBeVisible();

  const grid = page.locator('div.grid.gap-4').filter({ hasText: 'Top opportunities' }).first();
  const defaultPanel = grid.getByRole('heading', { level: 2, name: HELIOS });
  await expect(defaultPanel).toBeVisible();

  // One column: the panel is stacked below the results, not beside them.
  const layout = await page.evaluate((title) => {
    const heading = (text: string): Element | undefined =>
      Array.from(document.querySelectorAll('h2')).find((node) => node.textContent.includes(text));
    const gridElement = Array.from(document.querySelectorAll('div.grid.gap-4')).find((node) =>
      node.textContent.includes('Top opportunities'),
    );
    const rail = heading('Top opportunities');
    const panel = heading(title);
    return {
      columns: gridElement
        ? getComputedStyle(gridElement)
            .gridTemplateColumns.split(' ')
            .filter((part) => part.length > 0).length
        : 0,
      stacked:
        rail && panel
          ? panel.getBoundingClientRect().top + window.scrollY >
            rail.getBoundingClientRect().top + window.scrollY
          : null,
    };
  }, HELIOS);

  expect(layout.columns, 'the workspace is one column on a phone').toBe(1);
  expect(layout.stacked, 'the panel sits below the results').toBe(true);

  // Selecting a result keeps the choice in the URL and opens it in the panel.
  // The rail's toggle button, not the context chip's "remove" button, which
  // also names the opportunity once it has been pinned.
  const meridian = page.locator('button[aria-pressed]').filter({ hasText: MERIDIAN });
  await tap(meridian);
  await expect(page).toHaveURL(new RegExp(`opportunity=${MERIDIAN_ID}`));
  await expect(meridian).toHaveAttribute('aria-pressed', 'true');
  const panelHeading = grid.getByRole('heading', { level: 2, name: MERIDIAN });
  await expect(panelHeading).toBeVisible();

  // The panel can pin itself into the agent's context, and the strip agrees.
  const pin = page.getByRole('button', { name: 'Pin to chat context' });
  await tap(pin);
  await expect(page.getByText('the agent answers with this opportunity in context')).toBeVisible();
  await expect(page.getByText('Working on', { exact: true })).toBeVisible();

  // Closing is explicit, and it does not touch the agent's context.
  const close = page.getByRole('button', { name: 'Close the opportunity panel' });
  await tap(close);
  await expect(page).toHaveURL(/panel=closed/);
  await expect(panelHeading).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Close the opportunity panel' })).toHaveCount(0);
  await expect(page.getByText('Working on', { exact: true })).toBeVisible();

  // The close survives a refresh, because the URL is the state.
  await page.reload();
  await expect(page.getByRole('heading', { name: /Hi Sara!/ })).toBeVisible();
  await expect(railHeading).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close the opportunity panel' })).toHaveCount(0);

  // Selecting again reopens the panel on the same opportunity.
  await tap(meridian);
  await expect(page).toHaveURL(new RegExp(`opportunity=${MERIDIAN_ID}`));
  await expect(page.getByRole('button', { name: 'Close the opportunity panel' })).toBeVisible();
  await expect(grid.getByRole('heading', { level: 2, name: MERIDIAN })).toBeVisible();

  expect(errors, `Console errors:\n${errors.join('\n')}`).toEqual([]);
});

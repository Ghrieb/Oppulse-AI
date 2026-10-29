import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * Captures the screens used for review, the demo and the submission.
 * Run with: `npx playwright test e2e/screenshots.spec.ts`
 */
const OUTPUT = 'docs/screenshots';

test.beforeAll(() => {
  mkdirSync(OUTPUT, { recursive: true });
});

test('capture desktop screens', async ({ page }) => {
  // The capture walks the whole entry flow, so it needs more than the
  // default per-test budget.
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.goto('/');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUTPUT}/00-landing.png`, fullPage: false });

  await page.goto('/auth/sign-in');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUTPUT}/01-sign-in.png`, fullPage: false });

  await page.getByLabel('Email address').fill('sara.benali@example.edu');
  await page.getByLabel('Password').fill('PrototypePass1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUTPUT}/01b-onboarding.png`, fullPage: false });

  await page.getByRole('button', { name: 'Start here' }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('radio', { name: /Study in another country/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUTPUT}/01c-onboarding-question.png`, fullPage: false });

  await page.getByRole('button', { name: 'Skip the rest and show me the mission' }).click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUTPUT}/01d-mission-preview.png`, fullPage: false });

  await page.goto('/home');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUTPUT}/02-home-workspace.png`, fullPage: false });

  await page.goto('/opportunities');
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUTPUT}/03-opportunities.png`, fullPage: false });

  await page
    .getByRole('link', { name: 'Helios Research Fellowship in Computational Biology' })
    .first()
    .click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${OUTPUT}/04-opportunity-analysis.png`, fullPage: false });

  await page.getByRole('tab', { name: 'Eligibility' }).click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUTPUT}/05-eligibility.png`, fullPage: false });

  await page.goto('/documents');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUTPUT}/06-documents.png`, fullPage: false });

  await page.goto('/profile');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUTPUT}/06b-profile-passport.png`, fullPage: false });

  await page.getByRole('button', { name: 'Languages and certificates' }).click();
  await page.getByRole('button', { name: /English \(CEFR\)/ }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUTPUT}/06c-fact-detail.png`, fullPage: false });

  await page.goto('/documents');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUTPUT}/06-documents.png`, fullPage: false });

  await page.goto('/applications');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUTPUT}/07-applications.png`, fullPage: false });

  await page.getByRole('link', { name: 'Continue application' }).first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUTPUT}/08-application-workspace.png`, fullPage: false });

  // Wait for real content, not a timer: both routes are code-split and
  // fetch on mount, so a fixed delay can capture the loading skeleton.
  await page.goto('/writing/60000000-0000-4000-8000-000000000001');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Version history').first()).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${OUTPUT}/09-writing-studio.png`, fullPage: false });

  await page.goto('/monitoring');
  await expect(page.getByRole('heading', { name: 'Monitoring & Alerts' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText('Monitoring targets').first()).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: `${OUTPUT}/10-monitoring.png`, fullPage: false });

  await page.goto('/goals');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUTPUT}/11-goals.png`, fullPage: false });

  await page.goto('/settings');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUTPUT}/12-settings.png`, fullPage: false });
});

test('capture mobile screens', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUTPUT}/12-mobile-landing.png`, fullPage: false });

  await page.goto('/auth/sign-in');
  await page.getByLabel('Email address').fill('sara.benali@example.edu');
  await page.getByLabel('Password').fill('PrototypePass1');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${OUTPUT}/13-mobile-onboarding.png`, fullPage: false });

  await page.goto('/home');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUTPUT}/13-mobile-home.png`, fullPage: false });

  await page.goto('/opportunities');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUTPUT}/14-mobile-opportunities.png`, fullPage: false });
});

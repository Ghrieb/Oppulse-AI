import { chromium } from '@playwright/test';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';

const baseURL = process.env.DEMO_BASE_URL ?? 'http://localhost:5173';
const outputDirectory = path.resolve('docs/clips');
const outputPath = path.join(outputDirectory, 'oppulse-student-journey.webm');

mkdirSync(outputDirectory, { recursive: true });
const recordingDirectory = mkdtempSync(path.join(outputDirectory, '.recording-'));

const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chrome',
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: recordingDirectory, size: { width: 1440, height: 900 } },
});
const page = await context.newPage();

async function hold(milliseconds = 5500) {
  await page.waitForTimeout(milliseconds);
}

await page.goto(`${baseURL}/`);
await hold(6500);

await page.goto(`${baseURL}/auth/sign-in`);
await page.getByLabel('Email address').fill('sara.benali@example.edu');
await page.getByLabel('Password').fill('PrototypePass1');
await page.getByRole('button', { name: 'Sign in' }).click();
await hold(6500);

await page.goto(`${baseURL}/home`);
await hold(7000);

await page.goto(`${baseURL}/opportunities`);
await hold(7000);
await page
  .getByRole('link', { name: 'Helios Research Fellowship in Computational Biology' })
  .first()
  .click();
await hold(7000);

await page.getByRole('tab', { name: 'Eligibility' }).click();
await hold(6500);

await page.goto(`${baseURL}/profile`);
await hold(6500);

await page.goto(`${baseURL}/applications`);
await hold(6500);
await page.getByRole('link', { name: 'Continue application' }).first().click();
await hold(7000);

await page.goto(`${baseURL}/monitoring`);
await hold(6500);

await context.close();
const recordedVideo = await page.video()?.path();
await browser.close();

if (!recordedVideo) {
  throw new Error('Playwright did not produce a demo recording.');
}

copyFileSync(recordedVideo, outputPath);
rmSync(recordingDirectory, { recursive: true, force: true });
console.log(`Demo recording written to ${outputPath}`);

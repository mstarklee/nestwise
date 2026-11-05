import { expect, type Page } from '@playwright/test';
import { E2E_EMAIL } from '../../playwright.config';

export const E2E_PASSWORD = 'correct-horse-battery';

/**
 * Gets a page to a signed-in Home. The browser-test database is emptied once per run, so this signs in when the
 * account already exists (core.spec.ts made it) and otherwise creates the account and sets the family up.
 */
export async function signInOrSetUp(page: Page): Promise<void> {
  await page.goto('/home');
  // The redirect for a signed-out person happens as the page streams in, so let the page settle first.
  await page.waitForLoadState('networkidle');
  if (new URL(page.url()).pathname === '/home') return;
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Password').fill(E2E_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const outcome = await Promise.race([
    page.waitForURL((u) => u.pathname === '/home').then(() => 'in'),
    page.getByText(/email and password/).waitFor().then(() => 'no-account'),
    page.waitForURL((u) => u.pathname === '/setup').then(() => 'setup'),
  ]);
  if (outcome === 'in') return;
  if (outcome === 'no-account') {
    await page.goto('/sign-in');
    await page.getByRole('button', { name: 'New here? Create an account' }).click();
    await page.getByLabel('Email').fill(E2E_EMAIL);
    await page.getByLabel('Password').fill(E2E_PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Set up your family' })).toBeVisible();
  await page.getByLabel('Family name').fill('Our Family');
  await page.getByLabel('Time zone').fill('Asia/Kolkata');
  await page.getByLabel('Money already kept aside for yearly bills').fill('0');
  await page.getByRole('button', { name: 'Create family' }).click();
  await page.getByRole('button', { name: 'Import our plan' }).click();
  await expect(page.getByRole('heading', { name: 'Which of these are still to come in 2026?' })).toBeVisible();
  await page.getByRole('checkbox', { name: /Deepavali Celebration/ }).check();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByTestId('pot-balance')).toBeVisible();
}

/**
 * page.goto that survives a background refresh: when a screen's own router.refresh() is still in flight, aborting it
 * makes Next fall back to a hard navigation, and Playwright reports our goto as "interrupted by another navigation".
 * The page is fine; asking again lands it.
 */
export async function gotoSettled(page: Page, url: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await page.goto(url);
      return;
    } catch (error) {
      if (attempt >= 2 || !/interrupted by another navigation/.test(String(error))) throw error;
    }
  }
}

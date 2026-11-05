import { createHash, randomBytes } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { authTokens, createDb, users } from '@nestwise/db';
import { eq } from 'drizzle-orm';
import { E2E_EMAIL, e2eDatabaseUrl } from '../../playwright.config';

export const E2E_PASSWORD = 'correct-horse-battery';

/**
 * The browser-test server sends no email, so this stands in for the inbox: it plants a fresh verify link for the
 * account in the browser-test database, opens it, and continues into the app, as the person would.
 */
export async function openVerifyLink(page: Page, email = E2E_EMAIL): Promise<void> {
  const db = createDb(e2eDatabaseUrl(), { max: 1 });
  const token = randomBytes(32).toString('base64url');
  try {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    const now = new Date();
    await db.insert(authTokens).values({
      tokenHash: createHash('sha256').update(token).digest('hex'),
      userId: user!.id,
      purpose: 'verify_email',
      createdAt: now,
      // The server's "today" is pinned to 1 Nov 2026 (NESTWISE_FIXED_NOW), so the link must outlive that too.
      expiresAt: new Date(Math.max(now.getTime(), Date.parse('2026-11-01T04:00:00Z')) + 24 * 60 * 60 * 1000),
    });
  } finally {
    await db.$client.end();
  }
  await page.goto(`/verify-email/confirm?token=${token}`);
  await expect(page.getByRole('heading', { name: 'Your email is verified' })).toBeVisible();
  await page.getByRole('link', { name: 'Continue' }).click();
}

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
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await openVerifyLink(page);
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

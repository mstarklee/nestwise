import { expect, test } from '@playwright/test';
import { gotoSettled, signInOrSetUp } from './helpers';

test.beforeEach(async ({ page }) => {
  await signInOrSetUp(page);
});

test('every tab root fits the phone width, with no sideways scroll', async ({ page }) => {
  for (const path of ['/home', '/add', '/budgets', '/forecast', '/activity']) {
    await gotoSettled(page, path);
    if (path === '/budgets') await page.waitForURL(/\/month\//);
    // Let the screen finish streaming in (Budgets opens by redirecting to this month) before measuring it.
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), path).toBe(true);
  }
});

test('the bar has five named buttons and marks the current one', async ({ page }) => {
  const bar = page.getByRole('navigation', { name: 'Main' });
  for (const name of ['Home', 'Budgets', 'Add', 'Bills', 'Activity']) await expect(bar.getByRole('link', { name })).toBeVisible();
  await page.goto('/month/2026-11');
  await expect(bar.getByRole('link', { name: 'Budgets' })).toHaveAttribute('aria-current', 'page');
});

test('on a phone the bar sits flat on the bottom edge, full width, with names under the icons', async ({ page }) => {
  await gotoSettled(page, '/home');
  const bar = page.getByRole('navigation', { name: 'Main' });
  const box = (await bar.boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(Math.round(box.y + box.height)).toBe(viewport.height);
  expect(Math.round(box.x)).toBe(0);
  expect(Math.round(box.width)).toBe(viewport.width);
  await expect(bar.getByText('Budgets', { exact: true })).toBeVisible();
});

test('a deeper screen has Back, and Back with no history goes to its tab root', async ({ page }) => {
  await page.goto(`/year/${new Date().getFullYear()}`); // opened directly, as from a notification
  await page.getByRole('link', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/forecast$/);
});

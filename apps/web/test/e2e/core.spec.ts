import { expect, test } from '@playwright/test';
import { E2E_EMAIL } from '../../playwright.config';

// The core flow on an iPhone-sized WebKit, with "today" pinned to 1 Nov 2026 in India (playwright.config.ts).
// Sign-in is our own email + password (no email codes, so no mail catcher).
test('sign up, set up the family, confirm the deposit, add an expense, see it in the month and the forecast', async ({ page }) => {
  // 1. Create the account.
  await page.goto('/home');
  await expect(page).toHaveURL(/\/sign-in/);
  await page.getByRole('button', { name: 'New here? Create an account' }).click();
  await page.getByLabel('Email').fill(E2E_EMAIL);
  await page.getByLabel('Password').fill('correct-horse-battery');
  await page.getByRole('button', { name: 'Create account' }).click();

  // 2. Setup: INR, Asia/Kolkata, opening ₹0, import the plan, tick Deepavali.
  await expect(page.getByRole('heading', { name: 'Set up your family' })).toBeVisible();
  await page.getByLabel('Family name').fill('Our Family');
  await page.getByLabel('Time zone').fill('Asia/Kolkata');
  await page.getByLabel('Money already kept aside for yearly bills').fill('0');
  await page.getByRole('button', { name: 'Create family' }).click();
  await page.getByRole('button', { name: 'Import our plan' }).click();
  await expect(page.getByRole('heading', { name: 'Which of these are still to come in 2026?' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Bike Insurance/ })).toBeChecked();
  await page.getByRole('checkbox', { name: /Deepavali Celebration/ }).check();
  await page.getByRole('button', { name: 'Done', exact: true }).click();

  // 3. Home: the pot is ₹0, the checklist is waiting, November's bike insurance is ₹1,500.
  await expect(page).toHaveURL(/\/home/);
  await expect(page.getByTestId('pot-balance')).toHaveText('₹0');
  await expect(page.getByRole('heading', { name: 'This month’s checklist' })).toBeVisible();
  await expect(page.getByText(/Bike Insurance/).locator('..')).toContainText('₹1,500');

  // 4. Confirm the deposit: the pot shows ₹36,917.
  await page.getByRole('button', { name: 'Done: Pot deposit' }).click();
  await expect(page.getByTestId('pot-balance')).toHaveText('₹36,917');

  // 5. Add an expense: ₹945, Groceries.
  await page.getByRole('link', { name: 'Add' }).click();
  await page.getByLabel('Amount', { exact: true }).fill('945');
  await page.getByLabel('Item').selectOption({ label: 'Groceries' });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status')).toContainText('Saved ₹945.00');

  // 6. November shows Groceries spent ₹945.
  await page.getByRole('status').getByRole('link', { name: 'See the month' }).click();
  await expect(page).toHaveURL(/\/month\/2026-11/);
  await expect(page.getByTestId('line-Groceries')).toContainText('₹945');

  // 7. The forecast shows 12 months and no short month.
  await page.goto('/forecast');
  await expect(page.getByTestId('forecast-months').locator('tbody tr')).toHaveCount(12);
  await expect(page.getByTestId('no-red')).toBeVisible();
});

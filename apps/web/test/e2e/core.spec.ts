import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { captureBatches, captureEntries, createDb, items, members, users } from '@nestwise/db';
import { and, eq } from 'drizzle-orm';
import { E2E_EMAIL, e2eDatabaseUrl } from '../../playwright.config';

/**
 * Stages one spoken note directly in the browser-test database: two expenses, the second with no amount heard, so
 * the review screen has something real to show. The speech and parse services are never called.
 */
async function seedVoiceNote(): Promise<string> {
  const db = createDb(e2eDatabaseUrl(), { max: 1 });
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, E2E_EMAIL)).limit(1);
  const [member] = await db.select({ familyId: members.familyId }).from(members).where(eq(members.userId, user!.id)).limit(1);
  const familyId = member!.familyId;
  const itemId = async (seedKey: string) =>
    (await db.select({ id: items.id }).from(items).where(and(eq(items.familyId, familyId), eq(items.seedKey, seedKey))).limit(1))[0]!.id;

  const batchId = randomUUID();
  await db.insert(captureBatches).values({
    id: batchId,
    familyId,
    createdBy: user!.id,
    transcript: 'KPN grocery 250, and something I mumbled',
    sttModel: 'saaras:v4',
    parseModel: 'gpt-6.1-terra',
    createdAt: new Date('2026-11-01T05:00:00Z'),
    resolvedAt: null,
  });
  await db.insert(captureEntries).values([
    {
      id: randomUUID(),
      batchId,
      familyId,
      amountMinor: 25_000,
      itemId: await itemId('groceries'),
      yearLineId: null,
      kind: 'expense',
      txnDate: '2026-11-01',
      merchant: 'KPN',
      note: '',
      heard: 'KPN grocery 250',
      confidenceAmount: 0.97,
      confidenceItem: 0.95,
      dropped: false,
      sort: 0,
    },
    {
      id: randomUUID(),
      batchId,
      familyId,
      amountMinor: null,
      itemId: null,
      yearLineId: null,
      kind: 'expense',
      txnDate: '2026-11-01',
      merchant: null,
      note: '',
      heard: 'something I mumbled',
      confidenceAmount: 0.1,
      confidenceItem: 0.2,
      dropped: false,
      sort: 1,
    },
  ]);
  return batchId;
}

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

  // 7. With no signal: ₹120 Fruits saves on the phone, waits, then sends once when the signal returns.
  await page.getByRole('link', { name: 'Add' }).click();
  await expect(page.getByRole('heading', { name: 'Add an expense' })).toBeVisible();
  await page.context().setOffline(true);
  await page.getByLabel('Amount', { exact: true }).fill('120');
  await page.getByLabel('Item').selectOption({ label: 'Fruits' });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Saved ₹120.00 on this phone.')).toBeVisible();
  await expect(page.getByTestId('outbox-status')).toHaveText('1 expense waiting to send');
  await page.context().setOffline(false);
  await expect(page.getByTestId('outbox-status')).toHaveCount(0);
  await page.goto('/month/2026-11');
  await expect(page.getByTestId('line-Fruits')).toContainText('₹120');
  await expect(page.getByTestId('line-Fruits')).not.toContainText('₹240');

  // 8. The forecast shows 12 months and no short month.
  await page.goto('/forecast');
  await expect(page.getByTestId('forecast-months').locator('tbody tr')).toHaveCount(12);
  await expect(page.getByTestId('no-red')).toBeVisible();

  // 9. The same ₹300 at the same shop twice: "Same purchase?" → Same; Vegetables counts ₹300 once.
  const addAtShop = async () => {
    await page.getByRole('link', { name: 'Add' }).click();
    await expect(page.getByRole('heading', { name: 'Add an expense' })).toBeVisible();
    await page.getByLabel('Amount', { exact: true }).fill('300');
    await page.getByLabel('Item').selectOption({ label: 'Vegetables' });
    await page.getByLabel('Where (optional)').fill('Corner veg shop');
    await page.getByRole('button', { name: 'Save' }).click();
  };
  await addAtShop();
  await expect(page.getByText('Saved ₹300.00.')).toBeVisible();
  await addAtShop();
  await expect(page.getByTestId('duplicate-question')).toContainText('Same purchase?');
  await page.getByRole('button', { name: 'Same purchase' }).click();
  await expect(page.getByTestId('duplicate-question')).toHaveCount(0);
  await page.goto('/month/2026-11');
  await expect(page.getByTestId('line-Vegetables')).toContainText('₹300');
  await expect(page.getByTestId('line-Vegetables')).not.toContainText('₹600');

  // 10. Activity lists what happened; the ledger lists November's expenses.
  await page.goto('/activity');
  await expect(page.getByText('You said two expenses were the same purchase')).toBeVisible();
  await page.goto('/ledger?month=2026-11');
  await expect(page.getByText('Corner veg shop')).toHaveCount(1);

  // 11. October's review can be closed by an Admin, once.
  await page.goto('/month/2026-10/review');
  await page.getByRole('button', { name: 'Close October 2026' }).click();
  await expect(page.getByText('October 2026 is closed.')).toBeVisible();

  // 12. Family settings: rename; the currency stays locked.
  await page.goto('/settings/family');
  await page.getByLabel('Name', { exact: true }).fill('Kumar Family');
  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page.getByText('Saved.')).toBeVisible();
  // Voice usage for the month, with nothing recorded in this run.
  await expect(page.getByText('Voice notes this month')).toBeVisible();
  await expect(page.getByText(/^0 (of \d+ used|used)/)).toBeVisible();
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByRole('heading', { name: 'Kumar Family' })).toBeVisible();

  // 13. Voice: the recording screen, then a staged note checked and added.
  // The speech services are never called here — the note is seeded straight into the browser-test database, so
  // this covers the review screen and the confirm path. Actual microphone capture is only provable on a real phone.
  await page.getByTestId('home-voice').click();
  await expect(page).toHaveURL(/\/capture$/);
  await expect(page.getByTestId('voice-start')).toBeVisible();
  await expect(page.getByText(/Up to 30 seconds/)).toBeVisible();

  const batchId = await seedVoiceNote();
  await page.goto(`/capture/${batchId}`);
  await expect(page.getByRole('heading', { name: 'Check these 2' })).toBeVisible();
  await expect(page.getByText('“KPN grocery 250, and something I mumbled”')).toBeVisible();

  // The row whose amount was not heard is flagged, and adding is refused until it is filled in.
  await expect(page.getByText('Please check this one.')).toBeVisible();
  const rows = page.getByTestId('voice-expense-row');
  await expect(rows).toHaveCount(2);
  await page.getByTestId('voice-confirm').click();
  await expect(page.getByText('1 row needs an amount and an item')).toBeVisible();

  await rows.nth(1).getByLabel('Amount').fill('80');
  await rows.nth(1).getByLabel('Item').selectOption({ label: 'Fruits' });
  await page.getByTestId('voice-confirm').click();

  // Both land in the month: Fruits had 120 from step 7, so it now reads 200.
  await expect(page).toHaveURL(/\/home/);
  await page.goto('/month/2026-11');
  await expect(page.getByTestId('line-Fruits')).toContainText('₹200');
  await expect(page.getByTestId('line-Groceries')).toContainText('₹1,195');

  // The note has been dealt with, so it no longer waits in the Inbox.
  await page.goto('/inbox');
  await expect(page.getByText(/voice note/)).toBeHidden();
});

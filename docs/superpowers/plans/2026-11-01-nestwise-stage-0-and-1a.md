# NestWise Stage 0 + Stage 1a Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **REQUIRED for every task that touches server code:** the project skills `hexagonal-architecture` and `clean-architecture` (`.claude/skills/`). They define layout, naming, wiring, errors and fakes. This plan does not repeat them.

**Goal:** A throwaway iPhone spike that proves sign-in, push and offline sync in an installed PWA (Stage 0). Then the core NestWise app for one family (Stage 1a):
- sign-in and family setup, with the family's plan imported
- templates, month budgets and year plans
- the pot and its monthly checklist
- typed expenses (splits and refunds)
- the 12-month forecast and Home
- checklist and bill reminders

**Architecture:** A pnpm monorepo with four packages:

- **`packages/domain`** is the framework-free core. It is organised by feature: use cases, `*Gateway` ports, pure calculations.
- **`apps/web`** is Next.js 16 (App Router). It holds:
  - the thin `/api/v1` route handlers
  - Server Components that call query use cases
  - the Drizzle, push and email adapters
  - the `make*` wiring
- **`packages/api-contract`** holds the Zod request and response shapes.
- **`packages/db`** holds the Drizzle schema and migrations.

**Tech Stack:** Next.js 16, React 19, TypeScript (strict), pnpm, Supabase (Postgres, Auth), Drizzle ORM, Zod, Tailwind CSS v4 + shadcn/ui, next-intl (English only), Serwist, Dexie, `web-push`, Nodemailer (Gmail SMTP), Vitest, Playwright (WebKit), Vercel.

**Spec:**
- `docs/NestWise_PRD.md` (what; its §5 and §7 hold the numbers)
- `docs/NestWise_TRD.md` (how; §3 data model, §4 money, §5 algorithms, §6 security, §7 auth, §8 PWA and notifications)
- `docs/NestWise_Sample_Budget_and_Expense_Data.md` (fixtures)

## Global Constraints

These apply to every task.

**Platform and tooling**
- Node.js 22 LTS. pnpm 10. TypeScript `strict: true`, plus `noUncheckedIndexedAccess: true`.
- Hosting is Vercel Hobby on a free `*.vercel.app` address. Cron runs **daily only**, at `30 2 * * *` (02:30 UTC ≈ 08:00 IST).
- Supabase:
  - App tables live in schema `app`, which is **not** exposed by the Data API.
  - RLS is enabled on every table, with no policies for `anon` or `authenticated`.
  - The browser uses Supabase **only for auth**.
- Email goes out through Gmail SMTP (`SMTP_HOST=smtp.gmail.com`, port 465), using an app password the user creates. The Supabase Auth email template must include `{{ .Token }}`, so sign-in works with a 6-digit code.

**Money and dates**
- Money is integer minor units (`bigint` in the DB, safe-integer `number` in TS). No floats anywhere.
- The family currency and `minor_unit` are immutable after creation (a DB trigger enforces this).
- `txn_date` is the local date in the **family's** time zone, and it decides the period.

**Architecture and code**
- `packages/domain` may not import any of:
  - `next`, `react`, `server-only`
  - `drizzle-orm`, `postgres`, `@supabase/*`
  - `@anthropic-ai/*`, `web-push`, `nodemailer`
  - `@nestwise/db`, `@nestwise/api-contract`
- The domain tsconfig uses `"lib": ["ES2023"], "types": []`.
- Domain tests use no `vi.mock`, `vi.fn` or `vi.spyOn`.
- Every UI string lives in `apps/web/messages/en.json`, read through next-intl. No hard-coded copy in components.
- Signup mode is `SIGNUP_MODE=invite` for all of this plan.

**Data**
- Fictional sample transactions (TX-001…TX-036) are **never** loaded outside dev and test. `pnpm seed:dev` refuses to run when `VERCEL_ENV=production`.
- Sample INR figures are never relabelled into another currency.

## Review Focus

These inputs are not covered by any test in the spec. Each now has a test in the task that owns the code.

1. **Midnight at month start, in the family's time zone.** An expense entered at 00:30 IST on 1 Nov belongs to **November**, even though UTC still says 31 Oct. Covered by Task 2 (`todayIn`) and Task 11 (default date).
2. **Amounts typed the way people type them.** For example `"1,35,417"`, `"₹ 500"`, `" 204.50 "`. The grouping commas, currency symbol and spaces are ignored. `"1.2.3"`, `"12.345"` in INR and `"-5"` are refused with `InvalidAmountError`. Covered by Task 2.
3. **A plan with all amounts zero** (a blank starter template), **or a set-aside override of 0.** The forecast must not divide by zero. It reports no red months, a `fixPerMonthMinor` of `null` and a safe-to-spend of `min(balance, …)`. Covered by Task 3.
4. **Deleting or refunding an expense paid from the pot.** The pot balance and the yearly item's paid amount must go back down by exactly that amount, and its status must go back too (e.g. Paid → Part-paid). Covered by Task 11.
5. **An expense dated in a month that has no month budget yet.** For example, back-dated to a month before NestWise. The expense is saved, the month budget is created lazily from the template, and the actual appears there. Covered by Task 11.

---

## Prerequisites (the user does these; Claude cannot create accounts or enter passwords)

- [ ] **Supabase:** create two projects, `nestwise-dev` and `nestwise-prod`, in the Mumbai region (ap-south-1).
- [ ] **Vercel:** create a free account and link it to the CLI with `vercel login`.
- [ ] **Google Cloud:** create an OAuth client (Web). Add the redirect URI `https://<supabase-project>.supabase.co/auth/v1/callback`.
- [ ] **Gmail:** turn on 2-Step Verification and create an app password. Paste it into Supabase SMTP settings and the Vercel env yourself.
- [ ] **Supabase Auth email template:** edit it to show `{{ .Token }}`.
- [ ] **Optional:** a GitHub repository, for the weekly backup workflow (Task 15).

---

# Stage 0 — iPhone spike (throwaway)

### Task 0: Installed-PWA spike on a real iPhone

The spike is labelled throwaway. It gets no unit tests, it lives in `spikes/iphone-pwa/`, and it deploys to a **separate** Vercel project, `nestwise-spike`. What it teaches goes into Task 13 and Task 14.

**Files:**
- Create: `spikes/iphone-pwa/` (a standalone Next.js app, outside the pnpm workspace)
  - `app/page.tsx`, a single page with:
    - email-code sign-in and Google sign-in
    - "Turn on reminders", "Send test push" and "Add offline entry" buttons
  - `app/manifest.ts`: `display: 'standalone'`, `start_url: '/'`, 192 and 512 icons, `apple-touch-icon` 180px
  - `app/sw.ts` (Serwist): precaches the shell and handles `push` and `notificationclick`
  - `app/api/push/route.ts`: saves a subscription and sends one push with `web-push`
  - `app/api/entries/route.ts`: POST with a client UUID, `INSERT … ON CONFLICT (id) DO NOTHING` into `spike_entries`
  - `lib/outbox.ts` (Dexie): queues entries, and flushes on load, on `online` and on `visibilitychange`
- Create: `spikes/iphone-pwa/README.md`, holding the findings

- [ ] **Step 1: Build the spike** with the files above. Use the dev Supabase project's anon key, and VAPID keys from `npx web-push generate-vapid-keys`.
- [ ] **Step 2: Deploy** with `vercel --prod` from `spikes/iphone-pwa`. Expected: an HTTPS URL `https://nestwise-spike*.vercel.app`.
- [ ] **Step 3: Run the checks on the user's iPhone, in Safari, then after "Add to Home Screen".** Record each result as PASS or FAIL in the README:
  - (a) An email code typed **inside the installed app** signs in, and the session survives closing and reopening the app.
  - (b) Google sign-in from the installed app comes back signed in. If it fails, record whether signing in in Safari *before* installing carries the session over.
  - (c) After "Turn on reminders" in the installed app, "Send test push" shows a notification on the lock screen within 30 s.
  - (d) In airplane mode, "Add offline entry" ×2, then turning airplane mode off and reopening the app, gives exactly **2** rows in `spike_entries`, even after the outbox flushes twice.
- [ ] **Step 4: Decide**, and write the decision in the README:
  - If (a), (c) and (d) pass, continue with the Next.js PWA.
  - If (a) or (c) fails, stop and tell the user. The TRD's Stage 0 rule says to switch the iPhone client to Expo before building screens.
- [ ] **Step 5: Commit** the spike folder with its README: `git commit -m "spike: iPhone installed-PWA sign-in, push and offline findings"`.

---

# Stage 1a — Core plan

### Task 1: Monorepo scaffold with an enforced domain boundary

**Files:**
- Create:
  - `package.json` (root), `pnpm-workspace.yaml` (`packages: ["apps/*", "packages/*"]`), `.npmrc` (no hoisting overrides), `.nvmrc` (`22`)
  - `tsconfig.base.json`, `eslint.config.mjs`, `vitest.workspace.ts`
- Create `packages/domain/`:
  - `package.json` (name `@nestwise/domain`, `"type": "module"`, `exports` limited to `./shared` and `./<feature>` entries, no dependencies)
  - `tsconfig.json` (`lib: ["ES2023"]`, `types: []`)
  - `src/shared/index.ts`
- Create `packages/api-contract/`: `package.json` (dep: `zod`), `src/index.ts`
- Create `packages/db/`: `package.json` (deps: `drizzle-orm`, `postgres`; dev: `drizzle-kit`), `drizzle.config.ts`, `src/index.ts`
- Create `apps/web/`: a Next.js 16 app via `pnpm create next-app` (TypeScript, App Router, Tailwind, `src/` dir), with `transpilePackages: ['@nestwise/domain', '@nestwise/api-contract', '@nestwise/db']`
- Test: `packages/domain/test/boundary.test.ts`

**Interfaces:**
- Produces:
  - root scripts `lint`, `typecheck`, `test`, `test:integration`, `e2e`
  - the workspace package names `@nestwise/domain`, `@nestwise/api-contract`, `@nestwise/db`

- [ ] **Step 1: Write the failing boundary test.** It runs ESLint programmatically on a temp file under `packages/domain/src/__boundary__/bad.ts` that contains `import 'next/server'` and `import 'drizzle-orm'`.

```ts
it('domain lint rejects framework and I/O imports', async () => {
  const results = await new ESLint({ cwd: domainRoot }).lintText(
    "import 'next/server';\nimport 'drizzle-orm';\nimport '@nestwise/db';\n",
    { filePath: join(domainRoot, 'src/__boundary__/bad.ts') });
  const ids = results[0]!.messages.map((m) => m.ruleId);
  expect(ids.filter((id) => id === 'no-restricted-imports')).toHaveLength(3);
});
it('domain lint rejects vi.mock / vi.fn in domain tests', async () => {
  const results = await new ESLint({ cwd: domainRoot }).lintText(
    "vi.mock('x');\nconst f = vi.fn();\n", { filePath: join(domainRoot, 'test/__boundary__/bad.test.ts') });
  expect(results[0]!.messages.filter((m) => m.ruleId === 'no-restricted-properties')).toHaveLength(2);
});
```

- [ ] **Step 2: Run** `pnpm --filter @nestwise/domain test`. Expected: FAIL, because there is no ESLint config or rules yet.
- [ ] **Step 3: Add the config.**
  - In `eslint.config.mjs`, add a `no-restricted-imports` block scoped to `packages/domain/**`, with the full banned list from Global Constraints.
  - Add `no-restricted-properties` for `vi.mock`, `vi.fn` and `vi.spyOn`, scoped to `packages/domain/test/**`. Note that `ESLint` itself is a dev dependency at the root only, so the test can import it.
- [ ] **Step 4: Run** `pnpm -r lint && pnpm -r typecheck && pnpm --filter @nestwise/domain test`. Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "chore: pnpm monorepo with enforced domain boundary"`.

### Task 2: Domain shared kernel — money, periods, actor, ports, errors

**Files:**
- Create in `packages/domain/src/shared/`: `money.ts`, `period.ts`, `actor.ts`, `ports.ts`, `errors.ts`, `index.ts`
- Create in `packages/domain/test/fakes/`: `fixed-clock.ts`, `sequential-ids.ts`, `in-memory-activity-gateway.ts`
- Test in `packages/domain/test/shared/`: `money.test.ts`, `period.test.ts`, `actor.test.ts`

**Interfaces:**
- Produces:
  - `type ErrorCategory = 'invalid' | 'not_found' | 'not_allowed' | 'conflict'`
  - `abstract class DomainError extends Error { abstract readonly category: ErrorCategory }`
  - `class InvalidAmountError` and `class InvalidDateError` (both category `invalid`)
  - `class NotAllowedError` (category `not_allowed`)
  - `parseMinor(input: string, minorUnit: 0 | 1 | 2 | 3): number`
  - `sumMinor(values: readonly number[]): number` (throws `InvalidAmountError` beyond the safe-integer range)
  - `assertMinor(value: number): void`
  - `type IsoDate = string & { readonly __brand: 'IsoDate' }`, `toIsoDate(value: string): IsoDate`
  - `interface Period { readonly year: number; readonly month: number }` (month 1–12)
  - `periodOf(date: IsoDate): Period`, `addMonths(period: Period, n: number): Period`, `comparePeriods(a: Period, b: Period): number`
  - `todayIn(timeZone: string, now: Date): IsoDate`
  - `type Role = 'admin' | 'member' | 'viewer'`
  - `interface Actor { readonly userId: string; readonly familyId: string; readonly role: Role }`
  - `type Permission = 'read' | 'record_expense' | 'edit_month_budget' | 'confirm_checklist' | 'edit_plan' | 'manage_family'`
  - `assertCan(actor: Actor, permission: Permission): void`
  - `interface Clock { now(): Date }`, `interface IdGenerator { next(): string }`
  - `interface ActivityEvent { familyId; actorId; action: string; entityType: string; entityId: string; before: unknown; after: unknown; at: Date }`
  - `interface ActivityGateway { record(event: ActivityEvent): Promise<void> }` (in `shared/ports.ts`; every feature's unit of work exposes it)
  - Fakes: `new FixedClock(isoInstant: string)`, `new SequentialIds(prefix?: string)` (yields `id-1`, `id-2`, …)

The role → permission table:

| Role | Permissions |
| --- | --- |
| `viewer` | `read` |
| `member` | + `record_expense`, `edit_month_budget`, `confirm_checklist` |
| `admin` | + `edit_plan`, `manage_family` |

- [ ] **Step 1: Write the failing tests.**

```ts
// money.test.ts
expect(parseMinor('204.50', 2)).toBe(20450);
expect(parseMinor(' 1,35,417 ', 2)).toBe(13541700);
expect(parseMinor('₹ 500', 2)).toBe(50000);
expect(parseMinor('1500', 0)).toBe(1500);          // JPY
expect(parseMinor('1.234', 3)).toBe(1234);         // KWD
for (const bad of ['1.2.3', '12.345', '-5', '', 'abc', '0']) {
  expect(() => parseMinor(bad, 2)).toThrow(InvalidAmountError);
}
expect(sumMinor([800000, 300000, 300000, 500000, 500000])).toBe(2400000);
expect(() => sumMinor([Number.MAX_SAFE_INTEGER, 1])).toThrow(InvalidAmountError);

// period.test.ts
expect(periodOf(toIsoDate('2026-10-07'))).toEqual({ year: 2026, month: 10 });
expect(addMonths({ year: 2026, month: 11 }, 2)).toEqual({ year: 2027, month: 1 });
expect(todayIn('Asia/Kolkata', new Date('2026-10-31T19:00:00Z'))).toBe('2026-11-01'); // 00:30 IST
expect(() => toIsoDate('2026-02-30')).toThrow(InvalidDateError);

// actor.test.ts
expect(() => assertCan(viewer, 'record_expense')).toThrow(NotAllowedError);
expect(() => assertCan(member, 'edit_plan')).toThrow(NotAllowedError);
expect(() => assertCan(admin, 'manage_family')).not.toThrow();
```

- [ ] **Step 2: Run** `pnpm --filter @nestwise/domain test shared`. Expected: FAIL, because the modules don't exist yet.
- [ ] **Step 3: Implement** the functions above.
  - `parseMinor` strips `[\s,₹$€£¥]`, then requires `^\d+(\.\d{1,minorUnit})?$` (no decimal point when `minorUnit` is 0), splits on `.`, right-pads the fraction, builds the integer, and requires it to be > 0 and a safe integer.
  - `todayIn` uses `Intl.DateTimeFormat('en-CA', { timeZone, year, month, day })`.
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(domain): shared kernel — money, periods, actor, ports, errors"`.

### Task 3: Pure plan calculations — set-aside split, year-line status, pot projection

**Files:**
- Create: `packages/domain/src/year-plan/models.ts` (`YearLine` type, `yearLineStatus`, `remainingMinor`)
- Create: `packages/domain/src/pot/models.ts` (`splitSetAside`, `setAsideFor`)
- Create: `packages/domain/src/forecast/models.ts` (`projectPot`)
- Test: `packages/domain/test/year-plan/year-line-status.test.ts`
- Test: `packages/domain/test/pot/set-aside.test.ts`
- Test: `packages/domain/test/forecast/project-pot.test.ts`

**Interfaces:**
- Produces:
  - `type YearLineState = 'open' | 'done' | 'cancelled' | 'before_nestwise'`
  - `interface YearLine { readonly id: string; readonly familyId: string; readonly year: number; readonly itemId: string; readonly name: string; readonly plannedMinor: number; readonly dueYear: number; readonly dueMonth: number | null; readonly dueDay: number | null; readonly state: YearLineState }`
  - `type YearLineStatus = 'planned' | 'due_soon' | 'part_paid' | 'paid' | 'overdue' | 'cancelled' | 'before_nestwise'`
  - `remainingMinor(line: YearLine, paidMinor: number): number` (TRD §5.3)
  - `yearLineStatus(line: YearLine, paidMinor: number, current: Period): YearLineStatus` (the TRD §5.3 rules, in that order)
  - `splitSetAside(totalMinor: number): readonly number[]` (12 entries; months 1…r get `base + 1`)
  - `setAsideFor(month: number, yearTotalMinor: number, overrideMinor: number | null): number`
  - `interface ForecastMonthInput { readonly period: Period; readonly setAsideMinor: number; readonly datedOutMinor: number; readonly estimate: boolean }`
  - `interface ForecastInput { readonly balanceMinor: number; readonly currentDepositSettled: boolean; readonly overdueOutMinor: number; readonly months: readonly ForecastMonthInput[] }` (exactly 12 months, starting with the current one)
  - `interface ForecastMonth { readonly period: Period; readonly inMinor: number; readonly outMinor: number; readonly endMinor: number; readonly estimate: boolean }`
  - `interface Forecast { readonly months: readonly ForecastMonth[]; readonly safeToSpendNowMinor: number; readonly redMonths: readonly Period[]; readonly fixPerMonthMinor: number | null; readonly topUpNowMinor: number | null }`
  - `projectPot(input: ForecastInput): Forecast` (the loop in TRD §5.5)

- [ ] **Step 1: Write the failing tests.** Every number comes from PRD §5.4 and TRD §5.5, in paise. `datedOutFrom` is a test helper that maps 'YYYY-MM' to the dated bills (Nov 1,500 · Jan 15,000 · May 60,000 · Jun 1,20,000 · Jul 53,000 · Oct 36,500).

```ts
// set-aside.test.ts
const split = splitSetAside(44_300_000);
expect(split.filter((v) => v === 3_691_667)).toHaveLength(8);
expect(split.filter((v) => v === 3_691_666)).toHaveLength(4);
expect(split.slice(0, 8).every((v) => v === 3_691_667)).toBe(true);
expect(sumMinor(split)).toBe(44_300_000);
expect(setAsideFor(11, 44_300_000, 3_700_000)).toBe(3_700_000);
expect(splitSetAside(0).every((v) => v === 0)).toBe(true);

// project-pot.test.ts — Nov 2026 start, B0 = 0, dated lines only
const f = projectPot(novemberStart({ balanceMinor: 0, currentDepositSettled: false }));
expect(f.months.map((m) => m.endMinor)).toEqual([
  3_541_666, 7_233_332, 9_424_999, 13_116_666, 16_808_333, 20_500_000,
  18_191_667, 9_883_334, 8_275_001, 11_966_668, 15_658_334, 15_700_000]);
expect(f.safeToSpendNowMinor).toBe(0);
expect(f.redMonths).toEqual([]);
// after the November deposit is confirmed
const g = projectPot(novemberStart({ balanceMinor: 3_691_666, currentDepositSettled: true }));
expect(g.safeToSpendNowMinor).toBe(3_541_666);
// March 2027 start, B0 = 0
const m = projectPot(marchStart());
expect(m.months[3]!.endMinor).toBe(-3_233_332);
expect(m.redMonths).toEqual([{ year: 2027, month: 6 }]);
expect(m.fixPerMonthMinor).toBe(808_333);
// tour ₹50,000 dated May 2027
const t = projectPot(novemberStart({ balanceMinor: 0, currentDepositSettled: false, extra: { '2027-05': 5_000_000 } }));
expect(t.months[7]!.endMinor).toBe(4_883_334);
expect(t.months[8]!.endMinor).toBe(3_275_001);
// Review Focus 3: all-zero plan
const z = projectPot(allZero());
expect(z.redMonths).toEqual([]); expect(z.fixPerMonthMinor).toBeNull(); expect(z.safeToSpendNowMinor).toBe(0);
// red in month 0 with the deposit already settled → top up now
const r = projectPot({ ...novemberStart({ balanceMinor: 100_000, currentDepositSettled: true }), overdueOutMinor: 500_000 });
expect(r.fixPerMonthMinor).toBeNull(); expect(r.topUpNowMinor).toBe(550_000);
```

```ts
// year-line-status.test.ts (current period = 2027-05)
expect(yearLineStatus(schoolT1, 0, may2027)).toBe('due_soon');
expect(yearLineStatus(schoolT1, 6_000_000, may2027)).toBe('paid');
expect(yearLineStatus(servicing /* undated, 15,000 */, 400_000, may2027)).toBe('part_paid');
expect(yearLineStatus({ ...pongal, dueMonth: 1 }, 0, may2027)).toBe('overdue');
expect(yearLineStatus({ ...servicing, state: 'done' }, 400_000, may2027)).toBe('paid');
expect(remainingMinor({ ...servicing, state: 'done' }, 400_000)).toBe(0);
expect(yearLineStatus({ ...tour, state: 'before_nestwise' }, 0, may2027)).toBe('before_nestwise');
```

The `topUpNowMinor` expectation of 550,000 works out like this:
- November ends at 100,000 − 500,000 (overdue) − 150,000 (bike insurance) = −550,000.
- The deposit is already settled, so no deposit can land before then (k = 0). The fix is a top-up now of 550,000.
- Every later month stays positive, so `fixPerMonthMinor` is `null`.

- [ ] **Step 2: Run** `pnpm --filter @nestwise/domain test year-plan pot forecast`. Expected: FAIL.
- [ ] **Step 3: Implement** `splitSetAside`, `setAsideFor`, `remainingMinor`, `yearLineStatus` and `projectPot`, exactly per TRD §4 and §5.3–5.5.
  - `topUpNowMinor` = `max over red i with k_i = 0 of −end[i]`, and `null` when there is none.
  - `fixPerMonthMinor` = `max over red i with k_i > 0 of ceil(−end[i] / k_i)`, and `null` when there is none.
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(domain): set-aside split, year-line status and pot projection"`.

### Task 4: Month figures and the sample-data fixture

**Files:**
- Create: `fixtures/sample-family.ts`, holding every table from the sample-data doc:
  - the monthly, savings and yearly templates, with item keys
  - TX-001…TX-036
  - YP-001 and YP-002
  - EV-010-A/B/C
- Create: `packages/domain/src/month-budget/models.ts` (`lineFigures`, `groupFigures`, `monthTotals`)
- Test: `packages/domain/test/month-budget/month-figures.test.ts`

**Interfaces:**
- Consumes: `sumMinor` (Task 2).
- Produces:
  - `interface LineFigures { readonly plannedMinor: number; readonly actualMinor: number; readonly remainingMinor: number; readonly varianceMinor: number; readonly pct: number | null }`
  - `lineFigures(plannedMinor: number, actualMinor: number): LineFigures`
  - `groupFigures(lines: readonly { groupName: string; plannedMinor: number; actualMinor: number }[]): ReadonlyMap<string, LineFigures>`
  - `monthTotals(lines: readonly { plannedMinor: number; actualMinor: number }[]): LineFigures`
  - The fixture's export `sampleFamily` has fields `monthlyTemplate`, `savingsTemplate`, `yearlyTemplate`, `october2026Transactions`, `october2026YearlyPayments` and `tx010Evidence`.

- [ ] **Step 1: Write the failing test.** It builds actuals from `sampleFamily.october2026Transactions`, summed per item key.

```ts
const totals = monthTotals(octoberLines);
expect(totals.plannedMinor).toBe(8_150_000);
expect(totals.actualMinor).toBe(8_445_000);
expect(totals.varianceMinor).toBe(295_000);
expect(lineFigures(800_000, 1_000_000).varianceMinor).toBe(200_000);   // groceries, AC-15 pattern
expect(lineFigures(300_000, 250_000).varianceMinor).toBe(-50_000);     // fruits
expect(groupFigures(octoberLines).get('Food & Dining')!.actualMinor).toBe(2_630_000);
expect(lineFigures(0, 5_000).pct).toBeNull();
// every row of sample-doc §4 item table
for (const row of sampleFamily.october2026ItemTable) {
  expect(lineFigures(row.plannedMinor, actualOf(row.itemKey)).varianceMinor).toBe(row.varianceMinor);
}
// yearly payments are not monthly spending (PRD §7 test 9)
expect(sumMinor(sampleFamily.october2026Transactions.map((t) => t.amountMinor))).toBe(8_445_000);
```

- [ ] **Step 2: Run** `pnpm --filter @nestwise/domain test month-budget`. Expected: FAIL.
- [ ] **Step 3: Write the fixture and implement `lineFigures`, `groupFigures` and `monthTotals`.** Use `variance = actual − planned` and `pct = planned === 0 ? null : actual / planned`. Copy the fixture values from the sample doc, with paise exact (TX-011 is 20450).
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(domain): month figures + sample-data fixture"`.

### Task 5: Database schema, migrations and integration-test harness

**Files:**
- Create in `packages/db/src/schema/`, one file per TRD §3 table group, all in pgSchema `app`:
  - `families.ts`: `families`, `profiles`, `members`, `invites`
  - `plan.ts`: `groups`, `items`, `templateLines`
  - `budgets.ts`: `monthBudgets`, `monthLines`, `yearPlans`, `yearLines` (with `dueYear`)
  - `money.ts`: `transactions`, `allocations`, `potEntries`, `savingsEntries`, `checklistSkips`
  - `history.ts`: `evidence`, `duplicateMatches`, `activity`
  - `notify.ts`: `pushSubscriptions`, `notificationsSent`, `usage`
- Create: `packages/db/migrations/0000_init.sql` (generated) and `packages/db/migrations/0001_guards.sql` (hand-written)
- Create: `packages/db/src/client.ts` (`createDb(url: string)`, using postgres-js with `prepare: false`)
- Create: `apps/web/test/integration/setup.ts` (connects to `TEST_DATABASE_URL`, runs migrations, truncates `app.*` between tests)
- Test: `packages/db/test/guards.integration.test.ts`

**Interfaces:**
- Produces:
  - `type Db` (the Drizzle instance type), `createDb(url)`, and the table objects named above
  - integration tests run with `pnpm test:integration`, which needs `TEST_DATABASE_URL` (local Supabase or `nestwise-dev`)

The hand-written guards in `0001_guards.sql`:
- `ALTER TABLE … ENABLE ROW LEVEL SECURITY` on every table
- a trigger rejecting an `UPDATE` of `families.currency_code` or `families.minor_unit`
- a deferred constraint trigger requiring `Σ allocations.amount_minor = transactions.amount_minor`
- a partial unique index: one live deposit per family-month
- `REVOKE UPDATE, DELETE ON app.activity` from the app role

- [ ] **Step 1: Write the failing integration test.**

```ts
it('rejects changing a family currency', async () => {
  const id = await insertFamily(db, { currencyCode: 'INR', minorUnit: 2 });
  await expect(db.update(families).set({ currencyCode: 'USD' }).where(eq(families.id, id))).rejects.toThrow();
});
it('rejects a transaction whose allocations do not add up, at commit', async () => {
  await expect(db.transaction(async (tx) => {
    await insertTransaction(tx, { amountMinor: 1000 });
    await insertAllocation(tx, { amountMinor: 900 });
  })).rejects.toThrow();
});
it('allows only one live pot deposit per family-month', async () => {
  await insertDeposit(db, { year: 2026, month: 11 });
  await expect(insertDeposit(db, { year: 2026, month: 11 })).rejects.toMatchObject({ code: '23505' });
});
it('app role cannot update or delete activity rows', async () => { /* as app role: UPDATE → permission denied */ });
it('every app table has RLS enabled', async () => {
  const rows = await db.execute(sql`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='app' and c.relkind='r' and not c.relrowsecurity`);
  expect(rows).toHaveLength(0);
});
```

- [ ] **Step 2: Run** `pnpm test:integration --filter @nestwise/db`. Expected: FAIL, because there are no tables yet.
- [ ] **Step 3: Write the schema and migrations.**
  - Write the schema files, then run `pnpm --filter @nestwise/db drizzle-kit generate`.
  - Write `0001_guards.sql` with the guards listed above.
  - Make `period_year` and `period_month` generated columns computed from `txn_date`.
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(db): schema, guards and integration harness"`.

### Task 6: Family feature — create family, membership, invites, `requireActor`, signup gate

**Files:**
- Create in `packages/domain/src/family/`:
  - `models.ts`, `ports.ts`, `errors.ts`, `index.ts`
  - `use-cases/create-family.ts`, `use-cases/create-invite.ts`, `use-cases/accept-invite.ts`, `use-cases/resolve-actor.ts`
- Create in `packages/domain/test/`:
  - `fakes/in-memory-family-gateway.ts`, `fakes/in-memory-membership-gateway.ts`, `fakes/in-memory-invite-gateway.ts`
  - `family/*.test.ts`
- Create in `apps/web/src/adapters/family/`: `drizzle-family-gateway.ts`, `drizzle-membership-gateway.ts`, `drizzle-invite-gateway.ts`
- Create: `apps/web/src/adapters/activity/drizzle-activity-gateway.ts` (insert-only; used by every unit of work from here on)
- Create: `apps/web/src/composition/family.ts`
- Create in `apps/web/src/http/`:
  - `require-actor.ts` (Supabase SSR cookie or Bearer token → `ResolveActorUseCase`)
  - `with-api-errors.ts` (category → 422/404/403/409, ZodError → 400, else 500)
- Create in `apps/web/app/api/v1/`: `families/route.ts` (POST), `invites/route.ts` (POST), `invites/[token]/accept/route.ts` (POST)
- Create: `packages/api-contract/src/family.ts`
- Create: `packages/domain/src/shared/iso4217.ts` (the active currency list with minor units)
- Test: `apps/web/test/integration/adapters/family/*.integration.test.ts`
- Test: `apps/web/test/integration/routes/families.integration.test.ts`

**Interfaces:**
- Consumes: Task 2 shared kernel, Task 5 `Db` and tables.
- Produces:
  - `CreateFamilyCommand { actorUserId; name; currencyCode; timeZone; countryCode?; openingPotMinor; signupAllowed: boolean }` → `Family`
  - `interface Family { id; name; currencyCode; minorUnit; numberLocale; timeZone; countryCode: string | null; setAsideOverrideMinor: number | null; alertThresholds: readonly number[] }`
  - `MembershipGateway.findActive(userId: string): Promise<{ familyId: string; role: Role } | undefined>`
  - `ResolveActorUseCase.execute({ userId }) → Actor` (throws `NotAMemberError`, category `not_allowed`)
  - `requireActor(request: Request): Promise<Actor>`
  - `withApiErrors(handler)`
  - `CreateInviteUseCase` (admin only; token from `IdGenerator`; only its hash is stored; expires in 7 days)
  - `AcceptInviteUseCase` (single use; refuses expired or cancelled invites with `InviteNotUsableError`, category `conflict`)

Create-family validation:
- The name is required, trimmed and 1–80 characters of any language.
- The currency must be in `iso4217.ts`.
- The time zone must be valid IANA (checked through `Intl.supportedValuesOf('timeZone')`).
- `openingPotMinor` must be ≥ 0.
- If `signupAllowed` is false, it throws `SignupClosedError` (category `not_allowed`). The app computes `signupAllowed` from `SIGNUP_MODE` and `ALLOWED_SIGNUP_EMAILS`, or from a valid invite.
- The creator becomes an `admin` member.
- An `opening` pot entry is written in the same unit of work.

- [ ] **Step 1: Write the failing domain tests.** Use fakes, and test happy path, mapping, each rule and no side effects.

```ts
it('creates the family with the creator as admin and an opening pot entry', async () => { … expect(memberships.all()).toEqual([{ userId: 'u1', familyId: fam.id, role: 'admin' }]); expect(potEntries.all()[0]).toMatchObject({ kind: 'opening', amountMinor: 0 }); });
it('locks minorUnit from ISO 4217 (JPY 0, KWD 3, INR 2)', …);
it('refuses an unknown currency, a bad time zone, an empty name, a negative opening balance — and saves nothing', …);
it('refuses when signup is not allowed', …);
it('accepts an invite once; a second accept throws InviteNotUsableError', …);
it('resolve-actor throws NotAMemberError for a removed member', …);
```

- [ ] **Step 2: Run** `pnpm --filter @nestwise/domain test family`. Expected: FAIL.
- [ ] **Step 3: Implement the domain side**: the models, ports (including a `FamilyUnitOfWork` for family + membership + opening pot entry), errors and use cases.
- [ ] **Step 4: Run the domain tests again.** Expected: PASS.
- [ ] **Step 5: Write the failing integration tests.**
  - Adapters: a round trip of each gateway. `MembershipGateway.findActive` never returns a membership of another family's user. A removed member is not found.
  - Route: `POST /api/v1/families` without a session gives 401. With a test session but not on the allow-list it gives 403. With a session and allowed it gives 201, with the body shape from `api-contract`.
- [ ] **Step 6: Implement the outside**: the adapters, the composition, `requireActor` and `withApiErrors`, the routes, and the Zod shapes. `requireActor` returns 401 (via a `NotSignedInError` mapped in `withApiErrors`) when there's no session.
- [ ] **Step 7: Run** `pnpm test:integration`. Expected: PASS.
- [ ] **Step 8: Commit:** `git commit -m "feat(family): create family, invites, requireActor and signup gate"`.

### Task 7: Plan feature — groups, items, templates, and the plan import

**Files:**
- Create in `packages/domain/src/plan/`: `models.ts`, `ports.ts`, `errors.ts`, `index.ts`, and `use-cases/`:
  - `add-item.ts`, `update-item.ts`, `archive-item.ts`, `reorder-items.ts`, `get-templates.ts`, `import-plan.ts`
- Create: `apps/web/src/adapters/plan/drizzle-plan-gateway.ts`
- Create: `apps/web/src/composition/plan.ts`
- Create: `apps/web/app/api/v1/templates/**/route.ts`
- Create: `packages/api-contract/src/plan.ts`
- Create: `scripts/import-plan.ts` (`pnpm import-plan --family <id>`, loading `fixtures/sample-family.ts` **templates only**)
- Test: `packages/domain/test/plan/*.test.ts` and `apps/web/test/integration/adapters/plan/*.integration.test.ts`

**Interfaces:**
- Produces:
  - `type ItemKind = 'monthly' | 'yearly' | 'savings'`
  - `interface Item { id; familyId; groupId; kind: ItemKind; name; sort: number; archived: boolean; seedKey: string | null }`
  - `interface TemplateLine { itemId; amountMinor; dueMonth: number | null; dueDay: number | null; hintMinMinor: number | null; hintMaxMinor: number | null }`
  - `PlanGateway`, which exposes:
    - `listGroups(familyId)`, `listItems(familyId, { includeArchived })`
    - `findItem(familyId, itemId)`
    - `saveGroup`, `saveItem`, `saveTemplateLine`
    - `findTemplateLine(familyId, itemId)`
  - `ImportPlanUseCase.execute({ actor, plan: PlanImport }) → { groups: number; items: number }`
  - `GetTemplatesUseCase.execute({ actor }) → Templates` (grouped and ordered, with totals per kind)

Import mapping: `due_month` only for the 8 insurance and education items, plus Pongal = 1. Everything else is `null`.

Rules:
- `edit_plan` is admin only.
- Amounts are ≥ 0.
- `dueMonth` (1–12) and `dueDay` (1–31) are allowed only on `yearly` items. Otherwise the use case throws `InvalidPlanCommandError`.
- An archived item can't be edited.
- An import into a family that already has items is refused (`PlanAlreadyImportedError`, category `conflict`).

- [ ] **Step 1: Write the failing tests.**

```ts
it('imports the sample plan: 3 kinds, totals 81,500 / 17,000 / 4,43,000', async () => {
  await importPlan.execute({ actor: admin, plan: samplePlanImport });
  const t = await getTemplates.execute({ actor: admin });
  expect(t.totals).toEqual({ monthly: 8_150_000, savings: 1_700_000, yearly: 44_300_000 });
  expect(t.yearly.filter((l) => l.dueMonth !== null)).toHaveLength(9);   // 8 dated + Pongal
  expect(t.yearly.find((l) => l.seedKey === 'deepavali')!.dueMonth).toBeNull();
});
it('refuses a due month on a monthly item and saves nothing', …);
it('member cannot edit the plan (NotAllowedError)', …);
it('refuses a second import (PlanAlreadyImportedError)', …);
it('gold savings keeps its 10,000–20,000 hint', …);
```

- [ ] **Step 2: Run** `pnpm --filter @nestwise/domain test plan`. Expected: FAIL.
- [ ] **Step 3: Implement the domain side.**
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Write the integration tests**: the adapter round trip with the family filter, and `scripts/import-plan.ts` against the test DB, which yields 20 + 2 + 22 items.
- [ ] **Step 6: Implement** the adapter, composition, routes and script.
- [ ] **Step 7: Run** `pnpm test:integration`. Expected: PASS.
- [ ] **Step 8: Commit:** `git commit -m "feat(plan): templates and plan import"`.

### Task 8: Month-budget feature — ensure month, edit a month line, month summary

**Files:**
- Create in `packages/domain/src/month-budget/` (alongside `models.ts` from Task 4): `ports.ts`, `errors.ts`, `index.ts`, and `use-cases/`:
  - `ensure-month-budget.ts`, `set-month-line.ts`, `copy-or-blank-month.ts`, `get-month-summary.ts`
- Create: `apps/web/src/adapters/month-budget/drizzle-month-budget-gateway.ts` and `drizzle-actuals-gateway.ts`
- Create: `apps/web/src/composition/month-budget.ts`
- Create: `apps/web/app/api/v1/months/[ym]/**/route.ts`
- Create: `packages/api-contract/src/month-budget.ts`
- Test: `packages/domain/test/month-budget/*.test.ts` and `apps/web/test/integration/adapters/month-budget/*`

**Interfaces:**
- Consumes: `PlanGateway` (Task 7), `lineFigures`/`groupFigures`/`monthTotals` (Task 4), `Period` (Task 2).
- Produces:
  - `EnsureMonthBudgetUseCase.execute({ familyId, period }) → MonthBudget`
    - Idempotent: it creates from the monthly and savings templates when missing, with status `active`.
    - It is used by Task 11 and Task 14, and needs no actor (it's a system operation).
  - `SetMonthLineUseCase.execute({ actor, period, itemId, plannedMinor })` (`edit_month_budget`)
  - `CopyOrBlankMonthUseCase.execute({ actor, period, mode: 'copy_previous' | 'blank' })`
    - Refused with `MonthHasExpensesError` (category `conflict`) once any expense exists in that month.
  - `GetMonthSummaryUseCase.execute({ actor, period }) → MonthSummary { lines: (LineFigures & { itemId; name; groupName })[]; groups; totals; savings }`
  - `ActualsGateway.sumByItem(familyId, period) → ReadonlyMap<string, number>` (confirmed, not deleted, not merged; refunds subtracted)

- [ ] **Step 1: Write the failing tests.**

```ts
it('creates November from the template once; a second ensure returns the same budget', …);
it('editing December changes neither November nor January (AC-07)', …);
it('editing the template after November exists leaves November unchanged (AC-08)', …);
it('month summary for the October 2026 fixture totals 84,450 vs 81,500 (+2,950)', …);  // fake ActualsGateway fed from the fixture
it('copy/blank is refused once the month has an expense', …);
it('viewer cannot set a month line', …);
```

- [ ] **Step 2: Run** `pnpm --filter @nestwise/domain test month-budget`. Expected: FAIL.
- [ ] **Step 3: Implement the domain side.**
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Write the integration tests**:
  - `ActualsGateway.sumByItem` subtracts refunds and ignores pending, deleted and merged transactions.
  - Concurrent `ensure` for the same month creates one budget (unique constraint + the adapter maps `23505` to returning the existing budget).
- [ ] **Step 6: Implement** the adapters, composition and routes.
- [ ] **Step 7: Run** `pnpm test:integration`. Expected: PASS.
- [ ] **Step 8: Commit:** `git commit -m "feat(month-budget): independent month budgets and summary"`.

### Task 9: Year-plan feature — ensure year, schedule, done, cancel, first-year check, year view

**Files:**
- Create in `packages/domain/src/year-plan/` (alongside `models.ts` from Task 3): `ports.ts`, `errors.ts`, `index.ts`, and `use-cases/`:
  - `ensure-year-plan.ts`, `set-year-line-schedule.ts`, `mark-year-line-done.ts`, `cancel-year-line.ts`, `apply-first-year-check.ts`, `get-year-plan.ts`
- Create: `apps/web/src/adapters/year-plan/drizzle-year-plan-gateway.ts` and `drizzle-year-paid-gateway.ts`
- Create: `apps/web/src/composition/year-plan.ts`
- Create: `apps/web/app/api/v1/years/[y]/**/route.ts`
- Create: `packages/api-contract/src/year-plan.ts`
- Test: `packages/domain/test/year-plan/*.test.ts` and integration tests for the adapters

**Interfaces:**
- Consumes: `PlanGateway`, `YearLine`, `yearLineStatus`, `remainingMinor`.
- Produces:
  - `EnsureYearPlanUseCase.execute({ familyId, year }) → YearPlan` (idempotent, from the yearly template)
  - `SetYearLineScheduleUseCase.execute({ actor, yearLineId, dueMonth: number | null, dueDay: number | null })`
  - `MarkYearLineDoneUseCase.execute({ actor, yearLineId })`
  - `CancelYearLineUseCase.execute({ actor, yearLineId })`, which refuses a paid line (`YearLineNotCancellableError`, category `conflict`)
  - `ApplyFirstYearCheckUseCase.execute({ actor, year, stillToComeLineIds: readonly string[], setupPeriod: Period })`
    - Lines due before `setupPeriod`, and unticked lines, become `before_nestwise`.
    - It refuses to run twice (`FirstYearCheckDoneError`, category `conflict`).
  - `GetYearPlanUseCase.execute({ actor, year }) → { lines: (YearLine & { paidMinor; remainingMinor; status })[]; undatedRemainingMinor: number; totalMinor: number }`
  - `YearPaidGateway.paidByLine(familyId, year) → ReadonlyMap<string, number>`

All plan-editing use cases require `edit_plan`, so they are admin only.

- [ ] **Step 1: Write the failing tests.**

```ts
it('first-year check at Nov 2026: May/Jun/Jul/Oct lines and unticked undated lines become before_nestwise', …);
it('ticked Deepavali stays open and counts in undatedRemaining', …);
it('a paid line cannot be cancelled and stays unchanged', …);
it('marking done with less paid leaves remaining 0 and status paid', …);
it('cannot set a due month outside 1–12 (InvalidYearPlanCommandError) and saves nothing', …);
it('year view for the fixture 2026 plan totals 4,43,000', …);
```

- [ ] **Step 2: Run** `pnpm --filter @nestwise/domain test year-plan`. Expected: FAIL.
- [ ] **Step 3: Implement the domain side.**
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Write the integration tests** for the adapter round trip, the family filter, and `paidByLine` summing allocations with `plan_year`.
- [ ] **Step 6: Implement** the adapters, composition and routes.
- [ ] **Step 7: Run** `pnpm test:integration`. Expected: PASS.
- [ ] **Step 8: Commit:** `git commit -m "feat(year-plan): year plans, scheduling and first-year check"`.

### Task 10: Pot feature — checklist, deposits, savings, extra money, balance

**Files:**
- Create in `packages/domain/src/pot/` (alongside `models.ts` from Task 3): `ports.ts`, `errors.ts`, `index.ts`, and `use-cases/`:
  - `confirm-pot-deposit.ts`, `confirm-savings.ts`, `skip-checklist-item.ts`, `record-pot-movement.ts`, `get-checklist.ts`, `get-pot-balance.ts`
- Create in `apps/web/src/adapters/pot/`: `drizzle-pot-gateway.ts`, `drizzle-pot-unit-of-work.ts`
- Create: `apps/web/src/composition/pot.ts`
- Create: `apps/web/app/api/v1/pot/**/route.ts`
- Create: `packages/api-contract/src/pot.ts`
- Test: `packages/domain/test/pot/*.test.ts` and `apps/web/test/integration/adapters/pot/*`

**Interfaces:**
- Consumes: `setAsideFor`, `splitSetAside` (Task 3), the year plan via `YearPlanGateway` (Task 9), `ActivityGateway` (Task 2, adapter from Task 6).
- Produces:
  - `ConfirmPotDepositUseCase.execute({ actor, period, amountMinor })` (`confirm_checklist`)
    - The amount must be > 0.
    - A second deposit for the same family-month throws `PotDepositAlreadyExistsError` (category `conflict`), both from the use case's own check and from the adapter mapping `23505`.
    - It writes the deposit and the activity row through `PotUnitOfWork`.
  - `ConfirmSavingsUseCase.execute({ actor, period, itemId, amountMinor })`
  - `SkipChecklistItemUseCase.execute({ actor, period, itemId: string | null })` (`null` means the pot deposit)
  - `RecordPotMovementUseCase.execute({ actor, kind: 'extra_in' | 'taken_out', amountMinor, note })`, where `taken_out` requires a non-empty note
  - `GetChecklistUseCase.execute({ actor, period }) → { pot: { suggestedMinor; status: 'pending' | 'done' | 'skipped' }; savings: { itemId; name; plannedMinor; hint; status }[] }`
  - `GetPotBalanceUseCase.execute({ actor }) → { balanceMinor: number }`, using TRD §5.4. Yearly allocations come from `PotGateway.yearlySpendMinor(familyId)`, with refunds subtracted.

- [ ] **Step 1: Write the failing tests.**

```ts
it('confirms ₹36,916.66 for Nov 2026 and writes deposit + activity together', …);
it('refuses a second November deposit with PotDepositAlreadyExistsError; nothing new saved', …);
it('rolls back the deposit when writing the activity entry fails', …);   // InMemoryPotUnitOfWork restores its snapshot
it('suggests the set-aside from the year plan: Nov 2026 = 3,691,666; with override 3,700,000', …);
it('balance = opening 50,000 + deposits − taken_out + extra_in − yearly spend', …);
it('viewer cannot confirm; taken_out without a note is refused', …);
```

- [ ] **Step 2: Run** `pnpm --filter @nestwise/domain test pot`. Expected: FAIL.
- [ ] **Step 3: Implement the domain side.**
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Write the integration tests**:
  - Two concurrent `ConfirmPotDeposit` executions for the same month: exactly one succeeds, and the other gets `PotDepositAlreadyExistsError`.
  - The unit of work rolls back both rows when the activity insert fails.
  - The family filter on every query.
- [ ] **Step 6: Implement** the adapters, composition and routes.
- [ ] **Step 7: Run** `pnpm test:integration`. Expected: PASS.
- [ ] **Step 8: Commit:** `git commit -m "feat(pot): checklist, deposits, savings and balance"`.

### Task 11: Expenses feature — record (typed), edit, delete, refund, list

**Files:**
- Create in `packages/domain/src/expenses/`: `models.ts`, `ports.ts`, `errors.ts`, `index.ts`, and `use-cases/`:
  - `record-expense.ts`, `edit-expense.ts`, `delete-expense.ts`, `restore-expense.ts`, `list-expenses.ts`
- Create: `apps/web/src/adapters/expenses/drizzle-transaction-gateway.ts` and `drizzle-expenses-unit-of-work.ts`
- Create: `apps/web/src/composition/expenses.ts`
- Create: `apps/web/app/api/v1/transactions/**/route.ts`
- Create: `packages/api-contract/src/expenses.ts`
- Test: `packages/domain/test/expenses/*.test.ts` and `apps/web/test/integration/adapters/expenses/*`

**Interfaces:**
- Consumes:
  - `PlanGateway.findItem`
  - `EnsureMonthBudgetUseCase` (Task 8, a sub-step for Review Focus 5)
  - `ActivityGateway`, `Clock`
  - `todayIn` (for the default date in the API layer)
- Produces:
  - `type TransactionKind = 'expense' | 'refund'`
  - `interface Allocation { itemId: string; amountMinor: number; planYear: number | null }`
  - `interface Transaction { id; familyId; kind; amountMinor; txnDate: IsoDate; period: Period; merchant: string | null; note: string | null; enteredBy; paidBy; captureMethod: 'typed'; status: 'confirmed'; allocations: readonly Allocation[]; deletedAt: Date | null; createdAt: Date }`
  - `RecordExpenseUseCase.execute(RecordExpenseCommand) → Transaction` (the rules are in the clean-architecture skill §4 example)
    - `paidBy` must be an active member of the same family.
    - For a yearly item, `planYear` defaults to the year of `txnDate`.
  - `EditExpenseUseCase.execute({ actor, id, changes })`: a date change moves the period
  - `DeleteExpenseUseCase.execute({ actor, id })`: soft delete, restorable for 30 days
  - `RestoreExpenseUseCase.execute({ actor, id })`: refused after 30 days with `ExpenseNotRestorableError` (category `conflict`)
  - `ListExpensesUseCase.execute({ actor, period, itemId?, enteredBy? }) → Transaction[]`

Every change writes an activity row with `before`/`after` through `ExpensesUnitOfWork`.

- [ ] **Step 1: Write the failing tests.**

```ts
it('records ₹945 split 800 groceries + 145 soaps; period 2026-10; enteredBy = actor', …);
it('returns the existing expense for a repeated client id; still one stored', …);
it('refuses allocations that do not add up, an archived item, another family's item, a viewer — nothing saved', …);
it('stores ₹204.50 as 20450 exactly', …);
it('a back-dated expense into a month with no budget creates that month from the template (Review Focus 5)', …);
it('paying Deepavali clothing (yearly) reduces the pot and the line's remaining; deleting it restores both (Review Focus 4)', …);
it('a refund of 300 against groceries lowers that month's actual by 300', …);
it('moving the date from 31 Oct to 1 Nov moves the actual between months with no double count', …);
it('restore after 30 days is refused', …);
```

- [ ] **Step 2: Run** `pnpm --filter @nestwise/domain test expenses`. Expected: FAIL.
- [ ] **Step 3: Implement the domain side.**
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Write the integration tests**:
  - An idempotent insert under two concurrent posts with the same id gives one row.
  - The allocation-sum trigger is satisfied in one unit of work.
  - Cross-family reads return nothing.
  - The route returns 201, then 200 on a retry, 422 on a bad sum, 403 for a viewer, and 404 for an unknown item.
- [ ] **Step 6: Implement** the adapters, composition and routes. The route defaults `txnDate` to `todayIn(family.timeZone, now)` when it's omitted (Review Focus 1).
- [ ] **Step 7: Run** `pnpm test:integration`. Expected: PASS.
- [ ] **Step 8: Commit:** `git commit -m "feat(expenses): typed expenses with splits, refunds and soft delete"`.

### Task 12: Forecast feature — 12-month forecast and Home summary

**Files:**
- Create in `packages/domain/src/forecast/` (alongside `models.ts` from Task 3): `ports.ts`, `index.ts`, and `use-cases/`: `get-forecast.ts`, `get-home-summary.ts`
- Create: `apps/web/src/adapters/forecast/drizzle-forecast-gateway.ts` (reads year lines + paid amounts + the template for estimate years)
- Create: `apps/web/src/composition/forecast.ts`
- Create: `apps/web/app/api/v1/forecast/route.ts` and `apps/web/app/api/v1/home/route.ts`
- Create: `packages/api-contract/src/forecast.ts`
- Test: `packages/domain/test/forecast/get-forecast.test.ts`

**Interfaces:**
- Consumes:
  - `projectPot`, `setAsideFor`, `remainingMinor`, `yearLineStatus`
  - `GetPotBalanceUseCase` and `GetChecklistUseCase` (Task 10)
  - `GetMonthSummaryUseCase` (Task 8)
  - `Clock`, `todayIn`
- Produces:
  - `GetForecastUseCase.execute({ actor }) → Forecast & { bills: { period; lines: { name; remainingMinor; status }[] }[]; undated: { totalMinor; count; lines }; monthlyPlanMinor; savingsPlanMinor }`
    - Months in a year with no plan use the template and are flagged `estimate`.
  - `GetHomeSummaryUseCase.execute({ actor }) → { pot: { balanceMinor; safeToSpendNowMinor; firstRed: { period; shortfallMinor } | null; fixPerMonthMinor: number | null }; next3Months: Forecast['bills']; thisMonth: { plannedMinor; actualMinor; groupsOver: string[] }; cards: ('checklist' | 'undated' | 'month_review')[] }`

- [ ] **Step 1: Write the failing tests.** The setup is fakes holding the imported sample plan, the first-year check at Nov 2026 with only Deepavali ticked, and B0 = 0.

```ts
it('reproduces the Nov 2026 worked example end balances', …);   // same array as Task 3
it('marks 2027 months as estimate before the 2027 plan exists, and not after EnsureYearPlan(2027)', …);
it('home shows the next 3 months of bills (Nov bike 1,500; Jan Pongal 15,000)', …);
it('home lists 13 undated 2027 items worth 1,57,000 once the 2027 plan exists', …);
it('home shows the checklist card on the 1st until the deposit is confirmed or skipped', …);
```

- [ ] **Step 2: Run** `pnpm --filter @nestwise/domain test forecast`. Expected: FAIL.
- [ ] **Step 3: Implement** the use cases. They assemble a `ForecastInput` from the gateways and call `projectPot`.
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Implement** the adapter, composition and routes, and add an integration test for the adapter.
- [ ] **Step 6: Run** `pnpm test:integration`. Expected: PASS.
- [ ] **Step 7: Commit:** `git commit -m "feat(forecast): 12-month forecast and home summary"`.

### Task 13: Web app screens — sign-in, setup, Home, Month, Year, Templates, Forecast, Add, Settings, Install

The screens are plain and functional, built with shadcn/ui. Visual design is parked (PRD §9). Every page that shows data is a Server Component calling a `make*` factory. Forms post to `/api/v1` through `src/client/api-client.ts`.

**Files:**
- Create: `apps/web/app/(auth)/sign-in/page.tsx`
  - Email-code flow first: enter email → `signInWithOtp` → 6-digit code → `verifyOtp`.
  - Google button below. In installed mode it shows the Stage 0 finding as a note.
- Create: `apps/web/app/(app)/setup/page.tsx`, a wizard:
  - name, currency (searchable ISO 4217 list, default INR), time zone (suggested by `Intl`), country
  - opening pot balance
  - "Import our plan", shown only when the email is in `PLAN_IMPORT_EMAILS`; it calls `ImportPlanUseCase`
  - the first-year check list
- Create the pages under `apps/web/app/(app)/`:
  - `home/page.tsx`, `month/[ym]/page.tsx`, `year/[y]/page.tsx`, `templates/page.tsx`, `forecast/page.tsx`, `add/page.tsx`
  - `settings/family/page.tsx`, `settings/account/page.tsx`, `install/page.tsx`
- Create: `apps/web/app/(app)/layout.tsx` (bottom nav: Home, Budgets, Add, Activity placeholder; safe-area insets)
- Create: `apps/web/app/manifest.ts`, `apps/web/app/sw.ts` (Serwist, as proven in Stage 0)
- Create: `apps/web/src/client/api-client.ts`, `apps/web/src/client/format.ts`
  - `formatMoney(minor, currency, minorUnit, locale)`
  - `formatMoneyRounded(...)` for tiles, rounding half-up to whole units
- Create: `apps/web/messages/en.json`
- Test: `apps/web/test/unit/format.test.ts`
- Test: `apps/web/test/e2e/core.spec.ts` (Playwright, project `webkit-iphone` using `devices['iPhone 15']`)

**Interfaces:**
- Consumes: every `make*` factory from Tasks 6–12, and `/api/v1` from the same tasks.
- Produces:
  - the routes listed above
  - `formatMoney` and `formatMoneyRounded`

- [ ] **Step 1: Write the failing unit tests.**

```ts
expect(formatMoney(13_541_667, 'INR', 2, 'en-IN')).toBe('₹1,35,416.67');
expect(formatMoneyRounded(3_691_667, 'INR', 2, 'en-IN')).toBe('₹36,917');
expect(formatMoney(1500, 'JPY', 0, 'ja-JP')).toBe('￥1,500');
expect(formatMoney(1234, 'KWD', 3, 'en-KW')).toMatch(/1\.234/);
```

- [ ] **Step 2: Write the failing e2e test.** It uses the local Supabase mail catcher to read the code.
  1. Sign in with an email code.
  2. Run setup (INR, Asia/Kolkata, opening ₹0, import plan, tick Deepavali).
  3. Home shows the pot "₹0", the checklist card, and Nov bike insurance "₹1,500".
  4. Confirm the deposit, and Home's pot shows "₹36,917".
  5. Add an expense: ₹945, Groceries.
  6. The November month view shows Groceries actual "₹945".
  7. The forecast shows 12 months and no red month.
- [ ] **Step 3: Run** `pnpm --filter web test && pnpm e2e`. Expected: FAIL.
- [ ] **Step 4: Build the pages.**
  - Use next-intl with all strings in `en.json`.
  - No page imports Drizzle or `@nestwise/db`. Add an ESLint `no-restricted-imports` for `@nestwise/db` and `drizzle-orm` in `apps/web/app/**`.
  - Build the install guide: Share → "Add to Home Screen" steps, then the "Turn on reminders" button (wired in Task 14).
- [ ] **Step 5: Run the tests again.** Expected: PASS.
- [ ] **Step 6: Commit:** `git commit -m "feat(web): core screens, setup wizard and install guide"`.

### Task 14: Reminders — push subscriptions, daily job and email fallback

**Files:**
- Create in `packages/domain/src/reminders/`: `models.ts`, `ports.ts`, `index.ts`, `use-cases/plan-daily-notifications.ts`
- Create in `apps/web/src/adapters/reminders/`:
  - `web-push-notification-gateway.ts`, `smtp-email-gateway.ts` (Nodemailer, Gmail SMTP)
  - `drizzle-push-subscription-gateway.ts`, `drizzle-notifications-sent-gateway.ts`
- Create: `apps/web/src/orchestration/run-daily-job.ts`
- Create: `apps/web/app/api/cron/daily/route.ts` (checks `Authorization: Bearer ${CRON_SECRET}`)
- Create: `apps/web/app/api/v1/push/subscribe/route.ts`
- Create: `apps/web/vercel.json` (`{"crons":[{"path":"/api/cron/daily","schedule":"30 2 * * *"}]}`)
- Create: `apps/web/src/client/push.ts`
- Test: `packages/domain/test/reminders/plan-daily-notifications.test.ts`
- Test: `apps/web/test/integration/orchestration/run-daily-job.integration.test.ts`

**Interfaces:**
- Consumes:
  - `EnsureMonthBudgetUseCase`, `EnsureYearPlanUseCase`, `GetForecastUseCase` and `GetChecklistUseCase` results
  - `todayIn`
- Produces:
  - `type ReminderKind = 'checklist' | 'bill_prior_month' | 'bill_due_month' | 'bill_3_days' | 'red' | 'undated'`
  - `interface PlannedNotification { userId: string; dedupeKey: string; kind: ReminderKind; title: string; body: string; url: string; emailFallback: boolean }`
  - `PlanDailyNotificationsUseCase.execute({ family, members, today: IsoDate, forecast, yearLines, checklist, lastRedState }) → { notifications: PlannedNotification[]; nextRedState }`
    - A pure decision with no I/O.
    - Dedupe keys follow TRD §8.4: `bill:{lineId}:{kind}:{yyyy-mm}`, `checklist:{yyyy-mm}`, `undated:{yyyy-mm}`.
    - `red` fires only when red appears, the shortfall grows by more than 10%, or the first red month moves earlier.
  - `runDailyJob(now: Date)`: for each family, in its time zone, it runs:
    1. ensure the month on the 1st
    2. ensure next year's plan on 1 December
    3. plan the notifications
    4. skip any whose `(userId, dedupeKey)` is already in `notifications_sent`
    5. send by push
    6. send by email when `emailFallback` is set and the user has no live subscription
    7. record each send

- [ ] **Step 1: Write the failing domain tests.**

```ts
it('on 1 Apr 2027 plans bill_prior_month for School Term 1 (May, ₹60,000) to every member', …);
it('on 1 Nov 2026 plans the checklist reminder and bill_due_month for bike insurance', …);
it('plans bill_3_days only for lines with a dueDay', …);
it('does not repeat red when the same shortfall persists; does when it grows by >10%', …);
it('marks only bill and red reminders as emailFallback', …);
it('plans undated on the 15th only when undated lines exist', …);
```

- [ ] **Step 2: Run** `pnpm --filter @nestwise/domain test reminders`. Expected: FAIL.
- [ ] **Step 3: Implement** `PlanDailyNotificationsUseCase` and its models.
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Write the failing integration test.**
  - Run `runDailyJob(new Date('2026-10-31T21:00:00Z'))` twice against the test DB, using fake push and email gateways that record what they send.
  - The first run creates the November month budget and sends each planned notification once. The second run sends nothing new.
  - A 410 response from the push gateway deletes that subscription.
- [ ] **Step 6: Implement** the adapters, the orchestration, the cron route, the subscribe route and `push.ts`.
  - `push.ts` requests permission only from a button tap in standalone mode, then posts the subscription.
- [ ] **Step 7: Run** `pnpm test:integration`. Expected: PASS.
- [ ] **Step 8: Commit:** `git commit -m "feat(reminders): daily job, web push and email fallback"`.

### Task 15: Production deploy, plan import for the family, acceptance run, backups

**Files:**
- Create: `.github/workflows/ci.yml` (`pnpm -r lint typecheck test`, plus `test:integration` against a Postgres service container)
- Create: `.github/workflows/backup.yml` (weekly `pg_dump --schema=app`, uploaded as an encrypted artifact and kept 4 weeks; needs the `PROD_DATABASE_URL` and `BACKUP_PASSPHRASE` secrets)
- Create: `apps/web/.env.example`, with every variable in TRD §13 and no values
- Create: `docs/RUNBOOK.md` (deploy, migrate prod, import plan, restore a backup)
- Create: `scripts/seed-dev.ts` (guarded)

- [ ] **Step 1: Write the failing guard test.**

```ts
it('seed:dev refuses to run against production', async () => {
  await expect(runSeedDev({ VERCEL_ENV: 'production', DATABASE_URL: 'postgres://prod' })).rejects.toThrow(/production/);
});
```

- [ ] **Step 2: Run** `pnpm test scripts`. Expected: FAIL.
- [ ] **Step 3: Implement** `scripts/seed-dev.ts` with the guard. It loads `fixtures/sample-family.ts`, including the October transactions, into dev only.
- [ ] **Step 4: Run the tests again.** Expected: PASS.
- [ ] **Step 5: Deploy.**
  - The user sets the env vars in Vercel.
  - Run `vercel --prod` from `apps/web`, then apply the prod migrations with `pnpm --filter @nestwise/db migrate:prod`.
  - Expected: `/api/v1/health` returns 200.
- [ ] **Step 6: Set up the family.** The user signs up and creates the family in the installed iPhone app. Run `pnpm import-plan --family <id>` against prod (templates only), and invite the spouse.
- [ ] **Step 7: Acceptance run.**
  - Run `pnpm e2e` against preview. Expected: PASS.
  - Walk through PRD §7 tests 1–9, 12–14 and 16–18 manually on the iPhone, and tick each in `docs/RUNBOOK.md`.
  - The daily cron fires the next morning, and the 1st-of-month checklist push arrives.
- [ ] **Step 8: Commit:** `git commit -m "chore: CI, backups, runbook and production deploy"`.

---

## Not in this plan (Stage 1b and later)

These come in later plans:
- offline entry and the outbox
- duplicate checks and the Inbox
- the activity screen
- 80% and 100% spending alerts
- the month-end and year-end reviews
- voice (Stage 2), receipts (Stage 3), public launch (Stage 4)

The data model already includes `evidence`, `duplicate_matches` and `activity`, and every change from Task 6 on already writes activity rows.

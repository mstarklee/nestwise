# NestWise Stage 1b Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **REQUIRED for every task that touches server code:** the project skills `hexagonal-architecture` and `clean-architecture` (`.claude/skills/`). They define layout, naming, wiring, errors and fakes. This plan does not repeat them.

**Goal:** Make Stage 1 complete for the family:
- adding expenses with no signal
- the month-end review and closing
- the year-end review (1 December and 1 January)
- duplicate checks and the Inbox
- the Activity screen and ledger
- spending alerts
- the Stage 1a leftovers

**Order:** the design's order (design §10) with one change: duplicate checks and the Inbox (Task 1) come before
offline adding (Task 2), because an expense sent later from the phone needs the Inbox to hold its duplicate question.
Ledger this as the plan's first ruling.

**Architecture:** The same as Stage 1a. Each feature is a folder in `packages/domain/src/<feature>/` (use cases, `*Gateway` ports, pure rules) with Drizzle adapters in `apps/web/src/adapters/<feature>/`, `make*` wiring in `apps/web/src/composition/`, Zod shapes in `packages/api-contract`, thin `/api/v1` routes, and Server Component screens. Offline adding is client-only code in `apps/web/src/client/` (an IndexedDB outbox) that talks to the existing `POST /api/v1/transactions`.

**Tech Stack:** As 1a (Next.js 16.4.3, React 19, TypeScript strict, pnpm, Drizzle + node-postgres, Zod, next-intl, Serwist, web-push, Nodemailer, Vitest, Playwright WebKit), plus **Dexie** for the outbox (named in TRD §8.2).

**Spec:**
- `docs/superpowers/specs/2026-11-03-nestwise-stage-1b-design.md` (approved 2026-11-03; the owner's decisions and order)
- `docs/NestWise_PRD.md` (§5.3, §5.5, §6.2–6.4, §6.6–6.9, §6.12, §7 tests 3, 10, 11, 19)
- `docs/NestWise_TRD.md` (§3.4, §5.6, §5.7, §8.2, §8.4)

**Ledger:** `.superpowers/sdd/2026-11-03-nestwise-stage-1b/progress.md`. Stage 1a's rulings (in `.superpowers/sdd/2026-11-01-nestwise-stage-0-and-1a/progress.md`) still bind.

## Global Constraints

These apply to every task, on top of the Stage 1a plan's Global Constraints (still binding).

- Money is integer minor units; no floats. Only confirmed, not-deleted, not-merged transactions count.
- `txn_date` is the local date in the **family's** time zone; "the 1st", "the 10th", "1 December" and "1 January" are all in the family's time zone (`todayIn`).
- Sign-in is our own email + password; Supabase is only the Postgres host. No Supabase Auth, keys or email codes.
- The service worker **never precaches pages**. Navigations stay NetworkFirst; `/api/*` stays NetworkOnly.
- Every UI and notification string lives in `apps/web/messages/en.json`; the domain returns message keys and values only.
- Every reminder is sent once per person, deduped through `notifications_sent`. Nothing repeats daily.
- Offline covers **adding** expenses only (including split and refund). Editing, deleting, restoring and every other screen stay online-only.
- The Inbox never counts: a transaction with `status = 'pending'` is excluded from actuals, the pot, year-line paid amounts and the forecast.
- Admin-only: closing a month, the year-end answers, the December review, template apply-to-future, family rename, alert thresholds. Members may add expenses and answer duplicate questions.
- Visual design stays plain shadcn/ui; the redesign is a later piece of work. Screens must work at phone width.
- Fictional sample transactions never reach production. AI is not part of 1b.
- Commits: one local commit per finished task, with the message given. Never push or deploy without asking the owner.

## Review Focus

Inputs the spec implies but no spec test exercises. Each has a test in the task that owns the code.

1. **An outbox entry the server rejects** (session expired → 401, a now-archived item → 422, a deleted family member as payer → 422). It must stay on the phone, visible as "couldn't send" with Fix and Discard, never silently dropped and never retried forever. Covered by Task 2.
2. **The same outbox entry sent twice at once** (the `online` event and opening the app fire together, or two tabs). One transaction, and no duplicate question about the entry against itself. Covered by Task 1 (candidates exclude the same id) and Task 2 (single-flight flush).
3. **An expense added offline that is dated in a month already closed** (bought on the 30th, sent on the 11th). It is saved and counted in that month, and its activity row is marked late. Covered by Task 3.
4. **"Still to pay" on a part-paid yearly line** (Bike service ₹5,000 paid of ₹15,000). The ₹5,000 already paid still counts against it; only the ₹10,000 left appears in the new year's forecast; nothing is counted twice. Covered by Task 4.
5. **A duplicate question that goes stale**: one side is deleted, or its amount is edited, before anyone answers. The question disappears from the Inbox and the remaining expense counts normally. Covered by Task 1.

---

### Task 1: Duplicate checks and the Inbox

**Files:**
- Create in `packages/domain/src/duplicates/`: `models.ts`, `ports.ts`, `errors.ts`, `index.ts`, `rules.ts` (pure), and `use-cases/`: `resolve-duplicate.ts`, `list-inbox.ts`
- Modify: `packages/domain/src/expenses/models.ts` (`captureMethod`, `status`), `use-cases/record-expense.ts`, `edit-expense.ts`, `delete-expense.ts`, `ports.ts`
- Create: `apps/web/src/adapters/duplicates/drizzle-duplicate-match-gateway.ts`; modify `apps/web/src/adapters/expenses/*` and `composition/expenses.ts`; create `composition/duplicates.ts`
- Create: `apps/web/app/api/v1/inbox/route.ts` (GET), `apps/web/app/api/v1/duplicates/[id]/resolve/route.ts` (POST); `packages/api-contract/src/duplicates.ts`
- Create: `apps/web/app/(app)/inbox/page.tsx` and `inbox-actions.tsx`; modify `app/(app)/add/add-expense-form.tsx` (inline question), `app/(app)/home/page.tsx` (Inbox card)
- Test: `packages/domain/test/duplicates/*.test.ts`, `apps/web/test/integration/adapters/duplicates/*`, `apps/web/test/integration/routes/inbox.integration.test.ts`

**Interfaces:**
- Consumes: `TransactionGateway`, `ExpensesUnitOfWork`, `ActivityGateway`, `Actor`, `IsoDate`.
- Produces:
  - `Transaction.captureMethod: 'typed' | 'voice' | 'receipt'`; `Transaction.status: 'pending' | 'confirmed'`; `Transaction.mergedInto: string | null`
  - `interface DuplicateMatch { id; familyId; txnA: string; txnB: string; reasons: readonly DuplicateReason[]; status: 'pending' | 'same' | 'different'; resolvedBy: string | null; resolvedAt: Date | null }`
  - `type DuplicateReason = 'other_person' | 'other_method' | 'same_shop'`
  - `findDuplicateCandidates(saved: Transaction, others: readonly Transaction[], differentPairs: ReadonlySet<string>): readonly { other: Transaction; reasons: readonly DuplicateReason[] }[]` (pure, TRD §5.6; `pairKey(a, b)` orders the ids)
  - `interface DuplicateMatchGateway { create(match): Promise<boolean>; find(familyId, id); listPending(familyId); differentPairsFor(familyId, txnId): Promise<ReadonlySet<string>>; save(match); clearPendingFor(familyId, txnId): Promise<void> }`
  - `TransactionGateway.listNear(familyId, txnDate: IsoDate, amountMinor, kind): Promise<readonly Transaction[]>` (live, not merged, `txnDate ± 1 day`)
  - `RecordExpenseResult` gains `duplicate: { matchId: string; other: Transaction } | null`
  - `ResolveDuplicateUseCase.execute({ actor, matchId, answer: 'same' | 'different', keepId?: string }) → void`
  - `ListInboxUseCase.execute({ actor }) → readonly InboxEntry[]` where `InboxEntry = { matchId; pending: Transaction; other: Transaction; reasons }`
  - Routes: `GET /api/v1/inbox` → `{ entries }`; `POST /api/v1/duplicates/{id}/resolve` `{ answer, keepId? }` → 204

Rules (TRD §5.6, PRD §6.7–6.8): on record, a saved expense with a candidate is stored as `status: 'pending'` with one `pending` match against the earliest candidate; without one it is `confirmed`. A resend of a known id (`created: false`) never creates a match. **Same:** the pending one gets `mergedInto = keeper` (the earlier, or `keepId`), a `merged_entry` evidence row holding a snapshot of it, evidence moved to the keeper, match `same`. **Different:** the pending one becomes `confirmed`, match `different`; the pair is never asked again. Editing the amount or date of either side, or deleting either side, clears its pending matches and confirms a pending side (Review Focus 5). Every decision writes an activity row (`duplicate.same` / `duplicate.different`).

- [ ] **Step 1: Write the failing domain tests.**

```ts
it('₹945 typed by me and ₹945 typed by my spouse the next day: the second is pending with reason other_person', …);
it('two ₹23 teas typed by the same person on the same day: no match, both confirmed', …);
it('the ₹1,250 vegetables on 6 and 13 October are never compared (PRD §7 test 11)', …);
it('a resend of the same id returns created:false and creates no match (Review Focus 2)', …);
it('Same: the pending one is merged into the earlier; the month actual counts ₹945 once', …);
it('₹945 typed, voice and receipt fixtures resolve Same twice → one ₹945 expense with 3 evidence rows (PRD §7 test 10)', …);
it('Different: both count, and the pair is never matched again on a later edit', …);
it('deleting the confirmed side clears the pending match and confirms the other (Review Focus 5)', …);
it('editing the pending side's amount to ₹950 clears the match and confirms it (Review Focus 5)', …);
it('a pending expense is excluded from actuals and the pot until answered', …);
```

- [ ] **Step 2: Run** `pnpm test -- duplicates expenses`. Expected: FAIL (`findDuplicateCandidates` not defined).
- [ ] **Step 3: Implement the domain side** and widen the `Transaction` type. Fakes in `packages/domain/test/fakes/` gain `InMemoryDuplicateMatchGateway`.
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS, including every Stage 1a test.
- [ ] **Step 5: Write the integration tests:** the unordered-pair unique index stops a second match for the same pair; `listNear` returns nothing from another family; actuals, `paidByLine` and the pot ignore `pending` and `merged_into` rows; `GET /inbox` and `POST /duplicates/{id}/resolve` return 401 signed out, 404 for another family's match, 409 for an already-resolved match, 204 on success.
- [ ] **Step 6: Implement** the adapter, composition, routes, the inline question on the Add screen ("Your spouse logged ₹945 at the grocery shop yesterday. Same purchase?" with Same / Different / Decide later), the Inbox screen, and the Home card `inbox` (count of pending entries) — add `'inbox'` to `HomeCard`.
- [ ] **Step 7: Run** `pnpm test && pnpm test:integration`. Expected: PASS.
- [ ] **Step 8: Commit:** `git commit -m "feat(duplicates): duplicate checks on save, Same/Different, and the Inbox"`.

### Task 2: Adding expenses with no signal

**Files:**
- Create: `apps/web/src/client/outbox.ts` (Dexie database `nestwise` with tables `outbox` and `addOptions`), `apps/web/src/client/flush-outbox.ts`, `apps/web/src/client/use-outbox.ts`
- Create: `apps/web/app/api/v1/add-options/route.ts` (GET); `packages/api-contract/src/add-options.ts`; use case `GetAddOptionsUseCase` in `packages/domain/src/expenses/use-cases/get-add-options.ts`
- Modify: `apps/web/app/(app)/add/page.tsx` and `add-expense-form.tsx`; `apps/web/src/components/bottom-nav.tsx` (waiting-to-send indicator); `apps/web/app/sw.ts` only if needed for the `/add` navigation (never precache)
- Add dependency: `dexie` (exact current version, `apps/web`)
- Test: `apps/web/test/unit/outbox.test.ts` (with `fake-indexeddb`), `apps/web/test/e2e/offline.spec.ts`

**Interfaces:**
- Consumes: `POST /api/v1/transactions` (unchanged request; the response's `duplicate` from Task 1), `newId()` from `src/client/new-id.ts`.
- Produces:
  - `GetAddOptionsUseCase.execute({ actor }) → AddOptions` where `AddOptions = { items: { id; name; groupName; kind: 'monthly' | 'yearly'; year: number | null }[]; recentItemIds: string[]; members: { userId; name }[]; money: { currency; minorUnit; locale }; timeZone: string; asOf: string }` (open yearly lines from any year are labelled with their year when it differs from the current one, PRD §5.3)
  - `type OutboxEntry = { id: string; body: CreateTransactionRequest; savedAt: string; state: 'waiting' | 'sending' | 'failed'; error: { status: number; code: string } | null }`
  - `addToOutbox(body): Promise<OutboxEntry>`; `flushOutbox(): Promise<{ sent: number; failed: number }>` (single-flight: a call while one runs returns the running promise); `discard(id)`; `useOutbox() → { waiting: number; failed: OutboxEntry[] }`
  - Flush triggers: app start, `online`, `visibilitychange → visible`, and after any successful `api()` call (TRD §8.2).

Rules: Save always goes through the outbox first, online or not, so there is one path. The form shows "Saved" as soon as the entry is stored on the phone. A 2xx removes the entry (201 and 200 alike). 401/403/404/409/422 mark it `failed` with the error and stop retrying it; network errors and 5xx leave it `waiting`. The Add screen renders from `AddOptions`, stored in `addOptions` on every online load and read from there when offline. "Yesterday" is one tap next to the date.

- [ ] **Step 1: Write the failing unit tests.**

```ts
it('a saved entry is in the outbox before any network call', …);
it('flush sends waiting entries oldest first and removes each on 201 or 200', …);
it('two flushes at once send each entry exactly once (Review Focus 2)', …);
it('a network error keeps the entry waiting; a 5xx keeps it waiting', …);
it('401 and 422 mark the entry failed with its code and stop retrying it (Review Focus 1)', …);
it('discard removes a failed entry; nothing else is touched', …);
it('add options are read from the phone when the request fails', …);
```

- [ ] **Step 2: Run** `pnpm test -- outbox`. Expected: FAIL.
- [ ] **Step 3: Implement** the outbox, flush, hook, `GET /api/v1/add-options`, and the Add screen changes. The indicator in the nav shows `waitingToSend` ("{count} waiting to send") and `couldNotSend` ("{count} couldn't send") with a link to fix or discard. Screens served from the phone's cache say "Offline — figures as of {time}" (TRD §8.2).
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Write the e2e test** `offline.spec.ts` (WebKit, iPhone 15, `nestwise_e2e`): sign in, open Add once online, `context.setOffline(true)`, add ₹120 Fruits, see "Saved" and "1 waiting to send", `setOffline(false)`, see the indicator clear, open November and see Fruits include ₹120 exactly once.
- [ ] **Step 6: Run** `pnpm e2e`. Expected: PASS (both specs).
- [ ] **Step 7: Commit:** `git commit -m "feat(offline): add expenses with no signal through a phone outbox"`.

### Task 3: Month-end review and closing

**Files:**
- Create in `packages/domain/src/month-budget/use-cases/`: `get-month-review.ts`, `close-month.ts`; pure `review-rules.ts`
- Modify: `packages/domain/src/expenses/use-cases/record-expense.ts`, `edit-expense.ts`, `delete-expense.ts`, `restore-expense.ts` (late flag); `packages/domain/src/shared/ports.ts` (`ActivityEvent.lateEdit?: boolean`)
- Create: `packages/db/migrations/0004_stage_1b.sql` and schema changes: `activity.late_edit boolean not null default false`; `year_plans.next_year_reviewed_at timestamptz null` (used by Task 4)
- Modify: `apps/web/src/orchestration/run-daily-job.ts` (auto-close on the 10th), `packages/domain/src/reminders/*` (checklist message mentions the review)
- Create: `apps/web/app/api/v1/months/[ym]/review/route.ts` (GET), `.../close/route.ts` (POST); `apps/web/app/(app)/month/[ym]/review/page.tsx` and `review-actions.tsx`
- Modify: `packages/domain/src/forecast/use-cases/get-home-summary.ts` (`month_review` card)
- Test: `packages/domain/test/month-budget/month-review.test.ts`, `close-month.test.ts`; integration for routes and the daily job

**Interfaces:**
- Consumes: `GetMonthSummaryUseCase`, `SetMonthLineUseCase` (raising next month), `YearPaidGateway`, pot checklist (`GetChecklistUseCase`), `ListInboxUseCase` (Task 1), `MonthBudgetGateway`.
- Produces:
  - `MonthBudgetGateway.close(familyId, budgetId, closedBy: string | null, at: Date): Promise<boolean>` (false if already closed)
  - `MonthStatusGateway.statusOf(familyId, period): Promise<MonthStatus | undefined>` (new port used by the expenses use cases)
  - `GetMonthReviewUseCase.execute({ actor, period }) → MonthReview` where `MonthReview = { period; status; totals: LineFigures; over: MonthSummaryLine[]; under: MonthSummaryLine[]; billsPaid: { lineId; name; paidMinor }[]; billsUnpaid: { lineId; name; remainingMinor }[]; savings: { itemId; name; plannedMinor; answer: 'done' | 'different' | 'skipped' | 'unanswered'; amountMinor: number | null }[]; inboxCount: number; streaks: { itemId; name; months: number; suggestedMinor: number }[] }`
  - `CloseMonthUseCase.execute({ actor, period }) → void` (Admin; `MonthAlreadyClosedError`, category `conflict`)
  - `overStreaks(history: readonly MonthSummary[], streakLength: 3): readonly { itemId; months; suggestedMinor }[]` (pure; `suggestedMinor` = the highest actual in the streak, rounded up to the nearest 100 major units)
  - Routes: `GET /api/v1/months/{ym}/review`, `POST /api/v1/months/{ym}/close` → 204

Rules (design §4, PRD §6.12, TRD §5.7): "the biggest few" is the top 3 over and top 3 under by absolute variance, with the full list one tap away. The streak is **3 months in a row** over plan (ruling: fewer false nudges; the design leaves 2 or 3 to the builder). "Raise November" calls `SetMonthLineUseCase` for the month that has just started, never the template. The Home card `month_review` shows from the 1st while last month is `active`. Any write that touches a `closed` month succeeds and records `lateEdit: true`. On the 10th the daily job closes last month if still active (`closedBy: null`). The 1st-of-month checklist notification's values gain `reviewMonth`, and its copy mentions the review: one message, not two.

- [ ] **Step 1: Write the failing domain tests.**

```ts
it('October review: ₹84,450 of ₹81,500, +₹2,950; Groceries +₹2,000 is first over, Fruits −₹500 is under (PRD §7 test 8 data)', …);
it('lists car insurance and school fees as bills paid in October; an unpaid due bill appears as unpaid', …);
it('savings show done, different, skipped or unanswered from the checklist', …);
it('Groceries over in Aug, Sep and Oct gives a streak of 3 with a suggested amount; over in only Sep and Oct gives none', …);
it('closing twice is refused with MonthAlreadyClosedError; a member cannot close', …);
it('an expense dated 30 Oct recorded on 11 Nov after October closed is saved, counted, and its activity row is late (Review Focus 3)', …);
it('the 1 Nov checklist notification carries reviewMonth 2026-10; no second notification is planned', …);
```

- [ ] **Step 2: Run** `pnpm test -- month-review close-month reminders`. Expected: FAIL.
- [ ] **Step 3: Implement the domain side and migration 0004.**
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Write the integration tests:** the review route for another family is 404; close is 403 for a member and 409 the second time; the daily job on 2026-11-10 closes October once and does nothing on 2026-11-11; `activity.late_edit` is true for the late write.
- [ ] **Step 6: Implement** adapters, routes, the review screen ("October is over: take a look" card, the six sections, "Close October", "Raise November to ₹X") and en.json copy.
- [ ] **Step 7: Run** `pnpm test && pnpm test:integration`. Expected: PASS.
- [ ] **Step 8: Commit:** `git commit -m "feat(months): month-end review, closing and late edits"`.

### Task 4: Year-end review and next year's plan review

**Files:**
- Create in `packages/domain/src/year-plan/use-cases/`: `get-year-end-review.ts`, `answer-year-end-line.ts`, `get-next-year-review.ts`, `confirm-next-year-review.ts`
- Modify: `packages/domain/src/year-plan/ports.ts`, `packages/domain/src/forecast/use-cases/get-forecast.ts` and `get-home-summary.ts`, `packages/domain/src/reminders/*`, `apps/web/src/orchestration/run-daily-job.ts`
- Create: routes `apps/web/app/api/v1/years/[y]/year-end/route.ts` (GET), `.../year-end/lines/[id]/route.ts` (POST), `.../next-year-review/route.ts` (GET, POST confirm); screens `apps/web/app/(app)/year/[y]/year-end/page.tsx`, `apps/web/app/(app)/year/[y]/review/page.tsx`
- Test: `packages/domain/test/year-plan/year-end.test.ts`, `next-year-review.test.ts`; integration for routes

**Interfaces:**
- Consumes: `YearPlanGateway`, `YearPaidGateway`, `SetYearLineScheduleUseCase` (amount and month edits in the December review), `PlanDailyNotificationsUseCase`.
- Produces:
  - `GetYearEndReviewUseCase.execute({ actor, year }) → { year; lines: { id; name; plannedMinor; paidMinor; remainingMinor; dueMonth: number | null }[] }` — last year's `open` lines with remaining > 0
  - `AnswerYearEndLineUseCase.execute({ actor, year, lineId, answer: { kind: 'done' } | { kind: 'drop' } | { kind: 'carry'; dueMonth: number | null } }) → void`
  - `GetNextYearReviewUseCase.execute({ actor, year }) → { year; lines: YearLineView[]; confirmed: boolean }`; `ConfirmNextYearReviewUseCase.execute({ actor, year })` sets `next_year_reviewed_at` (migration 0004)
  - `YearPlanGateway.markNextYearReviewed(familyId, yearPlanId, at): Promise<boolean>`
  - `SetYearLineAmountUseCase.execute({ actor, year, lineId, plannedMinor }) → void` (Admin; open lines only; ₹0 allowed; activity row `year_line.amount`) for changing an amount in the December review
  - `HomeCard` gains `'year_end'` (from 1 January while any last-year line is unanswered) and `'next_year'` (from 1 December until confirmed)
  - Reminder kinds `year_end` (dedupe `year_end:{yyyy}`, 1 January, only when last year has open lines; values `year`, `count`, `totalMinor`) and `next_year` (dedupe `next_year:{yyyy}`, 1 December)

Rules (PRD §5.3, TRD §5.7, design §5): **done** sets `state = done`; **drop** sets `state = cancelled`; **carry** keeps the line and its `year`, sets `dueYear` to the new year and `dueMonth` as chosen. The line's paid amount keeps counting payments with `plan_year` = the line's plan year, so the ₹5,000 already paid stays against it and only the ₹10,000 left appears in the forecast (Review Focus 4). The item picker (`AddOptions`, Task 2) offers a carried line under its plan year's label. Until answered: dated lines stay overdue, counted once in month 0; undated ones show under "Last year, still open", outside this year's undated count and nudge. Admin only. The December review is optional: "Looks right" confirms for the whole family.

- [ ] **Step 1: Write the failing domain tests.**

```ts
it('on 2027-01-01 lists 2026 lines open with something left; paid and cancelled lines are not listed', …);
it('done closes the line and its leftover stays in the pot balance', …);
it('drop cancels it and it leaves the forecast', …);
it('carry a part-paid Bike service (₹5,000 of ₹15,000) to March 2027: forecast shows ₹10,000 in March, never ₹15,000 (Review Focus 4)', …);
it('an unanswered dated 2026 line is overdue and counted once in month 0; an unanswered undated one is under last-year-open, not in 2027 undated (PRD §7 test 19)', …);
it('the 1 January notification is planned once with count and total; none when nothing is open', …);
it('1 December: next_year card shows until confirmed; confirming twice is harmless', …);
it('changing a 2027 line's amount changes the 2027 set-aside and leaves the template alone', …);
```

- [ ] **Step 2: Run** `pnpm test -- year-end next-year-review forecast reminders`. Expected: FAIL.
- [ ] **Step 3: Implement the domain side.**
- [ ] **Step 4: Run** `pnpm test`. Expected: PASS.
- [ ] **Step 5: Write the integration tests:** member gets 403 on answers; another family's line is 404; answering an already-answered line is 409; a payment made in 2027 to a carried 2026 line with `plan_year = 2026` reduces its remaining.
- [ ] **Step 6: Implement** adapters, routes, both screens, Home cards and en.json copy.
- [ ] **Step 7: Run** `pnpm test && pnpm test:integration`. Expected: PASS.
- [ ] **Step 8: Commit:** `git commit -m "feat(years): year-end review and next year's plan review"`.

### Task 5: Activity screen and ledger

**Files:**
- Create: `packages/domain/src/activity/` (`models.ts`, `ports.ts`, `index.ts`, `use-cases/list-activity.ts`); `apps/web/src/adapters/activity/drizzle-activity-reader.ts`; `composition/activity.ts`
- Modify: `packages/domain/src/expenses/models.ts` (`ExpenseFilter` gains `paidBy?`, `captureMethod?`), `use-cases/list-expenses.ts`, the transactions GET route and contract
- Create: `apps/web/app/api/v1/activity/route.ts`; replace `apps/web/app/(app)/activity/page.tsx`; create `apps/web/app/(app)/ledger/page.tsx`
- Test: `packages/domain/test/activity/*.test.ts`, integration for both routes

**Interfaces:**
- Produces:
  - `interface ActivityRow { id: number; actorId; actorName; action; entityType; entityId; before: unknown; after: unknown; at: Date; lateEdit: boolean }`
  - `ActivityReader.list(familyId, { before?: number; limit: number }): Promise<readonly ActivityRow[]>` (newest first, keyset paging on `id`)
  - `ListActivityUseCase.execute({ actor, before?, limit }) → { rows; nextBefore: number | null }` (limit max 50)
  - `GET /api/v1/activity?before=&limit=`; `GET /api/v1/transactions` gains `paidBy` and `method`
- Each activity row is shown as one plain sentence from en.json keyed by `action` (e.g. `activity.expense.created`: "{actor} added ₹945 to Groceries"), with "late" marked.

- [ ] **Step 1: Write the failing tests:** rows are the family's only, newest first, paged with `nextBefore`; a late edit row carries `lateEdit: true`; the ledger filters by month, item, person and method combine; a merged expense shows its proof count and is not listed separately.
- [ ] **Step 2: Run** `pnpm test -- activity expenses`. Expected: FAIL.
- [ ] **Step 3: Implement** domain, adapter, routes and both screens.
- [ ] **Step 4: Run** `pnpm test && pnpm test:integration`. Expected: PASS (cross-family read returns nothing).
- [ ] **Step 5: Commit:** `git commit -m "feat(activity): activity history and the expense ledger"`.

### Task 6: Spending alerts, thresholds and family rename

**Files:**
- Create: `packages/domain/src/reminders/spending-alerts.ts` (pure); `apps/web/src/orchestration/send-spending-alerts.ts`
- Create in `packages/domain/src/family/use-cases/`: `update-family-settings.ts`
- Modify: `apps/web/app/api/v1/transactions/route.ts` and the duplicate resolve and outbox-sync paths (all go through the same POST) to call `sendSpendingAlerts` after the response with `after()` from `next/server`; `apps/web/app/(app)/settings/family/page.tsx`
- Create: `PATCH /api/v1/families/current` route and contract
- Test: `packages/domain/test/reminders/spending-alerts.test.ts`, `packages/domain/test/family/update-family-settings.test.ts`, integration

**Interfaces:**
- Produces:
  - `planSpendingAlerts(input: { familyId; period; groups: { groupId; name; plannedMinor; actualMinor }[]; thresholds: readonly number[]; members: { userId }[] }) → PlannedNotification[]` with kind `spending_alert`, dedupe `alert:{groupId}:{yyyy-mm}:{threshold}`, `emailFallback: false`
  - `sendSpendingAlerts(familyId: string, period: Period, deps): Promise<void>` (claim → push → release, as `runDailyJob`)
  - `UpdateFamilySettingsUseCase.execute({ actor, name?, alertThresholds? }) → Family` (Admin; name 1–80 chars; thresholds 1–200, unique, ascending, at most 3; currency, minor unit and time zone untouched)

Rules (PRD §5.5, TRD §8.4): a group crossing 80% and 100% in one save gets both, once each per month. A group with planned ₹0 never alerts. Alerts go to all members. Renaming changes nothing else (PRD §7 test 3).

- [ ] **Step 1: Write the failing tests:** Groceries at 79% → none; 81% → one 80% alert per member; 105% after 81% → only the 100% alert; planned 0 → none; renaming keeps currency, members, budgets and expenses unchanged (PRD §7 test 3); thresholds `[100, 80]` are stored `[80, 100]`; `[0]` and four thresholds are refused.
- [ ] **Step 2: Run** `pnpm test -- spending-alerts update-family-settings`. Expected: FAIL.
- [ ] **Step 3: Implement** the domain side, orchestration, route and Family settings form.
- [ ] **Step 4: Run** `pnpm test && pnpm test:integration`. Expected: PASS (a second save in the same month sends nothing new).
- [ ] **Step 5: Commit:** `git commit -m "feat(alerts): spending alerts, alert thresholds and family rename"`.

### Task 7: Template changes to future months, and the 1a small fixes

**Files:**
- Modify: `packages/domain/src/plan/use-cases/update-item.ts`; create `packages/domain/src/plan/use-cases/preview-future-months.ts`; `apps/web/app/(app)/templates/template-editors.tsx`; `PATCH /api/v1/templates/items/[id]` contract (`applyToMonths?: string[]`)
- Fix: `apps/web/app/(app)/add/add-expense-form.tsx` (the "Saved" note uses the server's amount); `apps/web/app/(app)/home/page.tsx` (read the checklist once); `apps/web/src/adapters/reminders/smtp-email-gateway.ts` and `run-daily-job.ts` (log email send errors by message, no secrets); `apps/web/app/setup/page.tsx` (a member never sees Import); month and weekday names through the family locale (`year-line-actions.tsx`, `template-editors.tsx`); `docs/RUNBOOK.md` (Vercel "Include files outside the Root Directory" stays on)
- Test: domain tests for the preview and apply; unit tests for each fix that has logic

**Interfaces:**
- Produces: `PreviewFutureMonthsUseCase.execute({ actor, itemId }) → { months: Period[] }` (month budgets after the current month that exist); `UpdateItemCommand.applyToMonths?: readonly Period[]` (Admin; each must be in the preview, else `invalid`)

Rules (PRD §6.2): template edits never change existing months unless the Admin picks them; the screen lists exactly which months would change and asks to confirm. The current and past months are never offered.

- [ ] **Step 1: Write the failing tests:** with December 2026 and January 2027 created as drafts in November, the preview lists both; applying to December only changes December (PRD §7 test 6 still holds for the others); a month outside the preview is refused; the "Saved" note shows ₹945 after a resend that returned 200; a member at `/setup` with no plan sees no Import button.
- [ ] **Step 2: Run** `pnpm test`. Expected: FAIL on the new tests.
- [ ] **Step 3: Implement** the feature and the fixes.
- [ ] **Step 4: Run** `pnpm test && pnpm test:integration && pnpm --filter web build`. Expected: PASS, build clean.
- [ ] **Step 5: Commit:** `git commit -m "feat(templates): apply a change to chosen future months; Stage 1a small fixes"`.

### Task 8: Stage 1b acceptance and release

**Files:**
- Modify: `apps/web/test/e2e/core.spec.ts` or add `stage-1b.spec.ts`; `docs/RUNBOOK.md` §5 (add tests 3, 10, 11, 19 and the 1b screens to the checklist)

- [ ] **Step 1: Write the e2e test** `stage-1b.spec.ts` with `NESTWISE_FIXED_NOW` on 2026-12-01 then 2027-01-01 runs: the Inbox question for a spouse's ₹945 → Same → one ₹945; the October review card → Close; the next-year review → Looks right; the year-end card → carry Bike service to March.
- [ ] **Step 2: Run** `pnpm test && pnpm test:integration && pnpm e2e`. Expected: all PASS.
- [ ] **Step 3: Ask the owner** before deploying. On a yes: `npx vercel@latest deploy --prod --yes`; the build applies migration 0004; check `/api/v1/health` returns `{"status":"ok","database":"ok"}`.
- [ ] **Step 4: Owner walk-through** on the iPhone: add an expense in airplane mode, reopen with signal, see it sent once; the runbook §5 checklist.
- [ ] **Step 5: Commit:** `git commit -m "chore: Stage 1b acceptance run and release"`.

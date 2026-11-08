# Home bills first — build plan

Spec: `docs/superpowers/specs/2026-11-08-nestwise-home-bills-first-design.md`. Branch `feat/home-bills-first`.

Each task is written test first (domain tests use fakes, no mocks). The gate after each task is
`pnpm --filter @nestwise/domain lint typecheck test`. After task 5 it is `pnpm -r typecheck` and `pnpm -r lint`.

## Task 1: the bill flag on items

**Domain (plan):**

- `Item.isBill`.
- `PlanImportItem.isBill?`, `AddItemCommand.isBill?`, `UpdateItemCommand.isBill?`.
- `TemplateEntry.isBill`.
- `checkBill(kind, isBill)` refuses true on a non-monthly item.
- `ImportPlan`, `AddItem` and `UpdateItem` set or keep it.
- `EnsureMiscellaneousItem` sets false.

**Fakes and tests:**

- Item literals in tests and fakes gain `isBill: false`.
- New tests in `test/plan/plan.test.ts`.

**Database:**

- `items.is_bill boolean not null default false`.
- `pnpm --filter @nestwise/db generate` makes migration 0007. A hand-added `UPDATE` marks the nine seed keys.

**Adapter and API:**

- The Drizzle plan gateway maps `isBill`.
- In `api-contract`, `AddItemRequest`, `UpdateItemRequest`, `ItemResponse` and `TemplateEntry` carry it.
- The routes pass it through.

**Fixtures:**

- `sample-plan.ts` gets `bill: true` on the nine items, and `sample-plan-import.ts` passes `isBill`.

**Integration tests:**

- The plan adapter round trip.
- Templates route (`isBill` in the response; PATCH sets it).

## Task 2: the Home bills summary

**Ports:**

- `ActualsGateway.lastDateByItem(familyId, period)` returns the latest counted expense date per item.
- It is implemented in Drizzle (`max(txn_date)`) and in both fakes.

**Forecast models:**

- `ForecastBillLine` gains `itemId`, `planYear`, `plannedMinor`, `paidMinor` and `overdue`.
- `HomeBill`, `HomeBills`:
  - `thisMonth` gains `bills`, `plannedMinor` (whole month) and `paidMinor` (whole month);
  - it keeps `monthlyPlannedMinor` and `monthlyActualMinor`, plus groups and groupsOver for Budgets and the API.

**`GetHomeSummaryUseCase`:**

- It takes `PlanGateway` and `ActualsGateway`.
- It builds the bills (spec §3).
- `comingMonths = bills.slice(1, 4)`.

**API and tests:**

- `HomeResponse` updated.
- Tests in `test/forecast/forecast.test.ts`:
  - bills by state;
  - "not this month";
  - the yearly bike insurance;
  - part-paid;
  - overdue;
  - the whole-month figures;
  - coming months.

## Task 3: the Home screen

**New components in `home/`:**

- `month-header.tsx`: the header with this month's hero and the bills strip.
- `bills-card.tsx`: the client list, with the Mark paid sheet (outbox, as Add) and Not this month (PUT month line).
- `set-aside-card.tsx`: reuses the checklist line, and shows answered lines with a tick.
- `pot-card.tsx`: the pot in Coming up.
- `page.tsx` reordered.

**Removed:**

- `pot-header.tsx` and `checklist-card.tsx`, folded into the new components.
- The spending section.

**Words:**

- Every string goes in `messages/en.json`.

## Task 4: the docked bar

**Changes:**

- `bottom-nav.tsx`: phone classes (`inset-x-0 bottom-0`, `pb-safe`, labels under the icons).
- `layout.tsx` main padding.
- The two sticky bars move to `bottom-[calc(76px+env(safe-area-inset-bottom))]`.

**Tests:**

- `frame.spec.ts`: the bar's bottom edge equals the window height.

## Task 5: the Speak pop-up

**Changes:**

- `src/components/use-voice-recorder.ts`: the hook (begin, finish, cancel, phase, seconds, level, error).
- `voice-capture.tsx` uses the hook.
- `speak-button.tsx`: the client button, which opens the `Sheet` and calls `begin()` inside the tap.
- `QuickActions` takes `maxSeconds`, worked out on the server by Home and Add.

**Tests:**

- In `core.spec.ts`, Speak opens the dialog. WebKit in Playwright has no microphone, so the sheet shows the
  microphone message. That proves the sheet opened and tried to listen.

## Task 6: check everything

**Checks:**

- `pnpm test`, `pnpm -r typecheck`, `pnpm -r lint`.
- The integration tests on local Postgres.
- `pnpm e2e`.

**In the browser:**

- Home in the built-in browser at phone width, with the bar, the sheet and Mark paid.

**Docs:**

- Update `docs/PROGRESS.md` and the CLAUDE.md status.

# NestWise — Progress

Updated 2026-11-05. This page says what is built, what is live, what is waiting on you, and what comes next, in plain words.
The details live in the documents linked at the end.

## Where we are

| Stage | What it is | Status |
|---|---|---|
| **0 — iPhone spike** | A throwaway test app to prove the iPhone works as an installed app | **Done** (2 Nov). Sign-in, a lock-screen notification and an offline save all worked on your iPhone. Decision: stay with a web app you install on the phone (no separate App Store app). Google sign-in was not tested, by your choice. |
| **1a — Core plan** | The money model: plan, months, yearly bills, the pot, expenses, the forecast, reminders | **Built and live** (2–3 Nov). Waiting on your iPhone setup and a first month of daily use. |
| **1b — Core complete** | No-signal adding, duplicate checks, month-end and year-end reviews, activity, spending alerts | **Built and live** (3 Nov). Waiting on your iPhone checks and one full month of use. |
| **2 — Voice** | Add expenses by speaking (Tamil and English), and tick a yearly bill off by voice | **Part built** (5 Nov). The engine is done and tested: it listens, works out the expenses, holds them until you say yes, and can pay a yearly bill. **The speech service is chosen: Sarvam** after testing your own recordings, so a recording may run up to 30 seconds. The button and the review screen are built, and an independent review of the whole thing is done with its serious findings fixed. **Not done:** the full 30-recording check, and nothing is deployed yet. |
| **Design** | The app-like look on phone, tablet and desktop (your design brief) | After Voice |
| **3 — Photo receipts** | Add an expense from a receipt photo | After the design |
| **4 — Public** | Own domain, open sign-up, privacy pages, paid plans | Later |

The order is yours: "1B, Voice, UI, Photo" (3 Nov). The design step was not in the original stage table (TRD §15), so it
has no number; it sits between Voice and Photo.

**The app:** https://nestwise-alpha.vercel.app. Your local copy runs with `pnpm dev` (see `docs/RUNBOOK.md` §7).

## What the app does today

**Setting up**
- Sign up and sign in with email and password (no email codes, no Google yet). Sign-up is limited to the invited emails.
- Create the family: name, currency (locked once created), time zone, and money already kept aside for yearly bills.
- Import your plan, then tick which of this year's yearly bills are still to come.
- Invite the other adult as an Admin, Member or Viewer.

**Every month**
- Each month gets its own budget from the templates. Changing one month never changes another.
- The 1st-of-month checklist: confirm the pot deposit (yearly total ÷ 12) and the savings. Only confirmed deposits count.
- Add an expense in a few taps: amount, item, shop, date (with a one-tap "Yesterday"), split across items, or a refund.
- **No signal:** the expense is saved on the phone and sends itself when the signal returns ("1 expense waiting to send").
  Each person on a phone has their own waiting list. If the sign-in has ended, the app asks you to sign in again, then sends them all.
- **Same purchase?** The same amount logged close together by two people, or at the same shop, asks once. Unanswered
  questions wait in the Inbox (with a card on Home) and don't count until answered.
- Spending alerts at 80% and 100% of a group's monthly plan, once each per month. You can change the levels in Family settings.

**Month end**
- From the 1st, Home offers last month's review. It shows the totals, the biggest overs and unders, bills paid and unpaid,
  the pot deposit, savings and anything still in the Inbox.
- After 3 months in a row over plan, it offers to raise next month's amount.
- An Admin can close the month. Otherwise it closes itself on the 10th. Changes after that are kept but marked "late".

**Yearly bills and the pot**
- The year plan shows every yearly bill, dated or undated. Undated bills never get a month the family didn't choose.
- The 12-month forecast shows the pot each month and warns before a month would go short.
- Reminders: a bill a month before it's due, on the 1st of its month, and 3 days before, by phone notification, with email if the notification didn't reach anyone.
- **1 December:** check next year's bills and tap "Looks right".
- **1 January:** each of last year's open bills is Done, Still to pay (pick a month) or Drop. Nothing disappears on its own,
  and a part-paid bill carries only what is left. Carried bills get their reminders in the new year.

**Looking back**
- Activity: every change, who made it and when.
- All expenses: filter by month, item, who paid, and how it was added.
- Templates: a new amount can also be applied to future months you tick.

## How it's checked

| Check | Result (5 Nov) |
|---|---|
| Unit tests | 413 pass (254 before Stage 2) |
| Database tests | 117 pass (93 before Stage 2) |
| iPhone-size browser test (the whole flow, 13 steps) | Passes. Now also walks the voice screens: a waiting note, a row refused until it is filled in, adding it, and throwing a junk note away. It cannot use a real microphone, so that part is only provable on your phone. |
| Type check, lint, build | Clean |
| Independent review of Stage 1b | Done by a fresh reviewer. It found 5 serious problems, all fixed with tests, and 11 small ones, left for later. |
| Independent review of the Stage 2 design | Done before any code. It found 6 gaps, including one that would have dropped money out of the forecast when a bill was part-paid. All settled; the money case now has a test that compares voice against typing side by side. |
| Speech comparison on your own recordings (5 Nov) | Four clips, two mostly Tamil. **Amounts: 11 of 11 on both services.** Tamil number words read correctly by both. Sarvam's Tamil was cleaner, so Sarvam was chosen. The noisy and long clips were not recorded. |
| Independent review of the Stage 2 code | Done by a fresh reviewer on 5 Nov. **No critical problems.** It found 6 important ones; 5 are fixed with tests, and 1 (choosing who paid, on the row) is left because the typed screen does not offer it either. 13 small ones are noted for later. |

PRD §7 acceptance tests: 1–14 and 16–19 have automatic tests. Test 15's voice half (several expenses from one
recording) is covered by Stage 2's tests; its photo half belongs to Stage 3.
Tests 10, 11 and 19 also need your check on the iPhone (`docs/RUNBOOK.md` §5).

## Waiting on you

1. **The rest of the recordings.** Four are done, and they settled which service to use. Still missing:
   **one in a noisy place** and **one over 30 seconds** — the two that would have separated the services
   under hard conditions — and the full **30+ set** from both of you, which is how Stage 2 finishes.
   See `docs/RUNBOOK.md` §8.
2. **Where do "snacks" and "Amazon orders" belong?** Snacks was the one thing the test read
   inconsistently, because your plan has no home for it. Either tell me it counts as Groceries, or add a
   Snacks item to the plan.
3. **iPhone setup:** install the app, sign up, set up the family, import the plan (`docs/RUNBOOK.md` §4).
4. **Invite your spouse.**
5. **iPhone checks** (`docs/RUNBOOK.md` §5): add an expense in airplane mode and see it send; log the same amount on both phones and see "Same purchase?".
6. **Check the first daily reminder run** in Vercel's logs.
7. **Vercel:** untick "Preview" on `DATABASE_URL`.
8. **Use it for a full month** and compare the month-end review with what really happened. That is how Stages 1a and 1b finish (TRD §15).

## Noted for later

- **Home page display:** you noticed a few things on 3 Nov. We'll look at them in the design stage.
- **Small issues from the Stage 1b review.** None of them affects any money total:
  - a bill carried two years running drops out of the forecast;
  - a server error is retried with no notice;
  - a bad link to the expense list shows an error page;
  - two people saving the very same purchase in the same instant both count;
  - spending alerts can fire for a back-dated past month, or twice for one expense.

  The full list is in the Stage 1b ledger.
- **Google sign-in:** maybe later (PRD §6.1 is replaced by email and password).
- **A missing label on the "All expenses" screen.** Found on 5 Nov while testing Stage 2, and not caused by it: the
  screen asks for a piece of wording ("payer") that was never written, so that line shows an error instead of
  "You paid" / "Someone else paid". It dates from Stage 1b and is live now. One line to fix, once you say what the
  wording should be.

## Where the details are

| Document | What it holds |
|---|---|
| `docs/NestWise_PRD.md` | What to build and why; the acceptance tests (§7) and every decision (§8) |
| `docs/NestWise_TRD.md` | How it's built; stages and exit criteria (§15); later decisions (§14) |
| `docs/RUNBOOK.md` | Settings, deploying, iPhone setup, the acceptance run, backups, running locally |
| `docs/superpowers/plans/2026-11-01-nestwise-stage-0-and-1a.md` | The Stage 0 and 1a build plan |
| `docs/superpowers/specs/2026-11-03-nestwise-stage-1b-design.md` | The Stage 1b design you approved |
| `docs/superpowers/plans/2026-11-03-nestwise-stage-1b.md` | The Stage 1b build plan |

# NestWise — Progress

Updated 2026-11-08. This page says what is built, what is live, what is waiting on you, and what comes next, in plain words.
The details live in the documents linked at the end.

## Where we are

| Stage | What it is | Status |
|---|---|---|
| **0 — iPhone spike** | A throwaway test app to prove the iPhone works as an installed app | **Done** (2 Nov). Sign-in, a lock-screen notification and an offline save all worked on your iPhone. Decision: stay with a web app you install on the phone (no separate App Store app). Google sign-in was not tested, by your choice. |
| **1a — Core plan** | The money model: plan, months, yearly bills, the pot, expenses, the forecast, reminders | **Built and live** (2–3 Nov). Waiting on your iPhone setup and a first month of daily use. |
| **1b — Core complete** | No-signal adding, duplicate checks, month-end and year-end reviews, activity, spending alerts | **Built and live** (3 Nov). Waiting on your iPhone checks and one full month of use. |
| **2 — Voice** | Add expenses by speaking (Tamil and English), and tick a yearly bill off by voice | **Part built** (5 Nov). The engine is done and tested: it listens, works out the expenses, holds them until you say yes, and can pay a yearly bill. **The speech service is chosen: Sarvam** after testing your own recordings, so a recording may run up to 30 seconds. The button and the review screen are built, and an independent review of the whole thing is done with its serious findings fixed. **Not done:** the full 30-recording check, and nothing is deployed yet. |
| **Design** | The app-like look on phone, tablet and desktop (your design brief) | **Built** (5 Nov), not deployed. Every screen is in the "Silk and gold" look: a peacock-and-gold Home that shows whether the coming bills are covered, a floating bottom bar, page slides, and tablet and desktop layouts. You approved Home and Add on 5 Nov. You approved every screen on 5 Nov. **Deployed 5 Nov** (with Voice, which was not live before). **Waiting on you:** the iPhone check, then turn on the page slides (`NEXT_PUBLIC_PAGE_SLIDES=on` in Vercel) if they behave. |
| **Accounts** | Email verification, forgot password, Google sign-in (your request, 6 Nov) | **Built** (6 Nov) on branch `feat/account-handling`, not merged or deployed. Spec: `docs/superpowers/specs/2026-11-06-nestwise-account-handling-design.md`. |
| **Home, bills first** | Your request of 7 Nov: Home shows this month's plan and what is paid, then this month's bills (monthly and yearly) with done or not done; no everyday spending on Home; the bottom bar flat on the bottom edge; Speak opens a pop-up that listens straight away | **Built** (8 Nov) on branch `feat/home-bills-first`, not merged or deployed. Spec: `docs/superpowers/specs/2026-11-08-nestwise-home-bills-first-design.md`. |
| **3 — Photo receipts** | Add an expense from a receipt photo | After the design |
| **4 — Public** | Own domain, open sign-up, privacy pages, paid plans | Later |

The order is yours: "1B, Voice, UI, Photo" (3 Nov). The design step was not in the original stage table (TRD §15), so it
has no number; it sits between Voice and Photo.

**The app:** https://nestwise-alpha.vercel.app. Your local copy runs with `pnpm dev` (see `docs/RUNBOOK.md` §7).

## What the app does today

**Setting up**
- Sign up and sign in with email and password, or with Google. Anyone may create an account (6 Nov), and an email
  account must open its "Verify your email" link before the app opens. "Forgot password?" emails a one-hour reset link.
  A Google account with the same email joins the existing account. *(On branch `feat/account-handling`, not live yet.)*
- Create the family: name, currency (locked once created), time zone, and money already kept aside for yearly bills.
- Import your plan, then tick which of this year's yearly bills are still to come.
- Invite the other adult as an Admin, Member or Viewer.

**Every month**
- Each month gets its own budget from the templates. Changing one month never changes another.
- **Home, bills first** *(on branch `feat/home-bills-first`, not live yet)*: the top shows "November so far: ₹X paid of
  ₹Y planned" and "Bills: 4 of 10 paid, ₹13,500 still to pay". Below it, this month's bills: rent, fees and other items
  marked as bills, plus the yearly bills due this month, each with done or not done. "Mark paid" adds the expense in
  one tap. Then "Set aside this month" (the pot deposit and savings), then "Coming up" (the pot, the next 3 months,
  the biggest month). Everyday spending is on Budgets, not Home. Any monthly item can be marked as a bill on the plan
  page; your plan marks nine.
- Set aside this month: confirm the pot deposit (yearly total ÷ 12) and the savings. Only confirmed deposits count.
- **Speak** opens a pop-up that starts listening at once; it stops when you tap "I'm done" or go quiet *(on branch
  `feat/home-bills-first`)*.
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
| Home bills first (8 Nov, branch `feat/home-bills-first`) | 483 unit tests and 136 database tests pass; the iPhone-size browser test now also checks the bills on Home, "Mark paid" on the rent, the Speak pop-up and the bar on the bottom edge (5 of 5 pass). Type check and lint clean. |
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

- **Small issues from the Stage 1b review.** None of them affects any money total:
  - a bill carried two years running drops out of the forecast;
  - a server error is retried with no notice;
  - a bad link to the expense list shows an error page;
  - two people saving the very same purchase in the same instant both count;
  - spending alerts can fire for a back-dated past month, or twice for one expense.

  The full list is in the Stage 1b ledger.
- **Google sign-in:** maybe later (PRD §6.1 is replaced by email and password).
- **The missing "payer" label on All expenses** is fixed in the code (it now reads "You paid" / "Someone else paid"); it goes live with the next deploy.

## Where the details are

| Document | What it holds |
|---|---|
| `docs/NestWise_PRD.md` | What to build and why; the acceptance tests (§7) and every decision (§8) |
| `docs/NestWise_TRD.md` | How it's built; stages and exit criteria (§15); later decisions (§14) |
| `docs/RUNBOOK.md` | Settings, deploying, iPhone setup, the acceptance run, backups, running locally |
| `docs/superpowers/plans/2026-11-01-nestwise-stage-0-and-1a.md` | The Stage 0 and 1a build plan |
| `docs/superpowers/specs/2026-11-03-nestwise-stage-1b-design.md` | The Stage 1b design you approved |
| `docs/superpowers/plans/2026-11-03-nestwise-stage-1b.md` | The Stage 1b build plan |

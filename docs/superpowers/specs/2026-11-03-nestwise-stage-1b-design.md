# NestWise Stage 1b — design

**Status:** approved by the owner (2026-11-03).
**Builds on:** Stage 1a, live at https://nestwise-alpha.vercel.app since 2026-11-03.
**Binding sources:** `docs/NestWise_PRD.md` (§5.3, §6.3, §6.4, §6.6–6.9, §6.12, §5.5, §7) and `docs/NestWise_TRD.md`
(§3.4, §5.6, §5.7, §8.2, §8.4). This document records what the owner decided on top of them and the order of work.
Where it is silent, the PRD and TRD apply. Code structure follows the project skills `hexagonal-architecture` and
`clean-architecture`.

## 1. Intent

Stage 1a gave the family the plan, the pot, typed expenses, the forecast and reminders. Stage 1b makes Stage 1
complete, so the family can rely on it for a whole month and a whole year.

The owner's one-line test for the whole stage: **adding an expense must take minimal effort**, whether in the shop
or at home afterwards. Everything else in 1b must not add effort to that.

The owner ranked three parts as the ones that matter most. They are built first and get the most care:

1. Adding expenses with no signal.
2. The month-end review.
3. The year-end review.

The other parts are built as the PRD describes them:

4. Duplicate checks and the Inbox.
5. The Activity screen and the expense ledger.
6. Spending alerts.
7. Stage 1a leftovers (§9).

## 2. Goals, non-goals, anti-goals

**Goals**
- An expense can be added with no signal, and it reaches the family's data exactly once when the signal returns.
- On the 1st, the family sees last month in one screen and closes it with one tap.
- At the turn of the year, nothing open from last year is lost or counted twice (PRD §7 test 19).
- PRD §7 tests 10, 11 and 19 pass in CI, plus test 3 (family rename), which 1a skipped.
- Stage 1b's exit (TRD §15): one full month used, and the month-end review matches reality.

**Non-goals**
- Editing, deleting or restoring expenses offline. Templates, budgets, the checklist and every other screen stay
  online-only (TRD §8.2).
- Background sending while the app is closed: iPhone web apps can't do it.
- Voice and receipt capture (Stages 2 and 3), the visual redesign (after Voice), anything for Stage 4.

**Anti-goals** (a failure even if it technically works)
- Adding an expense takes more taps or more thinking than in 1a.
- An expense is lost, or counted twice, because the signal dropped.
- The app interrupts the person in the shop with questions that could wait (the Inbox exists for that).
- Any reminder repeats daily. Every message is sent once (PRD §5.5).
- Something open from last year silently disappears or is counted twice.

## 3. Adding expenses with no signal (priority 1)

**Owner's scenario:** in the shop (often weak or no signal), or at home afterwards. "All I want is minimal effort."

**Behaviour (agreed with the owner):**
- Opening NestWise from the Home Screen with no signal opens the app normally, on the screen it would normally open.
  The Add screen works: amount → item → save. Item search and recently used items work from data kept on the phone.
- Save answers at once with the same "Saved" confirmation as online. Nothing in the flow changes with no signal.
- A small, quiet indicator shows "1 waiting to send" until it has been sent. It is not a warning.
- Sending happens by itself when the app is next open with signal: on opening, when the signal returns, when the
  app comes back to the screen, and after any successful request (TRD §8.2). The person presses nothing.
- Retries never create a duplicate: the expense's id is made on the phone (UUID v7) and the server treats a repeat of
  the same id as already saved (TRD §5.6, "exact repeats").
- At home afterwards: the same quick screen. The date defaults to today; "yesterday" is one tap.
- When an expense saved offline is sent and looks like a duplicate, the question goes to the Inbox. The person is
  never interrupted about it at send time.
- The spouse sees the expense once it has been sent.
- **While a duplicate question waits in the Inbox, the later expense does not count** (PRD §6.8: nothing in the
  Inbox counts until a person confirms it). Answering "Different" makes it count; "Same" merges it.
- *Builder's call (Claude):* offline adding covers the whole Add screen, including split and refund, because each is
  a single new expense. Offline never covers changes to existing records.

**Owner's constraints that shape the build:**
- The service worker **never precaches pages** (owner rule from Stage 0/1a). Pages already use NetworkFirst; `/api`
  stays NetworkOnly. Offline data for the Add screen (items, recent items, family money settings) is kept on the phone
  by the app itself. TRD §8.2 names Dexie for the outbox.
- All copy in `apps/web/messages/en.json`.

**Left to the builder:** how the Add screen gets its item list when opened offline (kept on the phone and refreshed
whenever online is the expected shape), the outbox's storage shape, what happens to an outbox entry the server
rejects (it must stay visible to the person with a way to fix or discard it, never silently dropped), and showing
"figures as of 08:14" on cached screens (TRD §8.2).

## 4. Month-end review (priority 2)

The family has no month-end habit today ("we do not have any data now"). NestWise will be their first view of it,
so the screen must be readable at a glance.

**On the 1st of each month** a card on Home ("October is over: take a look") opens one screen for the month just
ended:

1. **Headline:** spent of planned and the difference, e.g. "You spent ₹84,450 of ₹81,500 planned, ₹2,950 over".
2. **Over and under:** the biggest few items each way (e.g. Groceries +₹2,000, Fruits −₹500), with the full list one
   tap away.
3. **Bills:** yearly bills paid from the pot that month, and any that were due but are unpaid.
4. **Savings:** each savings line done or skipped.
5. **Still waiting:** Inbox entries for that month, linking to the Inbox.
6. **"Close October"**: one tap, by any Admin. Closing only marks the month reviewed: late expenses and edits are
   still accepted and recorded as late in the activity history (PRD §6.3, TRD §5.7). A month nobody closes closes
   itself on the 10th.

**Agreed addition (the owner accepted this on top of the PRD):** when an item has gone over plan in two or three
months in a row, the review says so and offers to raise next month's amount with one tap. *Builder's call (Claude):*
"next month" is the month that has just started (reviewing October on 1 November raises November). Leaving it alone is the
default. Raising it changes only next month's budget, never the template or other months (PRD §6.3, AC-07/08).

**Reminder:** the existing 1st-of-month checklist notification also mentions the review, as one message, not two.

**Left to the builder:** how many items "the biggest few" shows, whether the streak is two or three months (pick one
and ledger it), and the card's wording.

## 5. Year-end review (priority 3)

As PRD §5.3 and TRD §5.7 describe; the owner confirmed it unchanged.

**1 December, "Next year's bills are ready":** the daily job already creates next year's plan (1a). 1b adds a Home
card and one notification that open a screen listing every yearly bill for next year with amount and month, where
an Admin can change an amount, give a month or leave "No month yet". From then on the forecast for that year is no
longer labelled an estimate. *Builder's call (Claude):* the review is optional; a "Looks right" button dismisses the
card for the whole family, and nothing is blocked while it is unanswered.

**1 January, "2026: these are still open":** a card lists last year's yearly lines still open with something left
to pay (unpaid or part-paid, dated or undated). For each, an Admin picks (Admins only, like the other year-plan
actions in 1a; both adults are Admins):
- **Done:** close it; the leftover stays in the pot.
- **Still to pay:** move it into this year, with a month or "No month yet".
- **Drop:** cancel it.

**Until someone answers:** dated lines stay Overdue and count once in month 0 of the forecast; undated lines show
under "Last year, still open", outside this year's undated count and nudge; in the item picker any line from another
year is labelled with its year. The card disappears once every line is answered.

**Notification (agreed):** one message on 1 January, e.g. "2026 has 3 bills still open, ₹23,000. Take a look". Sent
once, never daily.

**Interacts with 1a's ruling** "a yearly payment moved across New Year stays on the old year's bill" and "paid uses
plan year": "Still to pay" must move the line so later payments land on it. The builder confirms this against the
existing `year_lines` and `allocations.plan_year` handling and ledgers the ruling.

## 6. Duplicate checks and the Inbox

As PRD §6.7–6.8 and TRD §5.6, unchanged: a candidate needs the same amount and kind, dates at most a day apart, and a
different person, a different capture method or a matching shop. The ₹1,250 pair a week apart is never compared
(test 11). Typed online saves ask inline ("Your spouse logged ₹945 at the grocery shop yesterday. Same purchase?");
offline-synced saves send the question to the Inbox. Same keeps one expense with the other kept as proof; Different
is remembered and never asked again. Nothing in the Inbox counts until confirmed. Every decision goes into the
activity history.

Test 10 (the ₹945 purchase with 3 proofs is one ₹945 expense) involves voice and receipt entries, which arrive in
Stages 2–3. In 1b it is proved at the domain and integration level with fixture rows carrying those capture methods.

## 7. Activity screen and ledger

As PRD §6.9: the ledger lists confirmed expenses with filters for month, item, person and method, each showing who
entered it, how it was captured and its proof. The activity history lists every edit and decision with who and
when. 1a already records activity; 1b adds the screens (replacing the 1a placeholder).

## 8. Spending alerts

As PRD §5.5 and TRD §8.4: when a group reaches its family's thresholds (default 80% and 100%) of its month budget,
one notification goes to all members, once per threshold per group per month. Computed when an expense is saved
(including offline expenses when they are sent). The thresholds are edited in Family settings (the column already
exists in 1a). Email fallback stays limited to bill reminders and shortfalls (TRD §8.3).

## 9. Stage 1a leftovers folded in

- **Rename the family** in Family settings; renaming changes nothing else (PRD §7 test 3).
- **Apply a template change to future months:** when saving a template change, an Admin can choose to apply it to
  months already created in the future; the app lists exactly which months would change and asks to confirm (PRD
  §6.2).
- **The deferred small fixes** from the 1a ledger: the Add screen's "Saved ₹X" shows the typed amount on a resend;
  Home reads the checklist twice; email send errors are swallowed without a log; a member who opens setup sees an
  Import button that fails with 403; some month and weekday names use `en` instead of the family's locale; the
  runbook should mention Vercel's "include files outside the root directory".

## 10. Order of work (the owner's ranking)

1. Offline adding (§3), including the server-side duplicate check for synced expenses that feeds the Inbox.
2. Month-end review and closing (§4).
3. Year-end review and the December review screen (§5).
4. Duplicate checks inline and the Inbox screen (§6).
5. Activity screen and ledger (§7).
6. Spending alerts and thresholds setting (§8).
7. Leftovers (§9).

Each part ends usable on its own and deployable. Production deploys apply migrations automatically (1a).

## 11. Constraints carried from 1a

- Money is integer minor units; the currency is locked; only confirmed money counts.
- Own email + password sign-in; Supabase only as the Postgres host.
- Every string in `apps/web/messages/en.json`; English only for now.
- Fictional sample transactions never go into production.
- Plain shadcn/ui screens: the visual redesign is a later piece of work (after Voice). Don't polish visuals now, but
  keep screens usable at phone size.
- Every family-scoped read and write goes through `Actor`-scoped gateways, with an isolation test per adapter and
  route (PRD §7 test 18).
- AI is not part of 1b. When it comes, it is OpenAI.

## 12. Left to the builder

Everything about code structure, table changes beyond those the TRD names, the client storage library, screen
layouts within plain shadcn/ui, exact copy, and the numbers marked "builder" above. Each such call is recorded as a
ruling in the plan's ledger with its cost if wrong.

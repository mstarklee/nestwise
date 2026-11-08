# Home bills first, a docked bar and a Speak pop-up — design

Date: 2026-11-08. The owner asked for this on 2026-11-07 and approved the mockups, picking option A. On 2026-11-08
they said "work on this and complete them", so the two open questions take the proposed answers:

1. The big number counts the whole month, everyday spending included.
2. The bills are House Rent, Electricity, Internet, Cooking Gas, Housekeeping, Football Fees, Books & Cloud, OTT and
   Spouse's Maintenance. Any item can be switched on the plan page.

Branch: `feat/home-bills-first`.

## 1. Home, top to bottom

1. **Header** (peacock): the greeting, the family name, Inbox and Settings stay as they are. The pot is no longer the
   hero; this month is:
   - "November so far", then "₹39,750 paid of ₹83,000 planned" with a gold bar.
   - One strip: "Bills: 4 of 10 paid · ₹13,500 still to pay", or "All bills paid" once none is left.
   - **Planned** is this month's monthly plan (every monthly line, everyday ones included) plus the yearly bills in the
     bills list.
   - **Paid** is what is spent this month on monthly items, plus what has been paid on those yearly bills (planned
     minus still owed).
2. **Speak / Scan / Type** stay where they are. Viewers don't get them.
3. **Occasional cards** stay as they are: last month's review, next year's check, the year-end review and the Inbox
   count.
4. **Bills this month** (section 3): "Still to pay" first, then "Paid".
5. **Set aside this month**: the pot deposit and each savings item. This list replaces the 1st-of-month checklist card
   and stays on Home all month:
   - A line still waiting has Done, Different amount and Not this month, as today.
   - An answered line shows a tick and the amount, or "Not this month".
6. **Coming up**:
   - The pot card: the balance, whether every month is covered (or the first short month and the fix), the monthly
     set-aside and safe to spend.
   - The 3 months after this one.
   - The biggest month ahead.
   - Bills with no month yet.
7. **Gone from Home**: the everyday spending section, with its summary line and rings. It stays on Budgets.

## 2. Which items are bills

- **The flag.** Monthly items get an `isBill` flag, false by default. Only monthly items can carry it: savings are not
  bills, and every yearly item due this month is in the list anyway.
- **The plan page.** A monthly item's editor gets a checkbox, "This is a bill (show it on Home)". The list shows a
  small "Bill" tag beside the name.
- **The family's plan.** `fixtures/sample-plan.ts` marks `rent`, `electricity`, `internet`, `gas`, `housekeeping`,
  `football`, `books_cloud`, `ott` and `spouse`, and the plan import carries the flag.
- **Migration 0007.** It adds the column (default false) and marks the same seed keys in families that have already
  imported the plan.

## 3. The bills list

It has two kinds of bill.

**A monthly bill** is a bill item that has a line in this month's budget or spending this month. Its state is:

| State | When | What it shows |
| --- | --- | --- |
| `paid` | Anything is recorded on it this month | The amount and the latest date, plus "₹150 under plan" or "₹500 over plan" when it differs |
| `not_this_month` | Planned ₹0 this month and nothing spent | "Not this month" |
| `to_pay` | Anything else | The planned amount |

**A yearly bill** is a yearly item due this month, or due earlier and still owed. It always has a gold "Yearly bill"
tag, and "Overdue" when it was due in an earlier month. Its state is `paid` when the year line is paid (or done), and
`to_pay` otherwise. A bill that is part-paid shows what is still owed.

**The counts:**

- The bills that count are every bill except `not_this_month` ones.
- "Paid" counts the `paid` ones.
- "Still to pay" adds the planned amount of each monthly bill to pay and what is still owed on each yearly bill to
  pay.

Still to pay is ordered by yearly bills first (they are larger and come once a year), then by plan order. Paid is
ordered by plan order.

## 4. Mark paid and Not this month

- **Mark paid** opens a sheet:
  - The amount, with the planned amount (or what is still owed) filled in.
  - The date, today by default.
  - Save.
- **Saving** records an ordinary expense through the phone's outbox, exactly like Add:
  - one allocation: `itemId`, the amount, and `planYear` for a yearly bill;
  - no shop and no note.
- **If it may repeat another expense**, it waits in the Inbox as usual, and the sheet says so.
- **Not this month** applies to a monthly bill only. It sets this month's planned amount to ₹0 through the existing
  month-line endpoint. A yearly bill uses its own page (Skip / Cancel) as today.
- **Ticking by other routes.** A bill is also ticked when it is added through Speak or Type, because its state comes
  from what was spent.
- **Viewers** see the list without buttons.

## 5. The bottom bar

- **Phones and tablets.** The bar sits flat on the bottom edge, full width:
  - no rounded corners and no gap;
  - padding for the iPhone home indicator;
  - names under the icons;
  - the gold Add button stays in the middle.
- **Computers.** The side rail is unchanged.
- **Spacing.** The page's bottom padding, and the sticky Save bars on Add and the voice check, move to the bar's new
  height (64 px plus the safe area).

## 6. Speak opens a pop-up that listens straight away

**Opening and listening.** Tapping Speak opens a bottom sheet and starts recording in the same tap. iPhone allows audio
only from a tap, so this can't wait. The sheet shows:

- "Add by voice" with Cancel;
- "Listening…" and the timer;
- the big pink "I'm done" button with the pulse, and the level bar;
- "Stops on its own after 30 seconds, or when you go quiet.", and the example.

**Stopping.** It stops on "I'm done", after 2.5 s of quiet, or at the clip limit. It then shows "Working on it…" and
opens the check page `/capture/{id}` as today.

**Cancelling.** Cancel, the backdrop or Escape stops the recording and throws it away. Nothing is uploaded.

**When it can't record:**

- If the microphone is refused, the sheet says so, with Try again.
- With no signal, the sheet says voice needs a signal and offers Type instead.

**Under the hood.** The recording logic moves into one shared hook, `useVoiceRecorder`. The sheet and the `/capture`
page both use it, and `/capture` stays for direct links. The clip limit still comes from the server
(`STT_PROVIDER`).

## 7. API, for the future phone app

- `GET /api/v1/home` (`HomeResponse`):
  - adds `thisMonth.bills` (lines, counts, still to pay) and the whole-month planned and paid;
  - adds `comingMonths` (the 3 months after this one), which replaces `next3Months`;
  - adds the checklist.
- **Items.** Add-item and update-item requests take `isBill`. Item responses and template entries return it.

## 8. Tests

**Domain:**

- `isBill` on import, add and update.
- Refused on a non-monthly item.
- Kept when only the amount changes.
- Home bill states and counts, yearly bills (paid, part-paid, overdue) and the whole-month figures.
- The coming months start next month.

**Web:**

- Adapter round trip of `isBill`.
- The templates route returns it.
- The Home route response shape.

**Browser test:**

- Home shows the bills and Mark paid ticks one.
- Speak opens the pop-up.
- The bar touches the bottom edge on a phone.

## Not in this change

- Due days and reminders for monthly bills.
- Scanning.
- Moving bills between months.

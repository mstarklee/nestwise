# NestWise — Product Requirements Document (PRD)

| | |
|---|---|
| Version | 1.0 (draft for approval) |
| Date | 2026-11-01 |
| Sources | `Family_Budget_Expense_Forecasting_FRD_v1_1.md` (the FRD), `NestWise_Sample_Budget_and_Expense_Data.md` (the sample data), and the brainstorm conversation |
| Companion | `NestWise_TRD.md` (how it gets built) |

> **How to read this.** Section 8 separates what **you decided** from what **I decided**. Read the "My calls" list closely: those are the places most likely to be wrong.

---

## 1. Why NestWise exists

In your words: *"Was not able to predict the expense and always short of money at last moment, had to think about the tuition fees or insurance fees and unexpected and forgotten yearly expenses. And track the actual spending in each category."*

That is two problems:

1. **Big yearly bills catch the family short.** School fees, insurance renewals and festivals arrive all at once, and some get forgotten entirely.
2. **The family can't see where the monthly money went** against what it planned.

Until now the plan lived "in my head". NestWise holds it instead, shared between you and your spouse. It does the arithmetic, warns early and reminds on time.

**What success looks like:**

- No yearly bill arrives as a surprise. Every one is either on the calendar or visibly flagged as "no month yet".
- The pot is never empty when a dated bill is due. If it would be, the app said so months earlier, with a fix.
- At the end of a month, both of you can see, item by item, what was planned, what was spent and where you went over.
- Logging a purchase is fast enough that you actually do it.

## 2. Who it's for

| Stage | Users | Notes |
|---|---|---|
| 1–3 | Your family: you and your spouse, both Admins | Mainly used on **iPhone**, installed to the home screen. Signup is closed to strangers. |
| 4 | Any family, anywhere | Free. Families sign up themselves. You cover the running costs, so paid AI features are capped per family. |

## 3. Goals, non-goals, anti-goals

**Goals**

- **G1** Every yearly bill is visible with its month, and the app shows whether the pot will cover it.
- **G2** Each month shows planned vs actual for every item, every group and the whole month.
- **G3** A typed expense takes under 10 seconds: amount, item, save. Voice (Tamil/English) and receipt photos make capture easier still.
- **G4** Both adults see the same live numbers from their own logins.
- **G5** Families anywhere can use it: their own family name, their own currency, their own categories.

**Non-goals (not in this release)**

- Connecting to banks, reading SMS/UPI alerts, or moving money. SMS capture was **dropped**.
- Investment advice or trading.
- Income tracking. The FRD makes income optional, and your problem doesn't need it.
- Transactions in other currencies, and exchange rates.
- Annual reports and long-range analytics. The data is kept so these can be built later.
- App Store / Play Store apps. They are planned for later, and the code is built so they can reuse the same rules and server.
- Screens in Tamil or other languages. **English only for now**, but built so translations can be added later.
- Child logins.

**Anti-goals (a failure even if everything "works")**

- **Showing money that isn't there.** That means assuming deposits that weren't made, inventing income, or assuming bills were paid.
- **Counting anything twice.** A yearly bill counted as monthly spending, the same purchase logged by both of you, or a bill and its payment both sitting in the forecast.
- **Inventing dates** for items that have no month.
- **Nagging.** The same alert repeated, or reminders nobody acts on.
- **Making logging fiddly** enough that the family stops doing it.
- **One family seeing another family's data.**
- **Runaway AI costs** once the app is public.

## 4. Words used in this document

| Word | Meaning |
|---|---|
| **Family** | One shared space (the FRD calls it the "Family Workspace"). It has a name, one currency, a time zone and members. |
| **Member roles** | **Admin**: everything, including settings, members and templates. **Member**: logs and edits expenses, ticks the checklist, edits month budgets. **Viewer**: read-only. |
| **Group / Item** | Groups are categories (e.g. *Food & Dining*). Items sit inside groups (e.g. *Groceries*). |
| **Template** | The family's standard plan. There are three: the **monthly spending** template, the **savings** template and the **yearly** template. |
| **Month budget** | A dated copy of the monthly template for one month (e.g. November 2026). Editing it changes only that month. |
| **Year plan** | A dated copy of the yearly template for one calendar year (e.g. 2027). Editing it changes only that year. |
| **The pot** | The single pooled reserve for yearly items. Money goes in every month and yearly bills are paid out of it. |
| **Set-aside** | The amount meant to go into the pot each month. By default it is the year plan total ÷ 12. |
| **Undated item** | A yearly item with no month yet (e.g. *Family tour*). It is never given an invented month. |
| **Safe to spend now** | How much of the pot can be spent today on undated things without leaving any dated bill short later. |
| **Inbox** | Where entries wait for a human yes: suspected duplicates, and later voice and photo entries. |
| **Proof** | Supporting evidence attached to an expense, such as a receipt photo or a voice transcript. One expense can carry several. |

## 5. How the money works

### 5.1 Three buckets (your sample family)

| Bucket | Per month | Contents |
|---|---:|---|
| Monthly spending | ₹81,500 | 20 items in 9 groups |
| Savings | ₹17,000 | RD ₹2,000 + Gold ₹15,000 (gold is usually ₹10,000–₹20,000) |
| Pot set-aside | ₹36,916.67 (shown as ₹36,917) | ₹4,43,000 yearly plan ÷ 12 |
| **Total the household needs** | **₹1,35,416.67** | |

These buckets never mix:

- Savings are not spending.
- A yearly bill paid from the pot is **not** monthly spending.
- Monthly overspending is **not** taken from the pot.

### 5.2 The pot

- **One pot per family.** When the family is set up, the app asks: *"Do you already have money kept aside for yearly bills? How much?"* That answer, or ₹0, is the opening balance.
- **Checklist on the 1st of each month.** The app shows *"Pot ₹36,917 · RD ₹2,000 · Gold ₹15,000"*. Each line gets one of three answers: **Done**, **Done — different amount**, or **Not this month**.
- **Only confirmed money counts.** A deposit nobody confirmed is not in the pot (FRD FR-036: *"do not assume unknown reserves are funded"*).
- **Extra money can go in any time**, for example a bonus. Money taken out for something else is recorded with a note, so the balance stays honest.
- **Paying a yearly item takes the money from the pot** automatically.
- **Pot balance** = opening amount + confirmed deposits + extra money in − money taken out − yearly items paid.
- **The set-aside amount is editable.** For example, it can be rounded to ₹37,000. The app shows the ÷12 figure as the suggestion.

### 5.3 Dated vs undated yearly items

- **Dated items have a month.** The exact day is optional. They appear in the forecast in that month.
- **Undated items have "No month yet".**
  - They are counted in the set-aside, since the money is still needed.
  - They are never placed in a month the family didn't choose (FR-028).
  - The app keeps listing them and nudges once a month: *"13 items (₹1,57,000) have no month yet."*
- **The app ships no festival or birthday calendar.** Months are each family's own data, and they differ between families.
- **Yearly items can be paid in pieces.** For example, servicing ₹15,000 across several visits. The app tracks what's left.
  - An item can be marked **done** with less spent; the leftover stays in the pot.
  - Paying more than planned is allowed and shown as over.
- **Last year's open items get a year-end review.** On 1 January the app lists last year's yearly items that are still open (unpaid or part-paid, dated or undated) and asks for each one:
  - **Done** closes it, and any leftover stays in the pot.
  - **Still to pay** keeps it open and gives it a month this year, or "No month yet".
  - **Drop** cancels it.
- **Until someone answers:**
  - Unpaid dated items stay **Overdue** and are counted once in the forecast. They are never counted twice and never quietly dropped.
  - Undated ones appear under **"Last year, still open"**, outside this year's "no month yet" count.
  - If they are paid, the item list labels them with their year.

### 5.4 Forecast and warnings

**The forecast** runs month by month for the next 12 months:

- **Pot in:** confirmed deposits for the current month; the set-aside amount for future months.
- **Bills out:** what's still owed on dated items due that month (the remaining amount, so nothing is counted twice).
- **Pot balance** at the end of each month.

**Warnings:**

- **Red (shortfall):** the balance would drop below zero in some month. Example: *"June: pot ₹32,333 short."* The app also gives the fix: *"Add ₹X more per month from now."*
- **Safe to spend now:** the lowest point the pot reaches in the next 12 months, and never more than today's balance. Spending more than this on undated things now would leave a dated bill short later.

**Months in a year with no year plan yet** are estimated from the yearly template and labelled **"estimate"** (FR-034).

**Worked example**, from your plan. The pot starts at ₹0 in November 2026 and only dated items are counted:

| | Nov | Dec | Jan | Feb | Mar | Apr | May | Jun | Jul | Aug | Sep | Oct |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| In | 36,917 | 36,917 | 36,917 | 36,917 | 36,917 | 36,917 | 36,917 | 36,917 | 36,917 | 36,917 | 36,917 | 36,917 |
| Out | 1,500 | – | 15,000 | – | – | – | 60,000 | 1,20,000 | 53,000 | – | – | 36,500 |
| Balance | 35,417 | 72,333 | 94,250 | 1,31,167 | 1,68,083 | 2,05,000 | 1,81,917 | 98,833 | 82,750 | 1,19,667 | 1,56,583 | 1,57,000 |

What the example shows:

- **No red months.** The balance never goes below zero.
- **Safe to spend now is ₹35,417.** That's the lowest balance, in November, so this year's Deepavali (₹10,000) fits.
- **October ends at ₹1,57,000**, exactly the undated total. The plan balances over a full year.
- **Dates change the picture.** If the ₹50,000 tour is later given the month of May, June ends at ₹48,833 and July at ₹32,750. That's tight but not red.
- **Starting late is risky.** A family that started in March from ₹0 would be red in June: ₹32,333 short.

### 5.5 Reminders

Reminders arrive as phone notifications. On iPhone this needs the app added to the home screen. Each reminder includes the pot status.

| When | Reminder |
|---|---|
| 1st of every month | The checklist: pot deposit and savings items |
| 1st of the month **before** a bill's month | *"Next month: School fees Term 1 ₹60,000. Pot will hold ₹2,41,917."* |
| 1st of the bill's month | *"Due this month: …"* |
| 3 days before, if the bill has an exact day | *"Due Friday: …"* |
| When the forecast first turns red, or the shortfall gets worse | The shortfall and the fix |
| Once a month | Undated items still without a month |
| Spending reaches 80% and 100% of a group | Once per threshold per group per month. Thresholds are set per family. |

Each reminder is sent once. Nothing repeats every day.

## 6. Features by stage

The stages ship in order, and each one is usable on its own. Stage 1 is the full planning and tracking app with typed entry.

Stage 1 ships in two parts so your family can start sooner:

- **1a:**
  - sign-in and family setup with your plan loaded
  - templates, month budgets and year plans
  - the pot and the monthly checklist
  - typed entry (with split and refund)
  - the forecast and Home
  - checklist and bill reminders
- **1b:**
  - offline entry
  - duplicate checks and the Inbox
  - the activity screen
  - spending alerts
  - the month-end review
  - the year-end review

The activity history is recorded from day one; 1b adds the screen to view it.

### Stage 1 — Core (your family)

**6.1 Sign-in and family setup**

- Sign in with **Google**, or with an **email one-time code** (a 6-digit code typed into the app) (FR-004).
  - The email code is the method that always works inside the installed iPhone app.
  - Each person has their own login.
- Signup is limited to invited people until Stage 4.
- **Create a family** (FR-005):
  - Name: required, any language, editable later.
  - Currency: required, chosen from the ISO 4217 list, **locked after creation**.
  - Time zone: required, suggested from the phone.
  - Country: optional.
  - Pot opening balance: asked here, ₹0 allowed.
- **Starting plan:**
  - Your family is loaded with your plan from the sample data: all monthly, savings and yearly items with amounts. The dated insurance and education months and Pongal (January) come in as listed there. Every other yearly item starts as "No month yet".
  - **Fictional transactions are never loaded into a real family.**
  - New families (Stage 4) choose between your group and item names with **blank amounts**, or an empty start.
- **First-year check.** A family starts partway through a year. At setup the app lists this year's items that are still open (undated ones, and ones due in the months left) and asks: *"Which of these are still to come this year?"*
  - Unticked items are marked **"Before NestWise"** and left out of the pot and forecast.
  - Without this, a November start would show ₹1,57,000 of 2026 items as due within two months.
- **Invite** your spouse with a link (expires in 7 days, works once). They sign in, then join. Pending invites can be cancelled (FR-007).
- **Roles:** Admin, Member, Viewer (FR-008). Both adults are Admins.

**6.2 Templates** (FR-017–019)

- **Monthly spending template.**
  - Add, rename, reorder and archive groups and items.
  - Set the amount for each item.
- **Savings template.**
  - Items with a default amount.
  - An optional range shown as a hint, e.g. Gold ₹10,000–₹20,000.
- **Yearly template.**
  - Items with an amount, plus an optional month and an optional day, or "No month yet".
- **Template edits never change existing month budgets or year plans.**
  - When saving, an Admin can choose to also apply the change to months already created in the future.
  - The app lists exactly which months would change and asks for confirmation.
- **Every template change is recorded** in the activity history.

**6.3 Month budgets** (FR-020–024)

- **Created automatically on the 1st** from the monthly and savings templates.
  - If no expense has been logged in that month yet, an Admin can instead copy last month or start blank.
  - Future months can be created early as **Draft** for planning. They become **Active** on the 1st.
- **Editing a month changes only that month.** Editing December never touches November or January.
- **What each month shows**, for every item, group and the month as a whole:
  - planned
  - actual (confirmed expenses only)
  - remaining
  - variance (= actual − planned; positive means **over**)
  - % used
- **Closing a month.** It closes after the month-end review, or automatically on the 10th of the following month.
  - Closed months still accept late entries and edits.
  - Every late change is recorded in the activity history.

**6.4 Year plans** (FR-025–028)

- **One plan per calendar year.**
  - On 1 December the app creates next year's plan from the yearly template and asks the family to review it.
  - Until a plan exists, forecast months for that year are labelled estimates.
- **Item status:**
  - **Planned**
  - **Due soon** (due this month or next)
  - **Part-paid**
  - **Paid**
  - **Overdue** (its month has passed and it isn't fully paid)
  - **Cancelled**
  - **Before NestWise**
- **Payments link to their item**, so the forecast only counts what's still owed (FR-035).
- **Year-end review on 1 January** for last year's open items (§5.3).

**6.5 Savings** (FR-029)

- Savings items appear in the monthly checklist with their planned amount.
- Only confirmed amounts count.
- Savings are shown separately and never count as spending.

**6.6 Logging an expense — typed** (FR-038, FR-043, FR-044)

- **The basic flow:** amount → item → save.
  - Picking the item: search, recently used, or suggested.
  - The date defaults to today.
  - Optional: note, shop, who paid (defaults to whoever is entering), split.
- **The item list holds monthly items and open yearly items.** The yearly ones sit under a **"From the pot"** heading, so picking *Deepavali clothing* takes the money from the pot.
- **Split:** one payment across several items. The parts must add up to the total.
- **Refund:** money back against an item, which lowers that item's actual.
- **Two people recorded:** who **entered** the expense and who **paid** it (sample-data rule 6).
- **Exact amounts:** stored to the currency's smallest unit, so ₹204.50 stays ₹204.50.
- **Dates decide the month.** Changing an expense's date moves it to the other month, and both months' totals update. Nothing is counted twice.
- **Edit and delete.**
  - Every change is recorded with who made it and when.
  - Deleting is reversible for 30 days.
- **Works offline.** With no signal, typed expenses save on the phone and send when the signal returns. Retries never create duplicates (FR-062).

**6.7 Duplicates** (FR-045–048, FR-052)

- **Checked on every save.** The app looks for a likely duplicate:
  - same amount,
  - same or next day,
  - entered by the other person, or by a different method.
- **The question:** *"Your spouse logged ₹945 at the grocery shop yesterday. Same purchase?"*
  - **Same:** it becomes one expense, and both entries are kept as proof.
  - **Different:** both are kept.
- **Never merged on amount alone.** The two ₹1,250 vegetable purchases on 6 and 13 October stay as two (AC-14).
- **Exact repeats are discarded silently**, for example the same entry sent twice because the signal dropped.
- **Every same/different decision is recorded** in the activity history.

**6.8 Inbox** (FR-037)

- In Stage 1 the Inbox holds suspected duplicates that weren't settled at save time.
- From Stage 2 it also holds voice and photo entries waiting to be confirmed.
- **Nothing in the Inbox counts until a person confirms it.**

**6.9 Activity and ledger** (FR-010, FR-050, FR-051)

- **The ledger** lists the family's confirmed expenses.
  - Filters: month, item, person, method.
  - Each expense shows who entered it, how it was captured, and its proof.
- **The activity history** lists every edit and decision, with who made it and when.

**6.10 Home**

- **The pot:**
  - balance
  - safe to spend now
  - red warning, if there is one
- **The next 3 months of bills**, each showing:
  - amount
  - status
  - whether the pot covers it
- **This month at a glance:** spent of planned, plus any groups over.
- **Cards when relevant:**
  - the 1st-of-month checklist
  - Inbox count
  - undated items nudge
  - month-end review
- The visual design is **parked** and will be done separately (§9).

**6.11 Forecast screen** (FR-032–036)

- **The next 12 months:**
  - pot in, bills out and pot balance for each month
  - the monthly spending plan and savings, so the total cash the household needs each month is visible
- Red months and the suggested fix are marked, and estimated months are labelled.
- **Undated items are listed separately**, with their total.

**6.12 Month-end review** (FR-056)

- **Shown on the 1st for the month just ended:**
  - items over and under plan
  - Inbox entries still waiting
  - bills due but unpaid
  - savings done or skipped
- **One tap closes the month.**

**6.13 Settings**

- **Family settings:**
  - name
  - currency (shown, locked)
  - time zone
  - members, roles and invites
  - alert thresholds
  - set-aside amount
- **Account settings:**
  - your name
  - sign-in methods
  - notifications on or off
  - leave the family

**6.14 Install on iPhone**

iPhone has no automatic "install" button for web apps. So:

- A guide screen shows how to add NestWise to the home screen.
- After that, the app asks permission for notifications. Notifications only work once it's installed.

### Stage 2 — Voice (FR-039, AC-11)

- **Recording:** press and hold to record, up to 60 seconds, in Tamil, English or both mixed.
  - Example: *"pazham 200, kaaikari 300, tea 23, petrol 300"*.
- **Several expenses per recording.** Each becomes a proposed entry (amount, item, date) on a review screen. The user fixes anything wrong and confirms them in one go.
- **Nothing counts until confirmed.**
- **The audio is deleted once it's been transcribed.** The text is kept as proof.
- **Quality gate before polishing.**
  - First test on at least 30 real recordings from both of you, in real places: kitchen, market, car, with background noise.
  - The goal is for the amount to be right for at least 9 out of 10 expenses and the item for at least 8 out of 10.
  - If it falls short, try another speech service before building further.

### Stage 3 — Receipt photos (FR-040, FR-041, reduced)

- **Take a photo or pick one from the library.**
- **The app reads four things:** total, date, shop and a suggested item. **It does not read line items**, by your decision.
- **Handwritten bills from small shops are supported.**
  - Unclear values are highlighted.
  - The total must always be confirmed before saving.
- **A compressed copy of the photo is kept as proof** and can be deleted. The paper receipt can go in the bin.

### Stage 4 — Open to the public

- **Move to your own domain.** The app gets a permanent address, and emails come from that domain.
  - Both phones reinstall the app and turn notifications on again.
  - No data is lost.
- Anyone can sign up and create a family.
- **New-family setup:** your category names with blank amounts, or start empty.
- **Monthly limits per family on the paid AI features.**
  - The starting numbers are in the TRD and adjustable.
  - The limits and current usage are shown in Settings.
  - Typed entry always keeps working.
- **Privacy policy and terms pages.**
- **Data rights** (FR-061):
  - export all family data (CSV)
  - delete account
  - delete family
- **Hosting review.** The free hosting and database plans have limits (no backups, the database pauses if unused), so a paid plan is likely needed before strangers rely on the app. Details are in the TRD.

## 7. Must always be true (acceptance tests)

From the FRD (AC-01 to AC-18) and the sample data:

1. Any family name and any supported currency can be used. Amounts display correctly for that currency: ₹1,35,417 in INR, no decimals in JPY, three decimals in KWD (AC-01, AC-03).
2. Every function works without entering income (AC-02).
3. Renaming the family changes nothing else (AC-04).
4. The currency can't be changed, so old amounts are never relabelled (AC-05).
5. Two adults with separate logins share one family (AC-06).
6. Editing December doesn't change November or January (AC-07). Editing a template doesn't change budgets already made from it (AC-08).
7. Dated yearly items appear in their month, and undated ones never get a month the family didn't choose (AC-09, FR-028).
8. **Sample October 2026:**
   - Spending totals ₹84,450.00 against ₹81,500.00 planned: variance **+₹2,950.00**.
   - Groceries show **+₹2,000** and Fruits **−₹500** (AC-15 pattern).
9. October's yearly payments (₹6,500 car insurance + ₹30,000 school fees) are **not** in the ₹84,450. They reduce the remaining amount on those yearly items and come out of the pot (AC-10).
10. **The ₹945 purchase with 3 proofs is one ₹945 expense, not ₹2,835** (AC-13).
11. The two ₹1,250 vegetable purchases stay separate (AC-14).
12. ₹204.50 is stored and shown exactly.
13. **Set-aside:**
    - ₹4,43,000 ÷ 12 = ₹36,916.67 shown.
    - The 12 monthly amounts add up to exactly ₹4,43,000.00.
14. **The pot forecast reproduces the §5.4 worked example**, including the March-start shortfall of ₹32,333 in June.
15. Voice can produce several expenses from one recording (AC-11), and uncertain photo values can be corrected (AC-12). These apply from Stages 2 and 3.
16. Everything essential works on a phone screen (AC-16).
17. Old records stay available for future reports (AC-17).
18. **A member of one family can never read or change another family's data** (AC-18).
19. A yearly item still open at year end is never counted twice and never silently dropped. It stays visible until someone marks it done, moves it into this year, or drops it.

## 8. Decisions

### Yours (from our conversation)

- **One pot** for all yearly bills. The home screen shows the **pot total and the next 3 months of bills**.
- **Set-aside = yearly total ÷ 12**, with forecasting and reminders.
- **Members:** both adults can edit everything, and more members can be added later.
- **Public later, free.** You cover the costs.
- **Voice in Tamil and English**, including mixed.
- **Receipts:** only the total, date, shop and category. Paper receipts get binned.
- **SMS/UPI capture dropped.**
- **Hosting on Vercel.**
- **Tech stack: a Next.js web app now, native iPhone/Android apps later.** The native apps will reuse the same business rules and server.
- **A free `vercel.app` address for now**, with sign-in emails sent from your Gmail. Your own domain comes before going public.
- **Your existing categories** are the starting template.
- **Pot opening balance** is asked at family setup, and extra money can be added later.
- **Festival and birthday months are per-family data.** The app has no built-in festival dates.
- **Mainly used on iPhone.**
- **English screens now**, built so other languages can be added later.
- **You'll put the AI service key in the environment settings.**
- **Visual design is parked** for later.

### My calls (please check these)

1. **Delivery in four stages:** core → voice → photos → public.
2. **Currency is locked** once a family is created. The FRD allows this until a proper conversion feature exists.
3. **Typed entry works offline** and sends later.
4. **Deposits count only once confirmed**, using the monthly checklist. This follows the FRD.
5. **Undated items** are included in the set-aside, kept off the timeline, and covered by "safe to spend now".
6. **Pot leftovers stay in the pot** at year end.
7. **Shortfall fix:** the app suggests a bigger set-aside, and you decide.
8. **Monthly overspending is never taken from the pot.**
9. **Yearly items appear in the expense item list** under "From the pot".
10. **Months are created from the template automatically on the 1st.** Months close after the review or on the 10th. Late entries are still allowed.
11. **Bills need a month, and the day is optional.** The reminder schedule is in §5.5.
12. **The "first-year check" at setup**, so items from before NestWise aren't counted.
13. **Your seed loads months only where the sample data has them** (8 insurance/education items + Pongal in January). Everything else starts with no month, and you set it in the app.
14. **Receipt photos are kept**, compressed and deletable. **Voice audio is deleted** after transcription.
15. **Income is not in this release.**
16. **New public families** get your names with blank amounts, or start empty.
17. **Signup is invite-only until Stage 4**, so strangers can't run up AI costs early.
18. **Voice quality gate:** 9 of 10 amounts right and 8 of 10 items right before Stage 2 is polished.
19. **Roles:** Member can log and edit expenses and month budgets but not templates, the year plan or settings.
20. **Duplicate check window:** same amount within a day, entered by the other person or by a different method. The family is always asked first; nothing merges automatically.
21. **Year-end review:** last year's open items are carried over, closed or dropped only when a person decides (§5.3).
22. **Stage 1 ships as 1a then 1b** (§6), so your family can start using the plan, pot, forecast and reminders sooner.

## 9. Open items (not blocking Stage 1)

- **Visual design.** It's parked. A design pass with mockups happens before Stage 1 screens are polished, and until then the screens are plain and functional.
  - *Update 2026-11-03:* the design pass now comes after Voice and before Photo receipts.
  - The aim is an app-like feel on phone, tablet and desktop: budgets and upcoming bills first, adding and editing expenses with little effort, and page changes that feel like a mobile app.
  - You noted a few Home page display items to look at then.
- **Sign-in (update 2026-11-02).** Sign-in is our own email + password, which replaces §6.1's email codes and Google. Google may come later (TRD §14.4).
- **AI provider (update 2026-11-03).** The AI provider is OpenAI (TRD §14.3).
- **Fourth birthday.** The item is named "Fourth family birthday" and can be renamed.
- **Paid hosting.** A decision on paid hosting plans is needed before Stage 4.
- **Speech service.** Which speech-to-text service handles Tamil best is decided by the Stage 2 test (see TRD). It starts with OpenAI's.

## 10. FRD traceability

| FRD | Where | Notes |
|---|---|---|
| FR-001–003 Mobile-first PWA | Stage 1 | iPhone first |
| FR-004 Authentication | Stage 1 | Google + email one-time code |
| FR-005–010 Family, invites, roles, sharing, activity | Stage 1 | Pot opening balance added to setup |
| FR-011–014 Currency select/format/exact amounts | Stage 1 | |
| FR-015 Changing currency | Stage 1 | Locked: changes are restricted |
| FR-016 Foreign-currency transactions | Future | |
| FR-017–019 Templates | Stage 1 | Savings template added as its own template |
| FR-020–024 Month budgets | Stage 1 | |
| FR-025–028 Year plans | Stage 1 | "Before NestWise" status added |
| FR-029 Savings | Stage 1 | Via the monthly checklist |
| FR-030 Income optional | Stage 1 | Income isn't built at all in this release |
| FR-031 Cash surplus | Deferred | Needs income |
| FR-032–036 Forecast | Stage 1 | One pot + "safe to spend now" |
| FR-037 Inbox | Stage 1 (duplicates), 2–3 (voice/photo) | |
| FR-038 Quick entry | Stage 1 | |
| FR-039 Voice | Stage 2 | Tamil + English from the start |
| FR-040–041 Receipts | Stage 3 | Total/date/shop/item only; no line items |
| FR-042 SMS/UPI | **Dropped** | |
| FR-043 Categorisation | Stage 1 (manual + recent/suggested), 2–3 (AI suggestions) | |
| FR-044 Split | Stage 1 | |
| FR-045–048, FR-052 Duplicates | Stage 1 | |
| FR-049 Financial event types | Reduced | Only expense and refund; transfers etc. need bank/SMS data |
| FR-050–051 Ledger, attribution | Stage 1 | |
| FR-053–056 Monitoring, alerts, insights, month-end | Stage 1 | |
| FR-057–060, FR-062 Security, permissions, sync | Stage 1 | |
| FR-061 Export/delete | Stage 4 | Revoking membership is in Stage 1 |

# NestWise — Sample Budget Templates & Expense Data

**Standalone reference/seed dataset for the NestWise FRD (v1.1)**  
**Sample currency:** `INR` · **Example family workspace:** `Our Family` (placeholder, editable)  
**Sample monthly period:** October 2026 · **Sample yearly period:** 2026  
**Document purpose:** demonstrate Monthly Template, Yearly Template, a dated monthly budget, illustrative actual expenses, yearly due items, savings, and duplicate reconciliation.

> **Important data provenance:** The planned budget amounts and known annual due months below were transcribed from the household budget you provided. **No actual spending transactions, payment confirmations, or family-member attribution were provided.** All dated transaction entries, paid statuses, merchants, capture sources, and member assignments in the October 2026 example are **fictional test data**, not claims about real spending. Replace or delete them before using a live family account.

## 1. Seed workspace and conventions

| Setting | Example | Notes |
|---|---|---|
| Product | NestWise | Working app name |
| Family name | Our Family | User should supply a custom name during onboarding |
| Default currency | INR | Workspace currency is user-selected in the real app; no automatic amount relabeling |
| Family members | You (Admin), Spouse (Admin) | Illustrative membership; each person logs in separately |
| Children | Kids | Budget label only; no child login assumed |
| Income | Not provided | Completely optional; no income-based surplus calculated |
| Month/year | October 2026 / 2026 | Example instances created from independent templates |

**Modeling rules:** template edits do not change existing dated budgets; edits to one month/year do not affect another. Savings are separate from consumption. An annual bill paid during a month is linked to the yearly obligation and not added to routine monthly expenses twice. Currency is stored with every amount.

## 2. Monthly Budget Template — default recurring expenses

| Category ID | Category | Item ID | Expense / Subcategory | Monthly plan |
|---|---|---|---|---:|
| `FOOD` | Food & Dining | `groceries` | Groceries | ₹8,000.00 |
| `FOOD` | Food & Dining | `fruits` | Fruits | ₹3,000.00 |
| `FOOD` | Food & Dining | `vegetables` | Vegetables | ₹3,000.00 |
| `FOOD` | Food & Dining | `non_veg` | Non-veg | ₹5,000.00 |
| `FOOD` | Food & Dining | `outside_food` | Outside Food / Restaurants | ₹5,000.00 |
| `HOUSING` | Housing | `rent` | House Rent | ₹20,000.00 |
| `UTIL` | Utilities & Bills | `electricity` | Electricity Bill | ₹3,000.00 |
| `UTIL` | Utilities & Bills | `internet` | Internet Bill | ₹2,500.00 |
| `UTIL` | Utilities & Bills | `gas` | Cooking Gas | ₹500.00 |
| `HOME` | Home Care & Cleaning | `housekeeping` | Housekeeping | ₹5,500.00 |
| `HOME` | Home Care & Cleaning | `soaps` | Soap, Detergents & Washing Supplies | ₹1,500.00 |
| `KIDS` | Kids & Childcare | `kids_maintenance` | Kids’ Maintenance | ₹5,000.00 |
| `KIDS` | Kids & Childcare | `football` | Kids’ Football Fees | ₹2,000.00 |
| `KIDS` | Kids & Childcare | `diapers` | Diapers & Cream | ₹1,000.00 |
| `HEALTH` | Healthcare | `medical` | Routine Medical Expenses | ₹3,000.00 |
| `HEALTH` | Healthcare | `ayurveda` | Ayurvedic Medicines | ₹1,500.00 |
| `TRANS` | Transport | `petrol` | Petrol | ₹3,000.00 |
| `SUBS` | Subscriptions & Learning | `books_cloud` | Books & Claude/Cloud Subscription | ₹3,000.00 |
| `SUBS` | Subscriptions & Learning | `ott` | OTT Subscriptions (Netflix, Amazon) | ₹1,000.00 |
| `PERSONAL` | Personal & Family | `spouse` | Spouse’s Maintenance | ₹5,000.00 |
| | **TOTAL MONTHLY EXPENSES** | | | **₹81,500.00** |

### Monthly category totals

| Category | Planned per month |
|---|---:|
| Food & Dining | ₹24,000.00 |
| Housing | ₹20,000.00 |
| Utilities & Bills | ₹6,000.00 |
| Home Care & Cleaning | ₹7,000.00 |
| Kids & Childcare | ₹8,000.00 |
| Healthcare | ₹4,500.00 |
| Transport | ₹3,000.00 |
| Subscriptions & Learning | ₹4,000.00 |
| Personal & Family | ₹5,000.00 |
| **Total** | **₹81,500.00** |

### Monthly Savings Template (separate from expenses)

| Savings ID | Savings allocation | Monthly plan |
|---|---|---:|
| `rd` | Recurring Deposit (RD) | ₹2,000.00 |
| `gold` | Gold Savings Scheme | ₹15,000.00 |
| | **Total planned savings** | **₹17,000.00** |

- The gold allocation is **₹15,000 by default**, with the household’s suggested adjustable range **₹10,000–₹20,000**.
- Normal monthly allocation, before yearly bills: ₹81,500.00 expenses + ₹17,000.00 planned savings = **₹98,500.00**.
- Savings contributions are cash outflows for cash-flow forecasting, **not** spending against groceries or other consumption categories.

## 3. Yearly Budget Template — annual obligations and planned occasions

| Category ID | Category | Item ID | Annual item | Annual plan | Expected payment month |
|---|---|---|---|---:|---|
| `INS` | Insurance & Protection | `car_ins` | Car Insurance | ₹6,500.00 | October |
| `INS` | Insurance & Protection | `bike_ins` | Bike Insurance | ₹1,500.00 | November |
| `INS` | Insurance & Protection | `self_health` | Health Insurance — Self | ₹13,000.00 | July |
| `INS` | Insurance & Protection | `parents_health` | Health Insurance — Parents | ₹40,000.00 | July |
| `INS` | Insurance & Protection | `inlaws_health` | Health Insurance — In-laws | ₹70,000.00 | June |
| `INS` | Insurance & Protection | `term_ins` | Term Life Insurance | ₹50,000.00 | June |
| `EDU` | Kids’ Education | `school_t1` | Kids’ School Fees — Term 1 | ₹60,000.00 | May |
| `EDU` | Kids’ Education | `school_t2` | Kids’ School Fees — Term 2 | ₹30,000.00 | October |
| `FEST` | Festivals & Traditions | `pongal` | Pongal | ₹15,000.00 | January (typical; confirm annually) |
| `FEST` | Festivals & Traditions | `deepavali` | Deepavali Celebration | ₹5,000.00 | To schedule |
| `FEST` | Festivals & Traditions | `diwali_dress` | Deepavali Clothing | ₹5,000.00 | To schedule |
| `FEST` | Festivals & Traditions | `native` | Native-place Festival | ₹12,000.00 | To schedule |
| `BDAY` | Birthdays & Celebrations | `kids_bday` | Kids’ Birthday | ₹5,000.00 | To schedule |
| `BDAY` | Birthdays & Celebrations | `spouse_bday` | Spouse’s Birthday | ₹5,000.00 | To schedule |
| `BDAY` | Birthdays & Celebrations | `nephew_bday` | Nephew’s Birthday | ₹5,000.00 | To schedule |
| `BDAY` | Birthdays & Celebrations | `other_bday` | Fourth Family Birthday (person to confirm) | ₹5,000.00 | To schedule |
| `BDAY` | Birthdays & Celebrations | `other_bday_exp` | Additional Birthday-related Expenses | ₹10,000.00 | To schedule |
| `TRAVEL` | Travel & Family Visits | `tour` | Family Tour / Vacation | ₹50,000.00 | To schedule |
| `TRAVEL` | Travel & Family Visits | `visits` | Family & Friends Visits / Outings | ₹15,000.00 | To schedule |
| `VEH` | Vehicle Maintenance | `car_bike_service` | Car & Bike Servicing | ₹15,000.00 | To schedule |
| `RECREATION` | Kids’ Recreation | `indoor_play` | Kids’ Games / Indoor Play | ₹10,000.00 | To schedule |
| `REPAIR` | Appliance Maintenance | `appliance` | Household Electronics & Appliance Repairs | ₹15,000.00 | To schedule |
| | **TOTAL YEARLY EXPENSES** | | | **₹443,000.00** | |

### Yearly category totals

| Category | Annual plan |
|---|---:|
| Insurance & Protection | ₹181,000.00 |
| Kids’ Education | ₹90,000.00 |
| Festivals & Traditions | ₹37,000.00 |
| Birthdays & Celebrations | ₹30,000.00 |
| Travel & Family Visits | ₹65,000.00 |
| Vehicle Maintenance | ₹15,000.00 |
| Kids’ Recreation | ₹10,000.00 |
| Appliance Maintenance | ₹15,000.00 |
| **Total** | **₹443,000.00** |

**Data notes:** The user supplied exact months for the eight insurance/education obligations (May, June, July, October, November). Other annual items do not have confirmed dates and are explicitly marked **To schedule** rather than assigned invented dates. Pongal is shown as January based on its usual observance, but its intended budgeting schedule should still be confirmed. The original notes included **four** ₹5,000 birthday entries; the fourth identity requires confirmation, so it is not guessed. The extra ₹10,000 birthday provision is retained separately.

### Example dated Yearly Budget instance: 2026

Create a **2026 annual budget** by copying the Yearly Budget Template. The item IDs and amounts above become 2026-specific records (`year=2026`), independent of the template and of future years. Historical payment statuses are **unknown** until entered or confirmed by the family.

### Known scheduled annual obligations by month

| Month | Yearly obligation IDs | Amount due |
|---|---|---:|
| May | `school_t1` | ₹60,000.00 |
| June | `inlaws_health`, `term_ins` | ₹120,000.00 |
| July | `self_health`, `parents_health` | ₹53,000.00 |
| October | `car_ins`, `school_t2` | ₹36,500.00 |
| November | `bike_ins` | ₹1,500.00 |
| **Total dated annual obligations** | | **₹271,000.00** |

The remaining annual plan includes items without a confirmed month plus Pongal. Do not silently assign unscheduled amounts to arbitrary calendar months; instead show them as unallocated annual provisions until scheduled. Planned reserve contributions and actual payments are different concepts.

## 4. Example Monthly Budget instance — October 2026

The following **October 2026** budget is a dated copy of the Monthly Template. Any October changes would affect only this month, not the template or September/November budgets. The planned amounts are the original user-provided monthly figures; actuals below are fictional for testing.

| Category | October budget | Sample actual | Variance (actual − plan) | Status |
|---|---:|---:|---:|---|
| Food & Dining | ₹24,000.00 | ₹26,300.00 | ₹2,300.00 | Over |
| Housing | ₹20,000.00 | ₹20,000.00 | ₹0.00 | On budget |
| Utilities & Bills | ₹6,000.00 | ₹5,850.00 | -₹150.00 | Under |
| Home Care & Cleaning | ₹7,000.00 | ₹7,100.00 | ₹100.00 | Over |
| Kids & Childcare | ₹8,000.00 | ₹8,100.00 | ₹100.00 | Over |
| Healthcare | ₹4,500.00 | ₹4,700.00 | ₹200.00 | Over |
| Transport | ₹3,000.00 | ₹3,400.00 | ₹400.00 | Over |
| Subscriptions & Learning | ₹4,000.00 | ₹4,000.00 | ₹0.00 | On budget |
| Personal & Family | ₹5,000.00 | ₹5,000.00 | ₹0.00 | On budget |
| **TOTAL MONTHLY CONSUMPTION** | **₹81,500.00** | **₹84,450.00** | **₹2,950.00** | **Over** |

### Item-level planned versus actual — October 2026

| Category | Item ID | Planned | Sample actual | Variance |
|---|---|---:|---:|---:|
| Food & Dining — Groceries | `groceries` | ₹8,000.00 | ₹10,000.00 | ₹2,000.00 |
| Food & Dining — Fruits | `fruits` | ₹3,000.00 | ₹2,500.00 | -₹500.00 |
| Food & Dining — Vegetables | `vegetables` | ₹3,000.00 | ₹2,800.00 | -₹200.00 |
| Food & Dining — Non-veg | `non_veg` | ₹5,000.00 | ₹4,500.00 | -₹500.00 |
| Food & Dining — Outside Food / Restaurants | `outside_food` | ₹5,000.00 | ₹6,500.00 | ₹1,500.00 |
| Housing — House Rent | `rent` | ₹20,000.00 | ₹20,000.00 | ₹0.00 |
| Utilities & Bills — Electricity Bill | `electricity` | ₹3,000.00 | ₹2,850.00 | -₹150.00 |
| Utilities & Bills — Internet Bill | `internet` | ₹2,500.00 | ₹2,500.00 | ₹0.00 |
| Utilities & Bills — Cooking Gas | `gas` | ₹500.00 | ₹500.00 | ₹0.00 |
| Home Care & Cleaning — Housekeeping | `housekeeping` | ₹5,500.00 | ₹5,500.00 | ₹0.00 |
| Home Care & Cleaning — Soap, Detergents & Washing Supplies | `soaps` | ₹1,500.00 | ₹1,600.00 | ₹100.00 |
| Kids & Childcare — Kids’ Maintenance | `kids_maintenance` | ₹5,000.00 | ₹5,200.00 | ₹200.00 |
| Kids & Childcare — Kids’ Football Fees | `football` | ₹2,000.00 | ₹2,000.00 | ₹0.00 |
| Kids & Childcare — Diapers & Cream | `diapers` | ₹1,000.00 | ₹900.00 | -₹100.00 |
| Healthcare — Routine Medical Expenses | `medical` | ₹3,000.00 | ₹3,200.00 | ₹200.00 |
| Healthcare — Ayurvedic Medicines | `ayurveda` | ₹1,500.00 | ₹1,500.00 | ₹0.00 |
| Transport — Petrol | `petrol` | ₹3,000.00 | ₹3,400.00 | ₹400.00 |
| Subscriptions & Learning — Books & Claude/Cloud Subscription | `books_cloud` | ₹3,000.00 | ₹3,000.00 | ₹0.00 |
| Subscriptions & Learning — OTT Subscriptions (Netflix, Amazon) | `ott` | ₹1,000.00 | ₹1,000.00 | ₹0.00 |
| Personal & Family — Spouse’s Maintenance | `spouse` | ₹5,000.00 | ₹5,000.00 | ₹0.00 |
| **TOTAL** | | **₹81,500.00** | **₹84,450.00** | **₹2,950.00** |

**Interpretation:** Grocery spending of ₹10,000 against ₹8,000 planned means **₹2,000 overspent**. Fruits are ₹500 underspent. Outside food is ₹1,500 overspent. Both overspending and underspending remain visible rather than being hidden inside the category total.

## 5. Illustrative October 2026 transaction ledger (NOT real bank data)

Each row below is **one final, confirmed expense**. Several transactions could have multiple linked capture records, but only one ledger entry is counted. `You` and `Spouse` are illustrative member assignments.

| Txn ID | Date | Description | Budget item ID | Amount | Member | Capture source |
|---|---|---|---|---:|---|---|
| `TX-001` | 2026-10-02 | October house rent | `rent` | ₹20,000.00 | You | Manual |
| `TX-002` | 2026-10-02 | Monthly personal allocation | `spouse` | ₹5,000.00 | Spouse | Manual |
| `TX-003` | 2026-10-03 | Kids’ maintenance items | `kids_maintenance` | ₹5,200.00 | Spouse | Receipt scan |
| `TX-004` | 2026-10-03 | Electricity bill | `electricity` | ₹2,850.00 | You | Bank/UPI alert* |
| `TX-005` | 2026-10-04 | Meat and fish shop | `non_veg` | ₹1,900.00 | Spouse | Receipt scan |
| `TX-006` | 2026-10-04 | Fruit stall | `fruits` | ₹895.50 | You | Voice |
| `TX-007` | 2026-10-05 | Supermarket groceries | `groceries` | ₹2,200.00 | Spouse | Bank/UPI alert* |
| `TX-008` | 2026-10-05 | Home internet bill | `internet` | ₹2,500.00 | You | Bank/UPI alert* |
| `TX-009` | 2026-10-06 | Vegetable vendor | `vegetables` | ₹1,250.00 | Spouse | Receipt scan (handwritten) |
| `TX-010` | 2026-10-07 | Local grocery shop | `groceries` | ₹945.00 | You | Bank/UPI alert* + receipt + voice (linked) |
| `TX-011` | 2026-10-07 | Fruit stall | `fruits` | ₹204.50 | You | Voice |
| `TX-012` | 2026-10-07 | Vegetable shop | `vegetables` | ₹300.00 | You | Voice |
| `TX-013` | 2026-10-07 | Snacks | `outside_food` | ₹100.00 | You | Voice |
| `TX-014` | 2026-10-07 | Fuel | `petrol` | ₹300.00 | You | Voice |
| `TX-015` | 2026-10-07 | Tea | `outside_food` | ₹23.00 | You | Voice |
| `TX-016` | 2026-10-09 | Cafe / snacks | `outside_food` | ₹377.00 | Spouse | Receipt scan |
| `TX-017` | 2026-10-10 | Weekly groceries | `groceries` | ₹1,875.00 | Spouse | Receipt scan |
| `TX-018` | 2026-10-10 | Doctor visit and medicines | `medical` | ₹3,200.00 | You | Receipt scan |
| `TX-019` | 2026-10-11 | Kids’ football coaching | `football` | ₹2,000.00 | Spouse | Manual |
| `TX-020` | 2026-10-12 | Fish shop | `non_veg` | ₹1,600.00 | You | Receipt scan |
| `TX-021` | 2026-10-12 | Detergents and personal care | `soaps` | ₹1,600.00 | Spouse | Receipt scan |
| `TX-022` | 2026-10-13 | Vegetable vendor | `vegetables` | ₹1,250.00 | You | Receipt scan (handwritten) |
| `TX-023` | 2026-10-14 | Books and cloud/Claude subscriptions | `books_cloud` | ₹3,000.00 | You | Bank/UPI alert* |
| `TX-024` | 2026-10-15 | Monthly grocery purchase | `groceries` | ₹3,300.00 | Spouse | Bank/UPI alert* |
| `TX-025` | 2026-10-15 | Video streaming subscriptions | `ott` | ₹1,000.00 | You | Bank/UPI alert* |
| `TX-026` | 2026-10-16 | Fuel refill | `petrol` | ₹1,300.00 | You | Bank/UPI alert* |
| `TX-027` | 2026-10-16 | Cooking gas | `gas` | ₹500.00 | Spouse | Bank/UPI alert* |
| `TX-028` | 2026-10-18 | Fruit purchase | `fruits` | ₹1,400.00 | Spouse | Receipt scan |
| `TX-029` | 2026-10-19 | Chicken shop | `non_veg` | ₹1,000.00 | Spouse | Voice |
| `TX-030` | 2026-10-20 | Ayurvedic medicines | `ayurveda` | ₹1,500.00 | You | Receipt scan |
| `TX-031` | 2026-10-22 | Restaurant dinner | `outside_food` | ₹2,200.00 | You | Bank/UPI alert* |
| `TX-032` | 2026-10-24 | End-of-month groceries | `groceries` | ₹1,680.00 | Spouse | Receipt scan |
| `TX-033` | 2026-10-25 | Diapers and cream | `diapers` | ₹900.00 | Spouse | Receipt scan |
| `TX-034` | 2026-10-26 | Housekeeping payment | `housekeeping` | ₹5,500.00 | You | Manual |
| `TX-035` | 2026-10-27 | Fuel refill | `petrol` | ₹1,800.00 | Spouse | Bank/UPI alert* |
| `TX-036` | 2026-10-29 | Family restaurant outing | `outside_food` | ₹3,800.00 | Spouse | Bank/UPI alert* |
| | | **Total sample monthly expenses** | | **₹84,450.00** | | |

`*` Bank/UPI alerts in this table are hypothetical source examples. Real automatic SMS reading requires a supported and approved Android implementation; ordinary PWA/iOS access to the SMS inbox is not assumed.

### Example family-wide duplicate reconciliation

The **₹945** grocery purchase (`TX-010`) is captured through three simulated signals:

| Evidence ID | Linked transaction | Source | Extracted amount | Action |
|---|---|---|---:|---|
| `EV-010-A` | `TX-010` | Bank/UPI alert | ₹945.00 | Link as payment evidence |
| `EV-010-B` | `TX-010` | Uploaded printed receipt | ₹945.00 | Link as receipt evidence |
| `EV-010-C` | `TX-010` | Voice entry | ₹945.00 | Link as voice evidence |

**Result:** one ₹945 expense, **not ₹2,835**. Two legitimate ₹1,250 vegetable purchases (`TX-009` and `TX-022`) remain separate because their dates, receipts and purchase events differ; identical amounts alone must not cause a merge.

### Handwritten receipt example

`TX-009` and `TX-022` simulate bills from a local vegetable vendor. The app may extract a proposed total from the image; unclear handwriting requires user confirmation. The original image remains linked as evidence, and the transaction is not finalized from an uncertain OCR guess.

## 6. Example October annual-bill payments (separate from routine monthly expenses)

The 2026 Yearly Budget contains two **October** obligations. These fictional payments demonstrate how paying them would affect cash flow. They are **not** claims that the household paid them.

| Sample payment ID | Date | Yearly obligation | Planned due | Sample paid | Linked annual item |
|---|---|---|---:|---:|---|
| `YP-001` | 2026-10-08 | Car Insurance | ₹6,500.00 | ₹6,500.00 | `car_ins` |
| `YP-002` | 2026-10-17 | Kids’ School Fees — Term 2 | ₹30,000.00 | ₹30,000.00 | `school_t2` |
| | | **October annual obligations paid (example)** | **₹36,500.00** | **₹36,500.00** | |

Do not add these ₹36,500 payments into the ₹84,450 **routine monthly expense** subtotal. They are counted once as October cash outflows against their 2026 annual obligations, and their outstanding forecast amounts should be reduced accordingly.

## 7. October 2026 cash-requirement illustration

| Component | October planned | October illustrative actual |
|---|---:|---:|
| Regular monthly expenses | ₹81,500.00 | ₹84,450.00 |
| October scheduled yearly obligations | ₹36,500.00 | ₹36,500.00 |
| Savings contributions (assumed completed in example) | ₹17,000.00 | ₹17,000.00 |
| **Total cash requirement / outflow** | **₹135,000.00** | **₹137,950.00** |
| **Difference from planned cash requirement** | | **₹2,950.00** |

- The annual-expense **average provision** is ₹36,916.67 per month, but this is **not** an extra October bill on top of October’s scheduled ₹36,500. Use an actual reserve ledger to track funding and payments without double counting.
- Because **income and opening available cash were not supplied**, this example does **not** calculate safe-to-invest money or a true closing cash balance.
- October represents a heavier month because both car insurance and the second school fee term are due.

## 8. Developer implementation / seed-data guidelines

1. Keep template records (`monthly_template`, `yearly_template`) separate from dated plan records (`monthly_budget`, `yearly_budget`).
2. Use immutable or versioned budget change history. An October edit never updates November automatically.
3. Store `family_workspace_id`, `currency_code`, `period_year`, `period_month`, and `budget_item_id` with each relevant record.
4. Store transactions with stable unique IDs and separate evidence records. Associate multiple pieces of evidence with one economic event.
5. The `transaction_date` determines its expense period; preserve timezone. If users move a transaction to another period, update both months’ aggregates without duplication.
6. Record member attribution independently from the person who paid, since one member may enter another member’s spending.
7. Support manual split allocations: a single receipt may be split across grocery and cleaning categories without changing its total payment.
8. Keep annual payments associated with an annual obligation and make forecasts calculate **remaining due amount** rather than counting both the scheduled and paid amounts.
9. Do not create income data if none is provided. Avoid implying a monthly surplus from expense-only data.
10. Preserve the chosen family currency; do not relabel INR example amounts as USD or other currencies without a conversion workflow.
11. Preserve all amounts to their currency minor-unit precision; the fictional fruit purchase of **₹204.50** is an intentional test for paise handling.
12. Allow family admins to replace this sample data; keep fictional ledger data off production accounts unless explicitly imported for demo/testing.

## 9. Data quality and items to confirm

- The original materials specify budget allocations, **not actual spending**; this file deliberately invents only the clearly labeled transaction examples.
- The name attached to the fourth ₹5,000 birthday budget line was not sufficiently clear. Confirm the person if needed; do not make it a hard-coded identity.
- Most annual events lack confirmed month or due date; keep these unscheduled until a family member provides a date.
- “Books & Claude/Cloud Subscription” is the combined line from the handwritten recurring list; it can later be split into separate items without changing existing historical budgets.
- The extra birthday-related ₹10,000 remains distinct from four individual ₹5,000 birthday allocations; decide later if any overlap should be eliminated.
- The family name `Our Family` is only an example. Users must enter their own family name, and currency is chosen during onboarding.

---
*NestWise sample data document — companion to FRD v1.1. Planned budgets sourced from the user’s supplied figures; all example actual transactions are synthetic.*

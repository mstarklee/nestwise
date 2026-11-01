**PRODUCT REQUIREMENTS / VERSION 1.1**

Family Budget & Expense  
Forecasting Application

**FUNCTIONAL REQUIREMENTS DOCUMENT**

A mobile-first, family-shared platform for forward-looking budgets, low-friction expense capture, and spending control.

| **DOCUMENT CONTROL** | **DETAIL**                                                    |
|----------------------|---------------------------------------------------------------|
| Version              | 1.1 — Updated family name and universal currency requirements |
| Status               | Draft; functional requirements defined, pending validation    |
| Primary platform     | Mobile-first Progressive Web App (PWA)                        |
| Secondary platforms  | Tablet and desktop                                            |
| Target users         | Family households worldwide                                   |
| Currency             | Family-selected primary currency (ISO 4217)                   |

## Product promise

One Family. One Shared Budget. Complete Financial Visibility.

The application supports expense planning, capture, forecasting and collaboration. It is not an investment, trading, banking or payment platform.

# 0. Executive Summary

The application gives a family a single shared place to prepare month-specific and year-specific budgets, anticipate obligations, record real spending with minimal friction, and identify overspending without mandating income entry.

| **PILLAR**   | **FIRST-RELEASE OUTCOME**                                                    |
|--------------|------------------------------------------------------------------------------|
| Plan         | Independent monthly/yearly budgets built from reusable templates.            |
| Forecast     | Rolling cash requirements including annual due dates and savings provisions. |
| Capture      | Voice, quick entry, printed and handwritten receipt scanning, review inbox.  |
| Reconcile    | Cross-source duplicate prevention and spending classification.               |
| Collaborate  | Family workspace with individual logins, roles and synchronization.          |
| Global-ready | Editable family name and selectable primary ISO 4217 currency.               |

## Contents

1\. Product Overview \| 2. Platform and User Experience

3\. Authentication and Family Management \| 4. Universal Currency Support

5\. Monthly and Yearly Budget Templates \| 6. Monthly Budget Management

7\. Yearly Budget Management \| 8. Savings and Optional Income

9\. Future Expense Forecasting \| 10. Expense Capture

11\. Duplicate Detection and Reconciliation \| 12. Family Expense Ledger

13\. Budget Monitoring \| 14. Primary Application Screens

15\. Data Model Requirements \| 16. Privacy and Security

17\. Initial Sample Data \| 18. Release Priorities

19\. Acceptance Criteria \| 20. Non-Functional Requirements

21\. Proposed Technical Architecture \| 22. Out of Scope and Product Vision

# 1. Product Overview

## Purpose

Develop a family-focused budgeting and expense-forecasting application to plan future costs, track actual spending, prevent overspending, reserve money for upcoming obligations and manage household finances collaboratively.

## Product principles

- Mobile-first and easy to use; minimal forms and typing.

- One family workspace with independently authenticated member accounts.

- Monthly/yearly templates, with a distinct budget for each period.

- Low-friction capture, classification and duplicate prevention.

- Future spending visibility and spending alerts.

- Income entry remains optional.

- Universal family currency support and privacy by default.

# 2. Platform and User Experience

### **FR-001 Mobile-first design** (P0)

The primary interface must be designed for smartphones, with bottom navigation, large touch targets, simple interactions, camera/microphone access and minimal typing.

### **FR-002 Tablet and desktop support** (P0)

Provide responsive layouts with the same core functionality and shared backend. Larger screens may provide sidebar navigation, expanded tables and wider forecast visualizations.

### **FR-003 Installable web application** (P0)

Deliver a PWA that can be added to compatible home screens. Native applications may follow later.

# 3. Authentication and Family Management

### **FR-004 Secure authentication** (P0)

Support Google Sign-In and email-based authentication, secure sessions and separate credentials for every family member.

### **FR-005 Family Workspace creation** (P0)

During onboarding, create a Family Workspace with a required user-defined family name, required primary currency and required timezone (suggested from device), plus an optional country/region. Record creator and creation date automatically.

| **FIELD**         | **REQUIREMENT**                                                   |
|-------------------|-------------------------------------------------------------------|
| Family name       | Required; editable, Unicode-capable, not restricted to a surname. |
| Family currency   | Required; choose active ISO 4217 code.                            |
| Country/region    | Optional; assists with locale suggestions.                        |
| Time zone         | Required; default suggestion from device.                         |
| Created by / date | Stored automatically.                                             |

### **FR-006 Edit Family Profile** (P0)

Authorized administrators may rename a family and edit permitted workspace settings; renaming must not change budgets, expenses, roles or forecasts.

### **FR-007 Family member invitations** (P0)

Invite through secure links or email-associated invitations; members authenticate before joining. Allow cancellation of pending invitations.

### **FR-008 Membership and roles** (P0)

Provide Admin, Member and Viewer roles. Both adults may have Admin access; child-specific permissions are deferred.

### **FR-009 Shared family data** (P0)

Authorized members see synchronized budgets, forecasts, savings and confirmed household expenses.

### **FR-010 Activity history** (P0)

Record relevant edits and actions with member identity and timestamp, including transaction changes and duplicate decisions.

# 4. Universal Currency Support

### **FR-011 Currency selection during setup** (P0)

Users select a family primary currency from active ISO 4217 currencies. Locale may suggest a choice but not force it.

### **FR-012 Consistent family currency** (P0)

Use one primary budget currency for planned amounts, expense summaries, savings and forecasts. Family members share that budget currency.

### **FR-013 Correct currency formatting** (P0)

Format symbols, codes, decimal precision, grouping and locale correctly; currency and interface language settings are separate. For example, JPY generally has no decimal minor unit and KWD uses three decimal places.

### **FR-014 Monetary data integrity** (P0)

Store amounts using exact decimal-safe representations together with explicit currency identifiers; avoid floating-point rounding drift.

### **FR-015 Changing primary currency** (P0)

Never relabel historical monetary amounts by changing their symbol. Define a controlled migration retaining source amounts, currencies and documented rates/dates, or restrict changes until migration is supported.

### **FR-016 Foreign-currency transactions** (Future)

Future support for transactions in other currencies must retain original amounts/currencies, exchange rates and converted budget amounts. The initial release may require manual confirmation/conversion before such transactions affect a family budget.

# 5. Monthly and Yearly Budget Templates

### **FR-017 Monthly Budget Template** (P0)

Provide reusable categorized recurring household expenses and savings defaults; categories and subcategories must be editable, reorderable and removable.

### **FR-018 Yearly Budget Template** (P0)

Provide reusable annual obligations with amount, recurrence, due date or month, and optional unscheduled status.

### **FR-019 Template independence** (P0)

Applying a template creates an independently editable dated budget. Template changes must not retroactively alter existing budgets; applying changes to selected future periods requires explicit confirmation.

# 6. Monthly Budget Management

### **FR-020 Independent monthly budgets** (P0)

Each budget belongs to a unique year and month; editing one month must not change another.

### **FR-021 Monthly budget creation** (P0)

Create from default template, copy another month or start blank.

### **FR-022 Monthly budget editing** (P0)

Change category/subcategory allocations while retaining actual expense records and change history.

### **FR-023 Monthly budget lifecycle** (P0)

Support Draft, Active and Closed. Authorized reopening and changes are recorded.

### **FR-024 Actual versus planned tracking** (P0)

Show planned amount, actual confirmed spending, remaining balance, variance and percentage utilized at item, category and month level. Variance = Actual - Planned; positive is overspend.

# 7. Yearly Budget Management

### **FR-025 Independent annual budgets** (P0)

Each calendar year has an independent plan that can differ from previous and subsequent years.

### **FR-026 Annual obligation scheduling** (P0)

Include insurance, school fees, festivals, birthdays, holidays, maintenance and other obligations, each with independent planned amount and optional date.

### **FR-027 Annual obligation statuses** (P0)

Support Planned, Due Soon, Paid, Overdue and Cancelled, and associate recorded payment with obligation.

### **FR-028 Unscheduled annual allocations** (P0)

Support annual provisions without fixed payment dates, and do not assign invented due months.

# 8. Savings and Optional Income

### **FR-029 Savings planning** (P0)

Track savings allocations and actual contributions separately from consumption expense.

### **FR-030 Income independence** (P0)

Income is never mandatory to register, plan a budget, forecast expected obligations or record spending.

### **FR-031 Optional cash surplus calculation** (P0)

Where income and balances are provided, estimate cash remaining after expenses, future obligations, savings and safety buffer. Without them, show requirements rather than invented available cash.

# 9. Future Expense Forecasting

### **FR-032 Rolling forecast** (P0)

Provide a default rolling 12-month view with scope for future extension.

### **FR-033 Forecast composition** (P0)

Combine month-specific expenses, scheduled yearly obligations, savings, known one-time costs and other known future commitments.

### **FR-034 Forecast budget precedence** (P0)

Use an existing month-specific budget; otherwise estimate from the applicable template and mark the estimate.

### **FR-035 Forecast reconciliation** (P0)

Distinguish paid transactions from remaining projected spending. Prevent duplicate counting of yearly obligations, transactions and funds reserved for those obligations.

### **FR-036 Annual reserve planning** (P0)

Show amount due, amount already reserved when known, balance to reserve and payment status; do not assume unknown reserves are funded.

# 10. Expense Capture

### **FR-037 Central Expense Inbox** (P0)

Unify entries from quick entry, voice, scans and permitted bank/UPI imports.

### **FR-038 Quick expense entry** (P0)

Provide an amount-and-category fast-entry flow with optional details; minimize field count and taps.

### **FR-039 Voice expense capture** (P0)

Interpret natural speech and multiple expense entries in one recording. English initially, with Tamil/Tanglish targeted for validated recognition.

### **FR-040 Printed receipt scanning** (P0)

Extract recognizable totals, dates, merchants and line items; uncertain values must be reviewable.

### **FR-041 Handwritten receipt scanning** (P0)

Support handwritten bills from small retailers; prioritize total-amount accuracy and user confirmation for unclear handwriting.

### **FR-042 SMS/UPI transaction capture** (Conditional)

Support Android bank/UPI alert import only where device capabilities, user permission and distribution policies allow. Do not assume a PWA or iOS can read a general SMS inbox.

### **FR-043 Transaction categorization** (P0)

Map each expense to a category/subcategory using description, merchant rules and corrections; enable user override.

### **FR-044 Split transactions** (P0)

Allocate a single payment across multiple budget categories without duplicating its value.

# 11. Duplicate Detection and Reconciliation

### **FR-045 Exact duplicate detection** (P0)

Identify duplicate imports using stable payment references, provider IDs and idempotency safeguards when available.

### **FR-046 Probable duplicate matching** (P0)

Compare amount, timestamps, merchant, payment details and evidence; similarity alone does not confirm a duplicate.

### **FR-047 Cross-source reconciliation** (P0)

Link SMS, receipt and voice representations of one purchase to a single expense with multiple attached evidence records.

### **FR-048 Review uncertain matches** (P0)

Offer one-tap confirmation or rejection of suspected duplicate pairs, preserving legitimate same-amount purchases.

### **FR-049 Financial event classification** (P0)

Distinguish spending from internal transfers, cash withdrawals, refunds, reversals, savings movements and credit-card repayments to avoid inflated spending.

# 12. Family Expense Ledger

### **FR-050 Shared transaction records** (P0)

Show confirmed household spending in the common family ledger.

### **FR-051 Transaction attribution** (P0)

Retain entering member, capture method, budget period, category and supporting evidence.

### **FR-052 Family-wide duplicate control** (P0)

Reconcile permitted transaction records across family members without exposing unrelated personal messages.

# 13. Budget Monitoring

### **FR-053 Spending utilization** (P0)

Display remaining balances, utilization rates and variances for categories and entire months.

### **FR-054 Overspending alerts** (P0)

Offer configurable thresholds (e.g. 80% and 100%) without noisy repeated alerts.

### **FR-055 Monthly insights** (P0)

Highlight overspent/underspent categories and meaningful deviations using confirmed actuals.

### **FR-056 Month-end review** (P0)

Provide review of recorded expenses, unreviewed imports, due bills, variances and savings. Annual report generation is deferred while retaining data for it.

# 14. Primary Application Screens

| **SCREEN**       | **PURPOSE**                                                     |
|------------------|-----------------------------------------------------------------|
| Login            | Individual account authentication.                              |
| Create Family    | Name, currency, time zone, optional region.                     |
| Join Family      | Accept invitation with authenticated account.                   |
| Home             | Month-to-date spend, budget remaining and upcoming obligations. |
| Monthly Budget   | Independent month-specific allocations.                         |
| Yearly Budget    | Annual commitments and schedule.                                |
| Templates        | Monthly and yearly defaults.                                    |
| Forecast         | Upcoming months and funding requirements.                       |
| Add Expense      | Quick entry, camera and microphone.                             |
| Expense Inbox    | Review imports, low-confidence amounts and duplicates.          |
| Activity         | Family-shared transaction ledger and filters.                   |
| Savings          | Savings budgets and contributions.                              |
| Family Settings  | Name, currency, members and access.                             |
| Account Settings | User identity, privacy and authentication.                      |

Mobile navigation should prioritize Home, Budgets, Add Expense and Activity. Tablet and desktop may expose additional navigation and side-by-side detail.

# 15. Data Model Requirements

| **ENTITY**                       | **ESSENTIAL PURPOSE**                                   |
|----------------------------------|---------------------------------------------------------|
| User                             | Authenticated identity and profile.                     |
| FamilyWorkspace                  | Family name, primary currency, timezone and ownership.  |
| FamilyMembership                 | User-to-family permissions and invitations.             |
| MonthlyTemplate / YearlyTemplate | Reusable defaults and annual schedules.                 |
| BudgetPeriod / BudgetLine        | Dated plans, categories and planned amounts.            |
| AnnualObligation                 | Individual scheduled annual item and its payment state. |
| Transaction                      | Actual financial event with amount/date/source.         |
| TransactionAllocation            | Portions assigned to budget categories.                 |
| CaptureEvidence                  | SMS, receipt, voice and other supporting evidence.      |
| DuplicateMatch                   | Potential match, confidence and user resolution.        |
| SavingsAllocation                | Planned and actual savings contributions.               |
| IncomeEntry                      | Optional income and timing.                             |
| ActivityEvent                    | Audit trail of actions and changes.                     |

Invariant: templates, dated budgets, financial transactions and savings plans are separate entities. Workspace and currency identifiers must be preserved throughout the data model.

# 16. Privacy and Security

### **FR-057 Workspace isolation** (P0)

Enforce family-level authorization server-side for all data access and modification.

### **FR-058 Secure data handling** (P0)

Use encrypted transport, secure sessions, appropriate storage protections and minimum necessary data collection.

### **FR-059 Capture permissions** (P0)

Require explicit per-user microphone, camera and supported notification/SMS permission; core features work when optional permissions are denied.

### **FR-060 Source privacy** (P0)

Do not share unrelated SMS, OTPs or unnecessary banking details through the family workspace.

### **FR-061 Account management** (P0)

Allow membership revocation, account deletion and documented financial data export/deletion workflows.

### **FR-062 Reliable synchronization** (P0)

Prevent duplicate transactions caused by repeat uploads, retries or connectivity failures.

# 17. Initial Sample Data

The first workspace may offer an optional budget import from the family’s current plan. These amounts are sample INR data only, not defaults for all families.

| **COMPONENT**                                                   | **AMOUNT** |
|-----------------------------------------------------------------|------------|
| Monthly household and recurring expenses                        | ₹81,500    |
| Monthly savings allocations                                     | ₹17,000    |
| Annual expenses                                                 | ₹4,43,000  |
| Average monthly requirement incl. annual provisions and savings | ₹1,35,417  |

New families choosing a different primary currency must not have these INR figures silently relabeled in their selected currency.

# 18. Release Priorities

## Release 1 — Core application (P0)

- Mobile-first PWA, authentication and family invitations.

- Editable family name; ISO 4217 currency selection.

- Shared workspace, independent dated budgets, monthly/yearly templates.

- Rolling expense forecasts, savings planning and optional income.

- Quick entry, voice capture and printed/handwritten receipt workflows.

- Expense inbox, cross-source duplicate prevention and shared ledger.

- Budget variance, overspending alerts, security and synchronization.

## Platform-dependent release

- Automatic Android bank/UPI SMS capture, only following technical/policy approvals.

- Additional authorized import/connectivity sources.

## Future releases

- Annual/multi-year reports and analytics.

- Multi-currency transactions and exchange-rate conversion.

- Predictive budgeting and scenario tools.

- Bank statement imports.

- Child-specific accounts and permissions.

- Native iOS/Android store distribution.

# 19. Acceptance Criteria

**AC-01** A family creator can enter any valid family name and select a supported primary currency.

**AC-02** A family can use all budgeting functions without entering income.

**AC-03** Budgets and summaries format values for the selected currency and locale.

**AC-04** Renaming a family does not change financial records or access permissions.

**AC-05** Currency changes never silently relabel historical amounts.

**AC-06** Two adults can use separate logins to manage one shared family workspace.

**AC-07** Editing December expenses does not alter November or January.

**AC-08** Editing the monthly/yearly template does not overwrite created budgets.

**AC-09** Annual obligations appear in their scheduled forecast month.

**AC-10** Yearly obligations and paid transactions are not double-counted.

**AC-11** Voice input can generate multiple expense proposals from one recording.

**AC-12** Printed/handwritten scans permit correction of uncertain extracted values.

**AC-13** SMS, invoice and voice evidence for one purchase count as one expense.

**AC-14** Two legitimate transactions of the same amount remain separate.

**AC-15** Actual of 10,000 versus budget of 8,000 shows 2,000 overspending in workspace currency.

**AC-16** All essential workflows are usable on mobile.

**AC-17** Historical records remain available for future report generation.

**AC-18** Unauthorized members cannot access other family workspaces.

# 20. Non-Functional Requirements

- Mobile-first responsive UI with accessible touch controls, keyboard interaction and screen reader labels.

- Reliable shared-data synchronization and explicit offline/retry states.

- Decimal-safe monetary arithmetic and robust ISO 4217 formatting.

- Secure sessions, isolated workspaces, protected capture artifacts and minimum data retention.

- Modular and testable forecasting, classification and reconciliation business rules.

- Operational monitoring, error handling, backup and recovery processes.

- Internationalization-ready architecture and clear limitations for unsupported platform integrations.

# 21. Proposed Technical Architecture

| **LAYER**            | **PROPOSED DIRECTION**                                                         |
|----------------------|--------------------------------------------------------------------------------|
| Frontend             | React, Next.js, TypeScript and mobile-first design system.                     |
| Distribution         | Installable PWA; future native clients may reuse the backend.                  |
| Backend              | Authenticated APIs for budgets, forecasts, family and transactions.            |
| Data                 | Relational DB, workspace-level access, event history, transactional integrity. |
| Authentication       | Managed identity provider and invitation-based membership.                     |
| Capture intelligence | Speech transcription; OCR/handwriting recognition; classification and dedupe.  |
| Currency             | ISO 4217 codes, exact monetary amounts and locale-aware display.               |
| Operations           | Secure cloud deployment, monitoring, backups and data-protection controls.     |

Specific providers, cloud pricing and build details are implementation choices to validate during technical design.

# 22. Out of Scope and Product Vision

## Out of scope for first release

- Trading, financial product recommendations or investment execution.

- Transferring money or initiating bank payments.

- Mandatory banking connections or mandatory income input.

- Annual reports and advanced long-range analytics.

- Automatic international exchange-rate conversion.

- Native App Store publishing as an initial delivery requirement.

## Product vision

**One Family. One Shared Budget. Complete Financial Visibility.**

Regardless of country, currency or family size, households should be able to plan expenses, capture spending quickly, avoid surprises and make better decisions about future commitments — with a mobile experience that remains simple every day.

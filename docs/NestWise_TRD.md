# NestWise — Technical Requirements / Design Document (TRD)

| | |
|---|---|
| Version | 1.0 (draft for approval) |
| Date | 2026-11-01 |
| Implements | `NestWise_PRD.md` v1.0 |
| Reference data | `NestWise_Sample_Budget_and_Expense_Data.md` |

> The PRD says **what** and **why**. This document says **how**. Where the two disagree, the PRD wins and this document gets fixed.

---

## 0. Choices at a glance

> **Stack confirmed by you on 2026-11-01: Next.js now, native apps later.** The code is laid out so a future React Native (Expo) iPhone/Android app can reuse the business rules and the server (§1, §2). Everything else in this table is my call.

| Area | Choice | Why |
|---|---|---|
| App | **Next.js 16 (App Router) + React 19 + TypeScript (strict)** | FRD direction; deploys natively on Vercel |
| Hosting | **Vercel** (Hobby to start), on a free `*.vercel.app` address | Your decision; your own domain comes before Stage 4 (§14) |
| Database | **Postgres on Supabase** | A relational database with transactions; the free tier is enough for Stage 1–3 |
| Auth | **Supabase Auth**: Google + **email 6-digit code** | Codes work inside the installed iPhone app, where redirects are unreliable |
| File storage | **Supabase Storage** (private bucket) | Receipt photos (Stage 3) |
| DB access | **Drizzle ORM** from server code only | Typed SQL; every query is family-scoped (§6) |
| Validation | **Zod** at every server boundary | |
| UI | **Tailwind CSS v4 with NestWise's own tokens** | The "Silk and gold" look is defined once as theme tokens in `globals.css` (colours, fonts, corner sizes); the plain shadcn/ui placeholders are retired (design spec §4) |
| i18n | **next-intl**, English catalogue only | "Add other languages later" means no hard-coded strings |
| PWA / offline | **Serwist** service worker + **Dexie** (IndexedDB) outbox | Installable app; typed expenses queue while offline |
| Push | **Web Push (VAPID)** via `web-push` | Works on iPhone 16.4+ once the app is on the home screen |
| Email | **Gmail SMTP** (your Gmail + an app password) for Stages 1–3; **Resend** on your own domain before Stage 4 | Sign-in codes and backup reminders without needing a domain yet |
| Scheduled jobs | **Vercel Cron**, daily | Hobby allows only daily jobs, and that's enough for India-only Stages 1–3 |
| Receipt & voice understanding | **OpenAI** (§14.3 decision 3), model from `AI_MODEL`, default `gpt-6.1-terra` | Structured JSON out; reads images including handwriting |
| Speech-to-text (Tamil/English) | **Sarvam Saaras** (`saaras:v4`), chosen 2026-11-05 on the owner's own recordings, behind the pluggable `SpeechToText` port | Cleaner Tamil than OpenAI `gpt-transcribe` on the same clips (§9). The port keeps the switch to a one-line env change |
| Tests | **Vitest** (unit/integration), **Playwright** (WebKit, iPhone profile) | iPhone Safari is the main target |
| Package manager | **pnpm** | |
| Code layout | **pnpm monorepo**: `apps/web` (Next.js), `packages/domain` (business rules), `packages/api-contract` (API shapes), `packages/db` (schema) | A future native app imports the same packages and calls the same API |

---

## 1. Architecture

```
iPhone — NestWise installed on the home screen
 ├─ UI: Next.js pages (server components + small client components)
 ├─ Service worker (Serwist): app-shell cache, push handler
 └─ IndexedDB outbox (Dexie): typed expenses made offline
            │  HTTPS — versioned JSON API /api/v1 (shapes in packages/api-contract)
            ▼
Vercel — Next.js server
 ├─ Inbound adapters: route handlers, Server Components, cron → requireActor(request) → Actor
 ├─ composition/: make*UseCase() factories wire use cases to adapters
 ├─ packages/domain (pure TS, fully unit-tested): per feature models · ports · errors · use cases
 │     pure calculations: money · setAside · forecast · yearStatus · duplicates · periods
 ├─ adapters/<feature>/: Drizzle, Claude, push and email implementations of the domain's ports
 ├─ Capture: /api/v1/capture/voice  → STT adapter → Claude parse → pending entries
 │           /api/v1/capture/receipt→ Claude vision            → pending entries
 ├─ /api/cron/daily (CRON_SECRET): months, reminders, alerts, closing
 └─ Notifier: web-push + email (Gmail SMTP now, Resend later)
            │
            ▼
Supabase
 ├─ Postgres — tables in schema `app` (not exposed by the Data API), RLS on
 ├─ Auth — Google OAuth, email OTP (custom SMTP = Gmail now, Resend later)
 └─ Storage — private bucket `receipts`
External: Anthropic API · STT provider · Apple/Google push services · Gmail SMTP
```

**Rules that shape the code:**

- **The server is the source of truth.** The phone holds only cached copies and the offline outbox.
- **Only the server touches the database or storage.** The browser never does; there is no client-side Supabase data access. The Supabase browser client is used **only for auth**.
- **Business rules live in pure functions** with no database or framework imports: money, forecast, statuses, duplicates. These are where correctness matters most, and they are tested against the sample data.
- **API-first, so a native app can come later.**
  - Every capability is a JSON endpoint under `/api/v1`. Request and response shapes are Zod schemas in `packages/api-contract`.
  - The web app calls these endpoints through a small typed client.
  - Server components may read through the same service functions on the server. No business operation exists only as a Next.js server action.
  - The API accepts the web's session cookie **or** an `Authorization: Bearer <Supabase access token>` header. The header is what a future React Native app would send, and `requireActor` works with both.
- **Code structure follows the project skills** `.claude/skills/hexagonal-architecture` and
  `.claude/skills/clean-architecture`. They cover the use cases, `*Gateway` ports, adapters, `make*` wiring,
  domain errors with categories, unit-of-work ports for atomic writes, and in-memory fakes. Where this document
  and those skills differ on code structure, the skills win.
  - `packages/domain` must not import Next.js, React, Drizzle or browser APIs. A lint rule enforces this, so the package runs unchanged inside a React Native app.

---

## 2. Repository layout (suggested)

```
/apps/web                 the Next.js app
  /app/(auth)/sign-in     email code + Google
  /app/(app)/home, /month/[ym], /year/[y], /templates, /forecast,
             /add, /inbox, /activity, /settings/family, /settings/account,
             /install, /review/[ym]
  /app/api/v1/...         the JSON API: families, members, invites, templates, months,
                          years, pot, checklist, transactions, duplicates, forecast,
                          capture/voice, capture/receipt, push/subscribe
  /app/api/cron/daily     the daily job
  /src/adapters/<feature> Drizzle / Claude / STT / web-push / email implementations of domain ports
  /src/composition        make*UseCase() factories, one file per feature
  /src/http               requireActor (session → Actor via MembershipGateway), withApiErrors
  /src/orchestration      cross-feature jobs: run-daily-job.ts, notification fan-out
  /src/repositories/postgres  shared single-store Drizzle helpers (only if needed)
  /src/client             api-client.ts (typed, from api-contract), outbox.ts (Dexie),
                          push.ts, install.ts, format.ts
  /messages/en.json       all UI text
/packages/domain          the core, by feature: shared/ (money, period, actor, Clock, IdGenerator,
                          DomainError), family/, plan/, month-budget/, year-plan/, pot/, expenses/,
                          forecast/, reminders/, capture/ — each with models.ts, ports.ts, errors.ts,
                          use-cases/, index.ts. No framework, DB or browser imports.
  /test/fakes            in-memory gateways, FixedClock, SequentialIds (no vi.mock / vi.fn)
/packages/api-contract    Zod schemas + types for every /api/v1 request and response
/packages/db              Drizzle schema.ts, migrations/
/fixtures                 sample-family.ts (from the sample data doc), dev/test only
/scripts                  import-plan.ts, export-family.ts, voice-eval.ts, receipt-eval.ts
/tests                    unit/, integration/, e2e/
(later) /apps/mobile      Expo (React Native) app reusing packages/domain and api-contract
```

---

## 3. Data model

All tables live in schema `app`. Every family-owned row carries `family_id`. Primary keys are `uuid`; transaction IDs are UUID v7, made on the phone so retries can be recognised. Money is `bigint` **minor units**: paise for INR, cents, fils (3 decimals) for KWD, and whole yen for JPY.

### 3.1 Identity and family

| Table | Key columns | Notes |
|---|---|---|
| `profiles` | `user_id` (→ `auth.users`), `display_name` | |
| `families` | `id`, `name`, `currency_code char(3)`, `minor_unit smallint`, `number_locale` (e.g. `en-IN`), `timezone` (IANA), `country_code null`, `set_aside_override_minor null`, `alert_thresholds smallint[] default {80,100}`, `created_by`, `created_at` | `currency_code` and `minor_unit` are **immutable**; a DB trigger rejects updates. `minor_unit` comes from a bundled ISO 4217 table, not from `Intl`. |
| `members` | `family_id`, `user_id`, `role` (`admin`/`member`/`viewer`), `joined_at`, `removed_at` | PK (`family_id`, `user_id`). The UI shows one family per user; the schema allows more. |
| `invites` | `id`, `family_id`, `role`, `token_hash`, `created_by`, `expires_at` (7 days), `used_by`, `used_at`, `cancelled_at` | Only the hash of the token is stored. Single use. |

### 3.2 Plan structure

| Table | Key columns | Notes |
|---|---|---|
| `groups` | `id`, `family_id`, `kind` (`monthly`/`yearly`/`savings`), `name`, `sort`, `archived_at` | e.g. *Food & Dining* |
| `items` | `id`, `family_id`, `group_id`, `kind`, `name`, `sort`, `archived_at`, `seed_key null` (e.g. `groceries`) | **Stable identity** of an item across all months and years |
| `template_lines` | `item_id` (PK), `family_id`, `amount_minor`, `due_month null` (1–12), `due_day null` (1–31), `hint_min_minor null`, `hint_max_minor null`, `updated_at` | One row per item: this *is* the template. Due fields apply to yearly items only. |
| `month_budgets` | `id`, `family_id`, `year`, `month`, `status` (`draft`/`active`/`closed`), `created_from` (`template`/`copy`/`blank`), `closed_at`, `closed_by` | UNIQUE (`family_id`, `year`, `month`) |
| `month_lines` | `id`, `month_budget_id`, `family_id`, `item_id`, `name_snapshot`, `group_name_snapshot`, `planned_minor` | UNIQUE (`month_budget_id`, `item_id`). Monthly and savings items. Snapshots keep history readable after renames. |
| `year_plans` | `id`, `family_id`, `year` | UNIQUE (`family_id`, `year`) |
| `year_lines` | `id`, `year_plan_id`, `family_id`, `item_id`, `name_snapshot`, `planned_minor`, `due_year`, `due_month null`, `due_day null`, `state` (`open`/`done`/`cancelled`/`before_nestwise`) | UNIQUE (`year_plan_id`, `item_id`). `due_year` defaults to the plan's year and changes only through a year-end "Still to pay" carry-over, so a carried line keeps its own year for payments. |

### 3.3 Money movements

| Table | Key columns | Notes |
|---|---|---|
| `transactions` | `id` (client UUID v7), `family_id`, `kind` (`expense`/`refund`), `amount_minor > 0`, `currency_code`, `txn_date date`, `period_year`, `period_month` (generated from `txn_date`), `merchant null`, `note null`, `entered_by`, `paid_by null`, `capture_method` (`typed`/`voice`/`receipt`), `status` (`pending`/`confirmed`), `merged_into null`, `deleted_at null`, `created_at`, `updated_at`, `entry_tz` | `txn_date` is the local date in the family's time zone and decides the period. Only `confirmed`, not-deleted, not-merged rows count. |
| `allocations` | `id`, `transaction_id`, `family_id`, `item_id`, `plan_year null`, `amount_minor > 0` | Split support. The sum must equal the transaction amount, enforced by a deferred constraint trigger. For yearly items, `plan_year` defaults to the year of `txn_date`. |
| `pot_entries` | `id`, `family_id`, `kind` (`opening`/`deposit`/`extra_in`/`taken_out`), `amount_minor > 0`, `entry_date`, `period_year`, `period_month`, `note`, `created_by`, `deleted_at` | At most one live `deposit` per family-month (partial unique index). |
| `savings_entries` | `id`, `family_id`, `item_id`, `year`, `month`, `amount_minor`, `created_by` | UNIQUE (`family_id`, `item_id`, `year`, `month`) |
| `checklist_skips` | `family_id`, `year`, `month`, `item_id null` (null = the pot deposit) | "Not this month" answers, so the checklist stops asking and the forecast stops expecting that money |

### 3.4 Capture, reconciliation, history

| Table | Key columns | Notes |
|---|---|---|
| `evidence` | `id`, `family_id`, `transaction_id null`, `kind` (`voice`/`receipt`/`merged_entry`), `storage_path null`, `transcript null`, `extracted jsonb null`, `confidence jsonb null`, `created_by`, `created_at`, `deleted_at` | A voice transcript, a receipt photo, or a snapshot of an entry merged away as a duplicate |
| `duplicate_matches` | `id`, `family_id`, `txn_a`, `txn_b`, `reasons jsonb`, `status` (`pending`/`same`/`different`), `resolved_by`, `resolved_at` | UNIQUE on the unordered pair |
| `activity` | `id bigserial`, `family_id`, `actor_id`, `action`, `entity_type`, `entity_id`, `before jsonb`, `after jsonb`, `at` | Append-only: the app's DB role has no UPDATE or DELETE on it |
| `push_subscriptions` | `id`, `user_id`, `endpoint unique`, `p256dh`, `auth`, `user_agent`, `last_ok_at`, `failed_count` | Removed after a 404/410 response from the push service |
| `notifications_sent` | `user_id`, `dedupe_key`, `sent_at` | UNIQUE (`user_id`, `dedupe_key`). Guarantees "sent once". |
| `usage` | `family_id`, `year`, `month`, `voice_count`, `voice_seconds`, `receipt_count` | Caps and cost tracking |

**Derived, never stored:**

- actuals
- variance
- pot balance
- year-line paid amounts and statuses
- the forecast

Computing these on each request keeps a single source of truth. At household scale it costs milliseconds. Add caching only if measurement shows it's needed.

---

## 4. Money

- **Storage:** integer minor units, as `bigint` in Postgres and `number` in TypeScript.
  - Every value that crosses a boundary is checked with `Number.isSafeInteger`.
  - No floats anywhere in the arithmetic.
  - Parsing user input (`"204.50"`) is string-based, using the family's `minor_unit`: `"204.50"` becomes `20450`.
- **Currency list:** a bundled ISO 4217 table (code, minor unit, name) of active currencies. The family picks one at setup, and it is locked after that.
- **Display:** `Intl.NumberFormat(number_locale, { style: 'currency', currency, minimumFractionDigits: minor_unit, maximumFractionDigits: minor_unit })`.
  - `en-IN` gives lakh grouping, e.g. ₹1,35,416.67.
  - Summary tiles (Home, Forecast) may round to whole units, e.g. ₹36,917, using half-up rounding. Lists, forms and the ledger always show exact amounts.
- **Set-aside split** (`setAside.ts`). For year *Y*:
  - `T` is the sum of `planned_minor` over that year's lines, excluding `cancelled`. Lines marked `before_nestwise` **are** included, because the yearly total is what the ÷12 promise is based on.
  - `base = floor(T / 12)` and `r = T − 12·base`.
  - Months 1…r get `base + 1`; the rest get `base`.
  - So ₹4,43,000.00 gives 8 months of ₹36,916.67 and 4 months of ₹36,916.66, which add up to exactly 44,300,000 paise.
  - If `set_aside_override_minor` is set, it replaces the split for every month.
  - For years without a plan yet, `T` comes from the yearly template, and those months are flagged `estimate`.

---

## 5. Core algorithms (all in `/src/domain`, pure functions)

### 5.1 Periods

- **Choosing the date.** The client computes `txn_date` as "today" in the **family's** time zone, not the phone's. The user can change it.
- **The period** = (year, month) of `txn_date`. Changing the date moves the transaction to the other month. Totals are always computed from allocations, so nothing can double-count.

### 5.2 Month figures

For a month budget line of item *i*:

- `actual = Σ allocation.amount over confirmed expenses − Σ over confirmed refunds`, for item *i*, with `txn_date` in that month.
- `remaining = planned − actual`
- `variance = actual − planned` (positive = over)
- `pct = actual / planned`, or `null` when planned is 0, shown as "unplanned spend"

Group and month totals are plain sums.

### 5.3 Year-line status (`yearStatus.ts`)

**Paid amount:** `paid(line) = Σ confirmed allocations to (item, plan_year = Y)`, refunds subtracted. **Remaining:** `remaining = max(planned − paid, 0)`. It is forced to `0` when the state is `done`, `cancelled` or `before_nestwise`.

**Status** (the first rule that matches wins):

1. `before_nestwise`
2. `cancelled`
3. `paid` — when the state is `done` or `paid ≥ planned`
4. `overdue` — when the line is dated, its (`due_year`, `due_month`) is before the current month, and something remains
5. `due_soon` — when the due month is the current or next month
6. `part_paid` — when `0 < paid < planned`
7. `planned`

Undated lines can only reach `planned`, `part_paid` or `paid`.

### 5.4 Pot balance

`balance = opening + Σ deposits + Σ extra_in − Σ taken_out − Σ (allocations to yearly items, confirmed expenses) + Σ (refunds on yearly items)`

The balance is allowed to go negative: it's real data, and the UI shows it in red.

### 5.5 Forecast (`forecast.ts`)

**Inputs:**

- `today` (in the family time zone)
- `B0` — the current confirmed pot balance
- the set-aside for each month (§4)
- whether the current month's deposit is confirmed or skipped
- the year lines (or template estimates) covering the next 12 months

```
end[-1] = B0
for i in 0..11 (month m_i, starting with the current month):
  in[i]  = (i == 0 && (depositConfirmed || depositSkipped)) ? 0 : setAside(m_i)
  out[i] = Σ remaining(line) for dated lines due in m_i
           + (i == 0 ? Σ remaining(line) for overdue lines : 0)
  end[i] = end[i-1] + in[i] − out[i]
safeToSpendNow = max(0, min(B0, min_i end[i]))
red months     = { i : end[i] < 0 }
fixPerMonth    = max over red i of ceil(−end[i] / k_i),
                 k_i = count of j ≤ i with in[j] > 0
                 (if any red month has k_i = 0 → "top up ₹X now" instead)
undatedRemaining[Y] = Σ remaining(line) for undated lines with due_year = Y
```

**What the forecast returns, for each month:**

- `in`, `out` and `end`
- the bill lines due that month
- the `estimate` flag
- the month's spending plan and savings plan, so the screen can show the total cash the household needs; these don't affect the pot

**Fixtures that must pass exactly** (PRD §5.4):

- **Start Nov 2026, B0 = 0, dated lines only.** The month-end balances are 35,416.66 → 72,333.32 → 94,249.99 → … → 1,57,000.00 (the 2026 split makes Nov and Dec 36,916.66).
  - `safeToSpendNow` = 0, because `B0` is 0 until the November deposit is confirmed.
  - Once the deposit is confirmed (B0 = 36,916.66, `in[0]` = 0), `safeToSpendNow` = 35,416.66.
- **Start Mar, B0 = 0:** June ends at −32,333.32 (red), and `fixPerMonth` = ceil(3,233,332 paise / 4) = 808,333 paise (₹8,083.33).
- **Tour (₹50,000) dated May:** June ends at 48,833.34 and July at 32,750.01.

The PRD's table rounds to whole rupees; tests compare paise.

### 5.6 Duplicates (`duplicates.ts`)

**Exact repeats** (the same `id` sent again): the insert is idempotent (`ON CONFLICT (id) DO NOTHING`, and the existing row is returned). No question is asked.

**Probable duplicates.** When a transaction is created or confirmed, a candidate is any other live transaction in the same family where **all** of these hold:

- the same `amount_minor` and `kind`, and
- `|txn_date difference| ≤ 1 day`, and
- **at least one of:**
  - `entered_by` differs,
  - `capture_method` differs,
  - or merchants match after normalisation (lower-case, no punctuation, prefix match).

Pairs already marked `different` are excluded.

- Two ₹23 teas typed by the same person on the same day are **not** flagged.
- The ₹1,250 pair on 6 and 13 October is never compared, because it is outside the window.

**What happens next:**

- **Typed entry, online:** ask inline (PRD §6.7).
- **Offline sync, voice or receipt:** a `pending` duplicate match goes to the Inbox.

**Resolving a match as Same:**

- keep the earlier transaction (or the one the user picks);
- soft-merge the other (`merged_into` = keeper);
- move its evidence to the keeper;
- add a `merged_entry` evidence snapshot;
- write an activity row.

**Resolving a match as Different:** record it. The pair is never asked about again.

**Fixture:** EV-010-A/B/C, with the voice and receipt arriving as separate entries, ends as **one** ₹945.00 transaction with 3 evidence rows.

### 5.7 New month, closing, new year (run by the daily job and lazily on the first request)

- **New month:** on the 1st, create `month_budgets` for the new month from the templates (status `active`) if it doesn't exist.
  - Draft months become active.
- **Closing:**
  - On the 10th, auto-close the previous month if it is still active.
  - Closing never blocks writes. Writes to a closed month are allowed and logged in `activity` with `late_edit = true`.
- **New year:** on 1 December, create next year's `year_plans` from the yearly template and send a "review your plan" nudge.
- **Year-end review:** on 1 January, list the previous year's lines that are `open` with remaining > 0, dated or undated. For each one:
  - **Done** sets `state = done`, and the leftover stays in the pot.
  - **Still to pay** sets `due_year` to the new year with a chosen month, or none.
  - **Drop** sets `state = cancelled`.
- **Until someone answers:**
  - Dated lines stay overdue and are counted once in month 0 of the forecast.
  - Undated lines keep the old `due_year`. They are excluded from the new year's undated totals and nudge, and shown under "Last year, still open".
  - In the item picker, any line whose year differs from the current year is labelled with that year.
- **First family setup** (PRD "first-year check"):
  - Create the current year's plan from the template.
  - Show lines that are undated or due from the current month onward.
  - Mark unticked lines, and any line due before the setup month, as `before_nestwise`.

---

## 6. Security and family isolation (FR-057–060)

- **The Data API sees nothing.**
  - Tables live in schema `app`, which is **not** in Supabase's exposed API schemas.
  - RLS is enabled on every table with **no** policies for `anon` or `authenticated`. That way, even an accidental exposure returns nothing.
  - The app connects as a dedicated Postgres role over the Supabase pooler.
- **One gate for all family data.**
  - `requireActor(request)` reads the session (cookie or Bearer token). It loads the membership through
    `MembershipGateway` (`removed_at is null`) and returns an `Actor { userId, familyId, role }`.
  - Every command carries that `Actor`. The use case checks the role (`assertCan`) and passes `actor.familyId`
    to every gateway method. A `familyId` from the request body is never trusted.
  - Every gateway adapter filters by `family_id`, and its integration test proves it never returns another
    family's rows.
  - IDs from the client are always re-checked to belong to `actor.familyId`.
- **Roles:**
  - Viewer: read only.
  - Member: expenses, the checklist and month budgets.
  - Admin: everything.
  - These checks are made on the server, in each action.
- **Isolation tests.** Every server action has an integration test that tries it with a member of a *different* family and expects a failure (AC-18).
- **Storage.**
  - The bucket is private.
  - Paths are `families/{familyId}/receipts/{uuid}.jpg`.
  - Uploads go through a signed upload URL issued by the server after the membership check.
  - Viewing uses 5-minute signed URLs.
  - EXIF data, including location, is stripped on the phone before upload.
- **Secrets and headers.**
  - Secrets live only in server env. Only the Supabase URL and anon/publishable key and the VAPID public key are `NEXT_PUBLIC_*`.
  - Headers: strict CSP, `frame-ancestors 'none'`, `Referrer-Policy: strict-origin-when-cross-origin`. HSTS comes from Vercel.
- **Rate limits.**
  - Capture endpoints: 10 per user per minute, plus the monthly caps (§10.4).
  - Auth: the Supabase built-in limits.
- **Privacy.**
  - No bank data, SMS, phone numbers or location are collected.
  - Voice audio is never stored: it is processed in memory and dropped.
  - Personal data never goes in URLs.

---

## 7. Sign-in, invites, signup gate

- **Email code (the main path on iPhone).**
  - The user enters their email and gets a 6-digit code, which they type into the app (`signInWithOtp` + `verifyOtp`). It never leaves the installed app.
  - The Supabase email template must include `{{ .Token }}`.
- **Google.** OAuth with PKCE through Supabase.
  - **iPhone caveat:** the installed app and Safari keep separate storage, and the redirect can come back to Safari instead of the app, losing the session.
  - In installed mode, show the email code first. Offer Google with a note.
  - The install guide asks users to sign in **before** adding the app to the home screen; recent iOS versions are reported to carry the session over. Verify this in the Stage 0 spike.
- **Sessions:** `@supabase/ssr` cookies, HttpOnly, Secure, SameSite=Lax. Middleware refreshes them.
- **Email delivery.**
  - Supabase's built-in email only sends to the project's own team members, with tight rate limits, so **custom SMTP** is required.
  - **Stages 1–3 (your decision: no domain yet):** Gmail SMTP from your Gmail address, using a Google **app password**.
    - This needs 2-Step Verification on that Google account.
    - You create the app password and paste it into Supabase's SMTP settings and the Vercel env yourself.
    - Gmail's daily sending limit is far above what a family needs.
  - **Before Stage 4:** verify your own domain with Resend, and switch Supabase SMTP and the backup emails to it.
- **Invites:**
  - An Admin creates an invite, which produces a link `/join/{token}`.
  - The invitee signs in, the server verifies the token hash, adds the membership and marks the invite used.
  - Links expire after 7 days and work once.
- **Signup gate:**
  - `SIGNUP_MODE=invite` (Stages 1–3): anyone can authenticate, but only emails in `ALLOWED_SIGNUP_EMAILS`, or people holding a valid invite, can create or join a family. Everyone else sees an "invite-only for now" screen.
  - `SIGNUP_MODE=open` (Stage 4).

---

## 8. iPhone PWA, offline, notifications

### 8.1 Installable app

- **Manifest:**
  - `display: standalone`
  - `start_url: /home`
  - `theme_color` is peacock (`#00566E`) and `background_color` is mist (`#ECF3F4`)
  - the iPhone status bar is `black-translucent`, so every screen runs under it; a peacock strip stays fixed behind the clock and battery (design spec §5.2, §5.4)
  - icons: 192, 512 and maskable, plus a 180px `apple-touch-icon`
- **Layout and detection.**
  - Respect `env(safe-area-inset-*)` for the bottom navigation.
  - Detect installed mode with `matchMedia('(display-mode: standalone)')` or `navigator.standalone`.
- **`/install` guide.** iPhone has no install prompt for web apps. The guide shows the Share → "Add to Home Screen" steps, with pictures.

### 8.2 Offline (typed expenses only)

- **Cache.** Serwist precaches the app shell and caches the last-seen Home, month and item list (stale-while-revalidate). Offline screens say *"Offline — figures as of 08:14"*.
- **Outbox.** A new typed expense is written to the Dexie outbox with its UUID v7, then sent.
- **Flushing.** iPhone has **no Background Sync**, so the outbox is flushed when the app opens, on the `online` event, on `visibilitychange → visible`, and after any successful request. The UI shows *"2 waiting to send"*.
- **Duplicate checks** for expenses synced later run on the server. A match goes to the Inbox.
- **Online-only (my call):** editing or deleting existing records, templates, budgets and the checklist.

### 8.3 Push notifications

- **Requesting permission.** The app only asks when it is installed (standalone), and only after the user taps "Turn on reminders"; iPhone requires that tap.
- **Subscriptions** are stored per device and sent with `web-push` (VAPID). A 404/410 response deletes the subscription.
- **Message content** is short and contains no amounts beyond the bill and the pot figure. Tapping a notification opens the relevant screen.
- **Email fallback (my call).** If a user has no working push subscription, **bill reminders and shortfall warnings** go by email instead. Other reminders don't.

### 8.4 Daily job and reminder rules

The daily job is Vercel Cron `/api/cron/daily`, authenticated with `CRON_SECRET`. It runs at **02:30 UTC (≈ 08:00 IST)**; Hobby timing can drift within the hour.

**For each family, in the family's time zone:**

1. Create, activate and close months, and create next year's plan (§5.7).
2. On the 1st, send the checklist reminder and the month-end review nudge.
3. Send bill reminders:
   - On the 1st of the month **before** the due month, and on the 1st of the due month.
   - If the line has a `due_day`, also 3 days before it.
   - Dedupe key: `bill:{line}:{kind}:{yyyy-mm}`.
4. Run the forecast.
   - Notify only when red **appears**, or the shortfall **grows by more than 10%**, or the first red month **moves earlier**. Compare against the last alerted state stored for the family.
   - Clearing the red resets that stored state.
   - This stops an unresolved overdue bill from re-alerting every month.
5. Send the undated nudge on the 15th, if there are undated lines.
6. On 1 January, send the year-end review nudge if last year has open lines.

**Spending alerts at 80% and 100%** are computed when an expense is saved, and sent to all members. Dedupe key: `alert:{group}:{yyyy-mm}:{threshold}`.

**The cron is not required for correctness.** Month creation also runs lazily on the first request of a month, and every notification is deduped through `notifications_sent`.

**Stage 4 change:** families in other time zones need delivery at local morning time. That requires an hourly job (Vercel Pro, or Supabase `pg_cron` calling the endpoint), and the job then picks families whose local time is 08:00.

---

## 9. Voice capture (Stage 2)

The design that governs this stage is `docs/superpowers/specs/2026-11-04-nestwise-stage-2-voice-design.md` (approved
2026-11-05). Where this section and that design differ, the design wins.

**Client:**

- **Tap to start, tap to stop** with `MediaRecorder`; it also stops itself at the limit and after a few seconds of
  silence. iPhone produces `audio/mp4`; about 0.5 MB per minute at 64 kbps.
- **The limit follows the chosen service: 60 s on OpenAI, 30 s on Sarvam**, whose quick endpoint stops there.
  **Sarvam was chosen, so the limit in force is 30 seconds.** Going back to 60 on Sarvam means splitting a long clip
  at a silence gap and stitching the text — built only if the owner asks for it (plan Task 14).
  `maxClipSeconds()` in `apps/web/src/capture/clip-limits.ts` is the one place that number lives, and the browser and
  the route both read it.
- The audio and the recorded duration are sent as `multipart/form-data` to `/api/v1/capture/voice`. Vercel's 4.5 MB
  request limit is not a concern at this size.

**Server, in order:**

1. `requireActor`; the route checks the clip length against `maxClipSeconds()` (the only place a duration is known
   before the audio is decoded), then the capture use case checks `record_expense` and the monthly cap. **There is no
   per-minute rate limit** — the cap bounds the spend, and a limiter is deferred to Stage 4.
2. Transcribe: `SpeechToText.transcribe(audio, mime, { languages: ['ta','en'] }) → { text, model, seconds }`.
   - The adapter is chosen by `STT_PROVIDER`; the key is `STT_API_KEY`.
   - OpenAI takes `languages` as a list, so Tamil *and* English are declared together. Saaras takes a single
     `language_code`, so a multi-language request is sent as `unknown` and left to it to detect.
   - The audio buffer is not referenced again after this call.
3. **Parse** with OpenAI (§10.2):
   - The system prompt holds the family's live item list (id, name, group) and this year's **open** bill lines, today's
     date, the currency and its minor unit. A bill already done or cancelled is left out, so voice cannot pay it twice.
   - Rules: interpret Tamil number words (*nooru* = 100, *irunooru* = 200, *aayiram* = 1,000), Tamil script or
     romanised. A quantity is never the amount. A spoken count ("three entries") is a hint, not a rule.
   - Several expenses per recording are allowed, and a bill payment is one of the kinds.
   - Never invent an amount or a date. If an expense isn't clear, return it with `amount_minor: null` and low
     confidence. An id the family does not have is dropped and its confidence zeroed.
   - Output uses **OpenAI structured outputs** (`text.format` = `{ type: 'json_schema', strict: true }`):
     `{ expenses: [{ amount_minor|null, item_id|null, year_line_id|null, kind, date, merchant|null, note, heard, confidence: { amount, item } }] }`.
4. Write the batch to the **staging store** (`capture_batches` / `capture_entries`) — **not** `pending` transactions.
   An entry whose amount was not heard cannot be a transaction at all (`transactions.amount_minor` is
   `NOT NULL CHECK > 0`), and `status = 'pending'` already means "waiting for a duplicate answer" in Stage 1b.
5. Return it for the review screen. Real transactions are written at **confirm**, through `RecordExpenseUseCase`, with
   one `evidence` row of kind `voice` per transaction carrying the transcript.

Any entry with a null or low-confidence field gets that field highlighted, and nothing is confirmed without a tap.
**Only the person who recorded a batch may confirm it**; the other adult sees it waiting in the Inbox.

**A bill payment** is an allocation against the yearly item carrying its `plan_year`. It is never a write to the
line's state: `MarkYearLineDoneUseCase` zeroes whatever is still owed, which on a short payment would drop the
remainder out of the forecast.

**Choosing the provider (Stage 2, step 1):**

- **Recordings.** You and your spouse record a handful first (5–6), then **≥ 30** real expense notes: kitchen, market,
  car, mixed Tamil/English, numbers said both ways, and one over 30 s.
- **Expected results** are written down by hand.
- **Running the test.** `pnpm voice-eval --audio <folder outside the repo>` runs both candidates through the full
  pipeline — and both parse models over each transcript — and reports how often the amount and the item are right,
  with the cost. See `scripts/voice-eval.README.md`.
- **Pass mark** (PRD): amount ≥ 90%, item ≥ 80%. It is Stage 2's **exit criterion**, not a stop in the middle of the
  build: the eval needs the adapters and the prompt to exist, and the 30+ set needs both adults.
- **Privacy.** The recordings are personal: they are kept **outside git**, in a local folder. The script refuses a
  path inside the repository.
- **Candidates: OpenAI and Sarvam.** Google Chirp was dropped by the owner (2026-11-05) rather than open a third
  account. If both miss the gate on Tamil, look at ElevenLabs Scribe and Google Chirp before building further.
- **Result (2026-11-05), on four of the owner's recordings:** amounts **11/11 on both** services; Tamil number words
  read correctly by both. Sarvam's raw Tamil was consistently cleaner (number-word spelling, "KPN" as an acronym,
  word endings, amounts normalised to digits), so **Sarvam was chosen**. The remaining single item miss moved between
  rows run to run and landed on "snacks", which has no home in the family's plan — model variability on an ambiguous
  category, not a hearing problem. **The noisy and long clips were never recorded**, so the services were not
  separated under the hardest conditions.
- **Key resolution.** `speechKeyFor` prefers a service's own name (`SARVAM_API_KEY`, `OPENAI_API_KEY`) over the shared
  `STT_API_KEY`, so the key the owner pasted under a service's name is found without copying it twice, and one
  service's key can never be sent to the other.
- **Accounts.** `OPENAI_API_KEY` lives in the repo-root `.env.local`; `SARVAM_API_KEY` in `apps/web/.env.local`. The
  eval loads both. I can't create accounts on your behalf.

---

## 10. Receipt capture (Stage 3) and AI usage

### 10.1 Pipeline

- **On the phone:**
  - Open the camera or the photo library (`<input type="file" accept="image/*" capture="environment">`).
  - Downscale on the phone to a 1600 px long edge, as JPEG at q ≈ 0.75 (~150–300 KB), with EXIF stripped.
  - Upload to private storage using a server-issued signed URL.
- **On the server:**
  1. `requireActor`, then the capture use case checks the role and the cap.
  2. Send the image to Claude as an image block, with the family's item list.
  3. Get a structured output: `{ readable: bool, handwritten: bool, total_minor|null, date|null, merchant|null, suggested_item_id|null, confidence: { total, date, merchant, item } }`.
  4. Create a `pending` transaction and an evidence row (photo path + extracted JSON).
  5. Show the review screen.
- **Review rules:**
  - The total field is always shown for confirmation.
  - Fields below 0.8 confidence are highlighted.
  - If the photo isn't readable, the screen asks for the amount instead.

### 10.2 OpenAI settings

Replaces the Anthropic settings this section used to describe (§14.3 decision 3).

- **Endpoint:** `POST https://api.openai.com/v1/responses`.
- **Model:** `AI_MODEL`, default **`gpt-6.1-terra`** ($1.00 / $5.00 per million tokens — flagship-tier at a tenth of
  the flagship price). `gpt-6-luna` is the cheap alternative and `scripts/voice-eval.ts` reports both, so the choice
  is made on the family's own recordings rather than on a guess.
- **Output:** **structured outputs** — `text.format` = `{ type: 'json_schema', name, schema, strict: true }`, with
  `additionalProperties: false` and every key in `required`. The JSON arrives as a string in the `output_text` content
  part of the `message` output item, and is parsed by us.
- **Refusals and cut-offs:** a `refusal` content part, or `status: 'incomplete'` (reason in `incomplete_details`), both
  mean "couldn't read it — type it instead". So does an unparseable body. The error message never carries the
  transcript or the audio.
- **Caching:** keep the system prompt and the item list as a stable prefix, so OpenAI's prompt caching applies (the
  cached-input rate is a tenth of fresh input).
- **Speech-to-text** is a separate call, `POST /v1/audio/transcriptions` with `model=gpt-transcribe` (§9). The 4o
  transcription models and `whisper-1` are deprecated, shutting down 26 February 2027 — do not build on them.
- **`AI_EFFORT`** is carried in the env for Stage 3's use; the voice parse does not set it.
- **Code calls** follow the current OpenAI API docs at build time. Model names move fast: the ones above were checked
  on 2026-11-05.

### 10.3 Cost (rough, for planning)

Checked against OpenAI's pricing page on 2026-11-05. `gpt-6.1-terra` is $1.00 / $5.00 per million input/output
tokens; `gpt-6-luna` is $0.10 / $0.50.

- **A voice parse** is ≈ 1.5k input + 0.5k output, so ≈ **$0.004** on `gpt-6.1-terra`, ≈ **$0.0004** on `gpt-6-luna`.
- **Speech-to-text** is ≈ **$0.0045/minute** on OpenAI and ≈ **₹0.49/minute** on Sarvam — within pennies of each
  other, so accuracy decides the provider and cost does not.
- **A receipt** is ≈ 3k input + ≤ 1k output, so ≈ **$0.008** on `gpt-6.1-terra`.
- **Your family**, at ~150 receipts + ~150 voice notes a month, comes to **well under $2 / month** — about ₹150.
  Voice alone is under a dollar.
- **Cheaper model option.** `gpt-6-luna` costs about a tenth. **That's your decision, not mine.** It's a one-line env
  change, and `scripts/voice-eval.ts` reports both models side by side so it can be made on evidence.

*Superseded:* this section previously assumed `claude-opus-5-5` and quoted $5–10 / month.

### 10.4 Caps (Stage 4)

- **Starting numbers** (env-configurable):
  - `CAP_VOICE_PER_MONTH = 400` recordings (max 60 s on OpenAI, 30 s on Sarvam — see §9)
  - `CAP_RECEIPTS_PER_MONTH = 60`
- **Your family** is exempt via `UNCAPPED_FAMILY_IDS`.
- **Visibility and fallback.** Usage shows in Settings. At the cap, voice and photo buttons explain the limit, and typed entry keeps working.
- **Counters** are incremented in the same DB transaction that records the call.

---

## 11. Seed data and fixtures

- **`fixtures/sample-family.ts`** encodes the sample data document exactly:
  - templates
  - October 2026 month budget
  - TX-001…TX-036
  - YP-001/002
  - EV-010-A/B/C
  - the 2026 year plan
- **Fixtures are for dev and tests only.** They are loaded by test setup and `pnpm seed:dev`. Both **refuse to run** when `VERCEL_ENV=production` or when the database URL matches production.
- **`scripts/import-plan.ts --family <id>`** loads **only the plan** into your real family:
  - groups
  - items
  - template amounts
  - the months the sample doc lists (8 insurance/education items + Pongal = January)
  - It loads no transactions. It runs once, after you create the family in the app.
- **Stage 4 starter template:** the same group and item names with amounts of 0 and no months.

---

## 12. Testing

**Unit tests (Vitest, `packages/domain/test`), against the pure calculations and the use cases with in-memory
fakes (no mocking library):**

- **money:** parsing `"204.50"` gives 20450; INR lakh formatting; JPY with 0 decimals; KWD with 3 decimals; the safe-integer guard.
- **setAside:** the 4,43,000.00 split adds up exactly; override; estimate years.
- **forecast:** every §5.5 fixture, plus:
  - an overdue bill rolled into month 0
  - a skipped deposit
  - a year boundary into an estimated year
  - a top-up when `k_i = 0`
- **Month figures:** October 2026 totals 84,450.00 with variance +2,950.00. Every item-level row in the sample's §4 table must match.
- **yearStatus:** every status, including part-paid servicing and marking done with less spent.
- **duplicates:** the ₹945 case merges to one; the ₹1,250 pair is not flagged; two same-person ₹23 teas are not flagged; exact repeats are dropped.

**Integration tests (Vitest + a real Postgres from a local Supabase or a dedicated dev project):**

- every server action, happy path
- **cross-family denial for every action**
- role checks
- idempotent create
- allocation sum trigger
- currency immutability trigger
- `activity` append-only

**End-to-end tests (Playwright, WebKit with an iPhone device profile):**

- sign-in by email code, using the local Supabase mail catcher
- create a family, then the first-year check
- invite and join
- add an expense, the duplicate prompt, a split
- the checklist
- forecast red, then the fix
- offline add (`context.setOffline(true)`), then sync

**Manual check on a real iPhone, each stage:**

- install
- sign-in in installed mode
- push delivery
- offline queue
- microphone (Stage 2)
- camera (Stage 3)

**AI evaluations:** `scripts/voice-eval.ts` (§9) and `scripts/receipt-eval.ts` (≥ 20 real receipts including handwritten; total must be right ≥ 90%). Both data sets are kept outside git.

---

## 13. Environments, config, deployment, operations

**Environments:**

- **Local:** `next dev`, plus the Supabase CLI local stack (needs Docker Desktop), or a second free Supabase project, `nestwise-dev`.
- **Vercel Preview** per branch, using the dev Supabase project.
- **Vercel Production** from `main`, using the prod Supabase project.

**Environment variables:**

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or publishable key) | auth client |
| `SUPABASE_SERVICE_ROLE_KEY` (or secret key) | server only: storage signing, admin auth ops |
| `DATABASE_URL` | pooler (transaction mode); Drizzle with `prepare: false` |
| `DIRECT_DATABASE_URL` | migrations |
| `OPENAI_API_KEY` | **you add this** (§14.3 decision 3) |
| `AI_MODEL` (default `gpt-6.1-terra`), `AI_EFFORT` | |
| `STT_PROVIDER`, `STT_API_KEY` | Stage 2, after the test |
| `SARVAM_API_KEY`, `SARVAM_STT_MODEL` | Stage 2 comparison only; local, never production |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | push |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` (Gmail app password), `EMAIL_FROM` | email for Stages 1–3. Before Stage 4, `RESEND_API_KEY` replaces the SMTP settings. |
| `CRON_SECRET` | protects `/api/cron/daily` |
| `APP_URL` | links in emails and notifications |
| `SIGNUP_MODE` (`invite`/`open`), `ALLOWED_SIGNUP_EMAILS` | gate |
| `CAP_VOICE_PER_MONTH`, `CAP_RECEIPTS_PER_MONTH`, `UNCAPPED_FAMILY_IDS` | Stage 4 |

**Migrations:** written with `drizzle-kit`, committed, and applied to dev automatically and to prod as a deliberate step in the release.

**Backups:**

- Supabase Free has **no automatic backups**.
- From Stage 1, a weekly GitHub Actions job runs `pg_dump` of the `app` schema into an encrypted artifact kept for 4 weeks. Running it needs a GitHub repository.
- Before Stage 4, move to Supabase Pro, which has daily backups.

**Pausing:** Supabase Free pauses a project after 7 days without activity. The daily cron's database work keeps it active.

**Vercel Hobby:**

- It is for personal, non-commercial use. A free family tool fits.
- Re-check the terms before Stage 4, especially if the app ever earns money.
- Hobby also limits cron jobs to once a day.

**Monitoring:**

- Vercel logs and the function error rate.
- Structured logs on capture calls: model, token usage, latency and outcome. Never log the content.
- Add Sentry at Stage 4.

**Running cost:**

- **Stages 1–3: ~$0 for hosting**, plus AI usage of **well under $2 a month** (§10.3, checked 2026-11-05), with no domain until Stage 4 (then ≈ ₹800–1,000 a year).
- **Stage 4:** likely Supabase Pro ($25/mo) and possibly Vercel Pro ($20/mo), plus capped AI.

---

## 14. Decisions made after the first draft

1. **Tech stack (yours, 2026-11-01):** Next.js now, native apps later (§0, §1, §2).
2. **Address and email (yours, 2026-11-01): a free `vercel.app` address for now.**
   - **Stages 1–3:** the app lives at the Vercel project address, e.g. `nestwise.vercel.app` if that name is free. Sign-in codes and backup emails go out through Gmail SMTP (§7).
   - **Before Stage 4:** buy a domain, then point the app and email at it (Resend).
   - **What the move costs.** An installed iPhone app, its notification subscriptions and its offline queue are tied to one address, so moving means:
     - both phones send everything still waiting, then reinstall the app from the new address;
     - notifications are turned on again;
     - the Google sign-in redirect URLs are re-registered;
     - the old address redirects to the new one.
     - No data is lost, because it all lives on the server.
3. **AI account (yours, 2026-11-03): OpenAI.** The key is `OPENAI_API_KEY`. Voice parsing (Stage 2) and receipt reading (Stage 3) use OpenAI behind the same adapters. This replaces the earlier assumption of Anthropic (Claude).
4. **Sign-in (yours, 2026-11-02): our own email + password.**
   - Users and sessions live in our own tables. Passwords are stored only as scrypt hashes. A session is a random token in an HttpOnly cookie, or a Bearer header for a future native app.
   - There is no Supabase Auth, no email codes and no Supabase keys; Supabase is only the Postgres host. Google sign-in may come later.
   - This replaces the email-code and Google sign-in in §7 and the PRD's §6.1.
5. **Stage 0 result (2026-11-02):**
   - On your iPhone, in installed mode, these all passed: sign-in, a lock-screen push, and an offline entry that synced once.
   - Google was not tested (your choice).
   - Decision: keep the Next.js PWA; no move to Expo.
6. **Address (2026-11-03):** the app lives at `https://nestwise-alpha.vercel.app`, Vercel project `nestwise`.
7. **Deploys migrate first (yours, 2026-11-03).**
   - A production deploy runs `migrate:deploy`, then the build.
   - Migrations use `PROD_DIRECT_DATABASE_URL`, which is the Supabase session pooler on port 5432; the IPv6 direct host was unreachable from Vercel.
   - Only `VERCEL_ENV=production` migrates.
8. **Build order after Stage 1b (yours, 2026-11-03):** Voice, then a UI design pass (the app-like feel on phone, tablet and desktop), then Photo receipts.

## 15. Stages and exit criteria

Status on 2026-11-04 is in the last column; `docs/PROGRESS.md` has the plain-language version.

| Stage | Contents | Done when | Status (2026-11-04) |
|---|---|---|---|
| **0 — iPhone spike** (1–2 days, throwaway) | Minimal installed PWA on Vercel: email-code sign-in, Google sign-in, one push notification, an offline outbox entry | On **your iPhone**, in installed mode: both sign-ins work (or the Google limitation is understood), a push arrives, and an offline entry syncs once without a duplicate. **If sign-in or notifications prove unreliable, decide here whether the iPhone app moves to Expo (React Native) before screens are built.** | **Done** 2026-11-02, with email + password instead of email codes (§14.4); Google not tested; stay on the PWA (§14.5) |
| **1a — Core plan** | Sign-in, setup + plan import, templates, month budgets, year plans, pot + checklist, typed entry (split/refund), forecast, Home, checklist and bill reminders | PRD §7 tests 1–9, 12–14, 16–18 pass in CI; your family is using it daily | **Built and live** 2026-11-03; the tests pass; daily use waits on the iPhone setup |
| **1b — Core complete** | Offline entry, duplicates + Inbox, activity screen, spending alerts, month-end review, year-end review | PRD §7 tests 10, 11, 19 pass; one full month used and the month-end review matches reality | **Built and live** 2026-11-03; the tests pass, after an independent review whose 5 serious findings were fixed; the iPhone checks and a full month of use are still to come |
| **2 — Voice** | Provider test → voice capture + review | Quality gate met on your 30+ recordings; multiple expenses from one recording (AC-11) | **Next** (OpenAI, §14.3) |
| **Design** (added 2026-11-03) | The app-like look and transitions on phone, tablet and desktop | You approve the screens | After Voice |
| **3 — Receipts** | Photo capture + review | Totals ≥ 90% right on 20+ of your receipts including handwritten; correction flow works (AC-12) | After the design |
| **4 — Public** | Own domain + Resend email (address move, §14), open signup, starter template, caps, export/delete, privacy and terms pages, Google OAuth brand verification, hourly local-time reminders, paid plans | A stranger can sign up, create a family and use everything; another family's data is unreachable; costs are capped | Later |

---

## 16. Risks

| Risk | Mitigation |
|---|---|
| Tamil / mixed voice accuracy | Provider test on your real recordings before building; adapter allows switching; typed entry always works |
| iPhone installed-app quirks (sign-in redirect, push, storage) | Stage 0 spike on a real device first; email code as the always-works path |
| Sign-in emails from a personal Gmail (could land in spam; tied to one account) | Fine for two known recipients; ask both of you to mark it "not spam" once; move to your own domain + Resend before Stage 4 |
| Free-tier gaps (no backups, pausing, daily-only cron) | Weekly dump, daily cron keeps the DB awake, upgrade before Stage 4 |
| AI cost when public | Per-family caps, usage table, model by env, refusals and failures fall back to manual |
| No background sync on iPhone | Flush on open/online/visible; visible "waiting to send" count; idempotent IDs |
| A family-isolation bug | Non-exposed schema + RLS deny-all + `Actor`-scoped gateways + an isolation test per adapter and per route |
| Forecast mistakes erode trust | Pure, fixture-tested function reproducing the PRD's worked numbers to the paise |
| A native app later needs rework | API-first + shared packages, so only the screens are rebuilt. Stage 0 decides whether the iPhone app should go native sooner |

## 17. Left to the builder

- Exact screen layouts and visuals: decided in the approved design stage (`docs/superpowers/specs/2026-11-05-nestwise-design-look-and-feel-design.md`). Small spacing and size choices stay with the builder.
- Component structure, client state handling, and whether to use TanStack Query.
- Exact wording of messages, the error-monitoring tool, and lint configuration.
- Whether local development uses the Supabase CLI with Docker or a cloud dev project.

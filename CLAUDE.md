# NestWise

NestWise is a family budget and yearly-bills forecasting web app (an installable PWA). It is built first for the
owner's own family (two adults, both admins, mainly on iPhone) and will open to the public later, for free.

## Read these first

| File | What it is |
| --- | --- |
| `docs/NestWise_PRD.md` | What to build and why. §5 has the money model and worked numbers; §7 has the acceptance tests; §8 lists every decision |
| `docs/NestWise_TRD.md` | How to build it: stack, data model, algorithms, security, auth, PWA, notifications, stages |
| `docs/superpowers/plans/2026-11-01-nestwise-stage-0-and-1a.md` | The task-by-task build plan: Stage 0 iPhone spike, then Stage 1a tasks 1–15 |
| `docs/NestWise_Sample_Budget_and_Expense_Data.md` | The family's real plan amounts plus **fictional** test transactions |
| `docs/Family_Budget_Expense_Forecasting_FRD_v1_1.md` | The original FRD |

## Architecture rules

All server code follows the project skills **`hexagonal-architecture`** and **`clean-architecture`**
(`.claude/skills/`). Read both before writing any code under `packages/domain` or `apps/web`. Where the TRD and the
skills differ on code structure, the skills win.

## Decisions that are easy to get wrong

- **Stack:**
  - The app is Next.js 16 + TypeScript in a pnpm monorepo, built API-first so a React Native (Expo) app can be added later.
  - Hosting is Vercel Hobby on a free `*.vercel.app` address.
  - The backend is Supabase **as the Postgres host** (and Storage later). Supabase Auth is **not** used.
- **Email:**
  - Gmail SMTP for now.
  - Sign-up and sign-in are our own **email + password** (owner, 2026-11-02): users and sessions live in our own tables, passwords stored only as scrypt hashes, sessions as random tokens in an HttpOnly cookie (or a Bearer header for a future native app). No Supabase Auth, no Supabase keys, no email codes; Google maybe later. This replaces PRD §6.1 / TRD §7.
- **Money:**
  - Amounts are integer minor units (paise); never floats.
  - A family's currency is locked once the family is created.
- **One pot for yearly bills:**
  - The monthly set-aside is the yearly total ÷ 12.
  - Only deposits the family confirms count.
  - Undated items never get an invented month.
- **No real data in tests:** fictional sample transactions never go into production data.
- **Copy:** English only, with every string in `messages/en.json`, so other languages can be added later.

## Secrets

- **Where they live.** Real values go in `.env.local`, which is gitignored. `.env.example` lists the names only.
- **What never to do:**
  - Never commit, print, echo or paste a secret value.
  - Never copy one into docs, tests or logs.
  - Refer to secrets by variable name only.
- **Who enters passwords.** The owner sets the Gmail app password in the Supabase SMTP settings and in the Vercel env.

## Working with the owner

- **Plain language.** Explain in plain, non-technical words and keep questions short and concrete. The owner
  prefers numbered questions they can answer by number.
- **Commits.** Commit only when the owner asks.

## Status (2026-11-03)

- Live at https://nestwise-alpha.vercel.app:
  - Stage 1a (core money model)
  - Stage 1b: offline adding, duplicates and the Inbox, month-end and year-end reviews, activity and the expense list, spending alerts, template changes to future months
- Stage 1b plan: `docs/superpowers/plans/2026-11-03-nestwise-stage-1b.md`, built natively with one fresh whole-branch review; its deferred minors are in the plan's ledger
- Waiting on the owner:
  - iPhone setup, the spouse invite and the airplane-mode check (`docs/RUNBOOK.md` §4–5)
  - the first daily cron run
- Next, in order: Voice (OpenAI), UI design (frontend-design skill; the owner noted some Home display items to look at), Photo receipts

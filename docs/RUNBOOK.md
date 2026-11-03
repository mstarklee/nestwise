# NestWise runbook

How to put NestWise live for the family, keep it backed up, and check it works. Settings are named here, never
their values. Real values live only in Vercel's settings, GitHub's secrets and your own `.env.local`.

## What runs where

| Part | Where | Notes |
| --- | --- | --- |
| The app (screens + `/api/v1`) | Vercel Hobby, project root `apps/web`, a free `*.vercel.app` address | Next.js 16 |
| The database | Supabase, used **only as the Postgres host** | No Supabase Auth, no Supabase keys |
| Daily reminders | Vercel Cron → `GET /api/cron/daily` at 02:30 UTC (≈ 08:00 in India) | `apps/web/vercel.json` |
| Weekly backup | GitHub Actions `.github/workflows/backup.yml` | Needs a GitHub repository |

## 1. Production settings (you do these)

In Vercel → the `nestwise` project → Settings → Environment Variables (Production), add every name in
`apps/web/.env.example`:

- `DATABASE_URL`: the Supabase **transaction pooler** string (port 6543).
- `PROD_DIRECT_DATABASE_URL` (**Production only**, not Preview): the Supabase **session pooler** string (port 5432).
  Each production deploy uses it to update the database first (section 2). Supabase's "Direct connection" address
  does not work from Vercel, so use the session pooler one.
- `SIGNUP_MODE=invite`, `ALLOWED_SIGNUP_EMAILS` (your email; your spouse joins by invite link and need not be
  listed), `PLAN_IMPORT_EMAILS` (your email).
- `APP_URL`: the app's address, e.g. `https://<project>.vercel.app`.
- `CRON_SECRET`: a long random string (Vercel sends it to the daily job).
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` + your email).
- `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASSWORD` (a Gmail **app password**), `EMAIL_FROM`.

In Vercel → Settings → General, set **Root Directory** to `apps/web`, and keep **Include files outside the Root
Directory in the Build Step** switched on (the app builds from the shared `packages/*`).

## 2. Migrate the production database

The schema changes are committed in `packages/db/migrations`. **Production deploys apply them automatically**:
`apps/web/vercel.json` sets the build command to `pnpm --filter @nestwise/db migrate:deploy && pnpm build`.

- On a production deploy it applies whatever is missing, using `PROD_DIRECT_DATABASE_URL`, then builds. The build log
  shows `Production migrations applied.`
- If a migration fails, or `PROD_DIRECT_DATABASE_URL` is missing, the deploy fails and the current version stays live.
- Preview deploys and local builds print `Not a production deploy: migrations skipped.` and never touch production.

To apply them by hand instead (for example, to check a migration before deploying), put the same string in your own
`.env.local` as `PROD_DIRECT_DATABASE_URL` and run:

```bash
pnpm --filter @nestwise/db migrate:prod
```

Running either again is safe; they only apply what is missing.

The migrations switch on row-level security for every table, with no policies for Supabase's public roles, and
create the role `nestwise_app` with access to schema `app`. If the app connects as the tables' owner (the default
`postgres` user), nothing more is needed. If you ever give the app its own login, grant it that role:
`GRANT nestwise_app TO <app_login>;`.

## 3. Deploy

From the repository root, with the Vercel CLI signed in:

```bash
vercel --prod
```

Then check the app reaches its database:

```bash
curl -s https://<project>.vercel.app/api/v1/health
```

Expected: `{"status":"ok","database":"ok"}` (HTTP 200). A 503 means the app cannot reach the database: check `DATABASE_URL`.

## 4. Set up the family (on your iPhone)

1. Open the app address in Safari, then Share → **Add to Home Screen**, and open NestWise from the Home Screen.
2. **Create account** with your email (it must be in `ALLOWED_SIGNUP_EMAILS`) and a password.
3. Setup: family name, currency **INR** (locked afterwards), time zone **Asia/Kolkata**, country `IN`, and the money
   already kept aside for yearly bills (0 if none).
4. Tap **Import our plan**. This loads `fixtures/sample-plan.ts`: your groups, items and amounts, and **no expenses**.
   (If the button is missing, your email is not in `PLAN_IMPORT_EMAILS`. The command-line fallback is
   `pnpm import-plan --family <family id>` with `DATABASE_URL` pointing at production.)
5. First-year check: dated bills from this month on are already ticked; tick the undated items still to come this year.
6. Settings → Family → **Create invite link** (role Admin) and send it to your spouse. It works once, for 7 days.
7. Install page → **Turn on reminders**, on each phone, from the installed app.

Never run `pnpm seed:dev` against production: it loads fictional expenses. It refuses anything but a database on
your own computer.

## 5. Acceptance run (PRD §7)

Run the browser test locally first (it uses its own local database, `nestwise_e2e`):

```bash
pnpm e2e
```

Then walk through these on the iPhone, in the installed app, and tick each one:

| # | Check | Done |
| --- | --- | --- |
| 1 | Amounts show correctly for INR: ₹1,35,417 style grouping | [ ] |
| 2 | Everything works without entering any income | [ ] |
| 3 | Renaming the family changes nothing else (rename not built in 1a: skip until Stage 1b) | [ ] |
| 4 | The currency cannot be changed (Settings → Family shows it locked) | [ ] |
| 5 | Your spouse signs in with their own account and sees the same family | [ ] |
| 6 | Editing December's budget leaves November and January alone; a template edit leaves existing months alone | [ ] |
| 7 | Dated yearly bills sit in their month; "No month yet" items never get a month you did not choose | [ ] |
| 8 | (Local, `pnpm seed:dev` data) October 2026 spending ₹84,450 vs ₹81,500 planned (+₹2,950); Groceries +₹2,000, Fruits −₹500 | [ ] |
| 9 | (Local) October's car insurance and school fees are not in the ₹84,450; they come out of the pot | [ ] |
| 12 | ₹204.50 is saved and shown exactly | [ ] |
| 13 | The suggested pot deposit is ₹36,917 (₹4,43,000 ÷ 12) | [ ] |
| 14 | The forecast shows 12 months; the November example ends October at ₹1,57,000 | [ ] |
| 16 | Everything essential works on the phone screen | [ ] |
| 17 | Old months and years stay available | [ ] |
| 18 | Another family's data can never be seen (covered by the integration tests) | [ ] |

The day after deploying, check the cron ran (Vercel → Logs, `/api/cron/daily` returns 200 with a summary). On the 1st
of the month, the checklist reminder should arrive on both phones.

## 6. Backups and restore

**Weekly backup.** `.github/workflows/backup.yml` runs every Sunday at about 02:30 India time (and on demand from
the Actions tab). It needs two repository secrets: `PROD_DATABASE_URL` (the direct connection, port 5432) and
`BACKUP_PASSPHRASE` (a long passphrase; keep a copy somewhere safe outside GitHub). Each run keeps an encrypted dump
of schema `app` for 4 weeks.

**Restore** (into an empty database, or after confirming you want to replace the data):

1. Download the artifact from the workflow run and unzip it to get `nestwise-app-<date>.sql.gz.enc`.
2. Decrypt and unpack it (you are asked for the passphrase):

   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in nestwise-app-<date>.sql.gz.enc | gunzip > nestwise-app.sql
   ```

3. Load it with `psql` into the target database's direct connection. The dump contains schema `app` only; run the
   migrations first on a brand-new database so the `nestwise_app` role exists. Restoring over live data replaces it,
   so do this only on purpose.

## 7. Local development

- `.env.local` (from `.env.example`) at the repository root holds your local settings. Point its `DATABASE_URL` at
  your own computer's database, never at Supabase. The app reads its settings from `apps/web`, so keep a copy there as
  `apps/web/.env.local` too, and change both when a setting changes.
- `pnpm migrate` creates or updates the tables in that local database; `pnpm dev` starts the app at
  `http://localhost:3000`.
- `pnpm test` (unit), `pnpm test:integration` (needs the local Postgres in `DB_*`), `pnpm e2e` (WebKit, iPhone size;
  install the browser once with `pnpm --filter web exec playwright install webkit`).
- `pnpm seed:dev` loads the fictional sample family into your local database; sign in as `dev@example.com`.

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
- `SIGNUP_MODE=open` (since 2026-11-06: anyone may create an account, and must verify their email before using the
  app). `invite` with `ALLOWED_SIGNUP_EMAILS` still limits who may create a family. `PLAN_IMPORT_EMAILS` (your email).
- `APP_URL`: the app's address, e.g. `https://<project>.vercel.app`. **Required**: the verify-email and reset-password
  links and the Google redirect are built from it, and sign-up refuses to run in production without it.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: the OAuth client from Google Cloud (project `NestWise` → Google Auth
  Platform → Clients → `nestwise-web`, type Web application). Its **Authorised redirect URIs** must include
  `https://nestwise-alpha.vercel.app/api/v1/auth/google/callback` (and `http://localhost:3000/api/v1/auth/google/callback`
  for local work). While the Google app is in "Testing", only the test users listed under **Audience** can use it;
  click **Publish app** there before opening to the public (name and email only, so Google needs no review).
- `CRON_SECRET`: a long random string (Vercel sends it to the daily job).
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:` + your email).
- `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASSWORD` (a Gmail **app password**), `EMAIL_FROM`.
- **Voice (Stage 2).** The speech service was chosen on 2026-11-05 (section 8): **Sarvam Saaras**. So production
  needs `STT_PROVIDER=sarvam` and **`SARVAM_API_KEY`** (the app prefers a service's own key name over the shared
  `STT_API_KEY`). `OPENAI_API_KEY` is still needed — the understanding step runs on it — plus `AI_MODEL` if you want
  something other than the default `gpt-6.1-terra`. `CAP_VOICE_PER_MONTH` defaults to 400, so set it only to change it.

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
2. **Create account** with your email and a password, or tap **Continue with Google**. With email and password, open
   the "Verify your email" message and tap its link (it works for 24 hours) before the app opens.
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
| 3 | Renaming the family changes nothing else (Settings → Family → Name) | [ ] |
| 4 | The currency cannot be changed (Settings → Family shows it locked) | [ ] |
| 5 | Your spouse signs in with their own account and sees the same family | [ ] |
| 6 | Editing December's budget leaves November and January alone; a template edit leaves existing months alone | [ ] |
| 7 | Dated yearly bills sit in their month; "No month yet" items never get a month you did not choose | [ ] |
| 8 | (Local, `pnpm seed:dev` data) October 2026 spending ₹84,450 vs ₹81,500 planned (+₹2,950); Groceries +₹2,000, Fruits −₹500 | [ ] |
| 9 | (Local) October's car insurance and school fees are not in the ₹84,450; they come out of the pot | [ ] |
| 10 | (Local) The same purchase entered twice is one expense after answering "Same purchase" | [ ] |
| 11 | Two ₹1,250 vegetable purchases a week apart are never asked about | [ ] |
| 12 | ₹204.50 is saved and shown exactly | [ ] |
| 13 | The suggested pot deposit is ₹36,917 (₹4,43,000 ÷ 12) | [ ] |
| 14 | The forecast shows 12 months; the November example ends October at ₹1,57,000 | [ ] |
| 16 | Everything essential works on the phone screen | [ ] |
| 17 | Old months and years stay available | [ ] |
| 18 | Another family's data can never be seen (covered by the integration tests) | [ ] |
| 19 | A yearly bill still open at year end is never counted twice or dropped: it stays until marked done, moved into this year, or dropped (Yearly bills → year-end) | [ ] |
| 1b-a | With no signal (airplane mode), an expense saves on the phone, shows "1 expense waiting to send", and sends once when the signal is back | [ ] |
| 1b-b | On the 1st, Home shows "October is over: take a look"; the review closes the month with one tap | [ ] |
| 1b-c | Activity lists every change; "All expenses" filters by month, item, who paid and how | [ ] |
| 1b-d | A group passing 80% of its month's plan sends one alert to both phones | [ ] |

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
- `pnpm seed:dev --showcase` also loads fictional spending in the current month, so every screen case shows: Food over
  plan, Kids nearly used up, Housing exactly used, a part-paid bike insurance, and a set-aside too small for June
  2027. It needs an empty database. To keep your own data safe, point it at a spare one:
  `DB_NAME=nestwise_showcase pnpm seed:dev --showcase` (create and migrate that database first, for example with
  `TEST_DB_NAME=nestwise_showcase node --env-file-if-exists=.env.local --import tsx scripts/e2e-db.ts`). It still refuses
  production and any database that is not on this computer.

---

## 8. Choosing the speech service (Stage 2)

> **Decided on 2026-11-05: Sarvam Saaras (`saaras:v4`).** Four of the owner's own recordings, two mostly Tamil, were
> run through both services. **Amounts: 11/11 on both.** Tamil number words (*aayirathu ainooru*, *moovaayiram*,
> *irunoothampathu*) were read correctly by both. Sarvam's raw Tamil was consistently cleaner — correct spelling of
> number words, "KPN" read as an acronym, correct word endings, and amounts normalised to digits — so it was chosen
> on hearing quality, accepting its 30-second limit over OpenAI's 60. The noisy and long recordings were not made,
> so the two services were never separated under the hardest conditions. Switching back is a one-line env change.
> The full 30-recording gate is still Stage 2's exit criterion.

Which service hears your Tamil best is decided by **your own recordings**, not by a vendor's claim. The full
instructions for you are in `D:\Mouni\voice-samples\READ-ME-FIRST.txt`; the technical detail is in
`scripts/voice-eval.README.md`. In short:

1. **Record** six notes on Voice Memos, from **both adults**: two mostly Tamil with Tamil number words, one Tamil and
   English mixed, one somewhere noisy, one naming a yearly bill, and one over 30 seconds. Say them the way you really
   would — dictation-speed speech in a quiet room proves nothing.
2. **Put them in a folder outside this repository**, e.g. `D:\Mouni\voice-samples`. They are recordings of your
   family and must never reach git; the script refuses a path inside the repo.
3. **Write down the right answer** for each — every amount and the category it belongs in. Plain words are enough;
   `expected.json` can be written from them.
4. **Run it:**

   ```bash
   pnpm voice-eval --audio "D:/Mouni/voice-samples"
   ```

   Keys come from both `.env.local` files automatically (`OPENAI_API_KEY` at the root, `SARVAM_API_KEY` in
   `apps/web`). A service whose key is missing is skipped with a warning.
5. **Read the report.** It shows, per recording, the exact words each service heard and whether the amount and the
   category came out right, plus the cost. `voice-eval-report.txt` and `voice-eval-result.json` are written beside
   the audio, never into git.
6. **The pass mark** is amount ≥ 90% and item ≥ 80% on 30+ recordings (PRD §8 decision 18). That is Stage 2's exit
   criterion. The first handful is only there to tell us early whether Tamil works at all.

Then set `STT_PROVIDER` and `STT_API_KEY` to the winner, locally and in Vercel.

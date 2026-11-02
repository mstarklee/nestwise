# NestWise iPhone spike (Stage 0, throwaway)

A one-page installed web app that answers one question before any real screens are built: **does an installed
web app on iPhone do sign-in, notifications and offline entries well enough?** If not, the iPhone app moves to
Expo (React Native) instead (TRD §15, Stage 0).

This folder is **throwaway**. It has no unit tests, it is not part of the pnpm workspace, and it deploys to its
own Vercel project, `nestwise-spike`, at **https://nestwise-spike-chi.vercel.app** (`nestwise-spike.vercel.app` was taken). Git deploys are disconnected; deploy with `vercel --prod` from this folder. What it teaches goes into plan Tasks 13 and 14.

## What is in it

| File | What it does |
| --- | --- |
| `app/page.tsx` | The one page: status, email + password sign-up and sign-in, "Turn on reminders", "Send test push", "Add offline entry" |
| `app/manifest.ts` | Installable app: `display: standalone`, `start_url: /`, 192 and 512 icons; the 180 px Apple icon is set in `app/layout.tsx` |
| `app/sw.ts` | Service worker (Serwist): pages network-first (last copy opens offline), static files precached, shows pushes, opens the app on tap |
| `app/api/push/route.ts` | Saves this device's push subscription; sends one test push (after 10 s, so there's time to lock the phone) |
| `app/api/entries/route.ts` | Saves an entry by its phone-made id with `INSERT … ON CONFLICT (id) DO NOTHING` into `spike_entries` |
| `lib/outbox.ts` | Dexie queue on the phone; sends on app open, on `online` and when the app comes to the front |
| `lib/db.ts` | `pg` pool + Vercel `attachDatabasePool`, with time limits; uses `DATABASE_URL`, or builds it from the `DB_*` parts |
| `setup.sql` | Creates the spike tables once (not on every start-up) |
| `lib/auth.ts` | Own email + password accounts and sessions |

Sign-up and sign-in are our own email + password (`lib/auth.ts`, `app/api/auth/[action]/route.ts`): scrypt password
hashes, a random session token in an HttpOnly cookie (180 days), stored only as a SHA-256 hash. No Supabase Auth.
The spike creates its tables (`spike_users`, `spike_sessions`, `spike_entries`, `spike_push_subscriptions`) itself on
first use, with row-level security on.

## Settings it needs (names only)

The database as `DATABASE_URL` (or the five `DB_*` parts)
— the **Supabase** database, since Vercel can't reach a home computer —
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.

## The checks (on the owner's iPhone)

Create your account in the app ("Create account"). Open the spike address in Safari, sign in once, then Share → **Add to Home Screen**, and open it from the Home Screen.

| # | Check | How | Result |
| --- | --- | --- | --- |
| a | Email + password inside the installed app | In the installed app: sign out, type your email and password, tap Sign in. Then close the app fully (swipe it away) and reopen it. Still signed in? | **PASS** (2026-11-02, owner, iPhone, installed app) |
| b | Google sign-in | Not tested: the owner chose email + password for now (2026-11-02); Google may be added later. | _not tested_ |
| c | Push on the lock screen | In the installed app: "Turn on reminders" → Allow. Tap "Send test push (in 10 s)" and lock the phone. Does a notification show on the lock screen within 30 s? | **PASS** (2026-11-02, owner, iPhone, installed app) |
| d | Offline entries, no duplicates | "Clear test entries". Turn on airplane mode, tap "Add offline entry" twice ("Waiting to send" = 2). Turn airplane mode off, close and reopen the app. "Rows on server" = 2? Then tap "Resend everything twice": still 2? | **PASS** (2026-11-02, owner: 2 rows after reopening, still 2 after resending twice) |

## Findings so far

- **Never precache the page itself.** The first build precached `/` keyed by the git commit; a redeploy without a new
  commit kept the same key, so phones kept showing the old page (sign-in broke). Pages must be network-first, with the
  last copy used only offline. Task 13 must follow this.
- **Database connections on Vercel must be closed before the function pauses.** With `postgres` (postgres.js), one
  connection and no time limits, a connection died during a pause and every later request hung 300 s (sign-in
  "worked only sometimes"). Fix: `pg` Pool + `attachDatabasePool` from `@vercel/functions`, a 5 s idle timeout, and
  connect/query time limits. Never run DDL on start-up. The real app (`packages/db`) must do the same.

## Decision

**Continue with the Next.js installed web app (2026-11-02).** Checks (a), (c) and (d) passed on the owner's iPhone in
installed mode; (b) Google was not tested because the owner chose email + password for now. No switch to Expo. Rule (plan Task 0, Step 4): if (a), (c) and (d) pass, continue with the Next.js web app. If (a) or
(c) fails, stop: the iPhone app switches to Expo before screens are built.

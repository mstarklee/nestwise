# NestWise account handling: verify email, forgot password, Google sign-in

Owner approved in chat on 2026-11-06. This adds to the own email + password sign-in from Stage 1a (owner, 2026-11-02).

## Why

NestWise will open to the public. Anyone may create an account, but an email must be proved before the app can be
used. People forget passwords, and many would rather tap "Continue with Google".

## What the owner decided

- **Anyone can create an account.** `SIGNUP_MODE` now defaults to `open`. `invite` still works if it is set.
- **Email verification is required.** After sign-up the person gets a "Verify my email" link. Until they click it,
  every app screen sends them to a "Check your email" screen with a Resend button.
- **Google sign-in** is on the sign-in and sign-up screens. A Google account whose email matches an existing account
  joins that account. With no account, it creates one, already verified (Google has checked the email).
- **Forgot password** emails a reset link.

## Calls made by the builder (not the owner)

- The verify link lasts 24 hours. The reset link lasts 1 hour and works once. A newer link makes older ones of the
  same kind stop working.
- Resend and "forgot password" send at most one email per minute per account.
- "Forgot password" says "If that email has an account, we've sent a link" either way, so it never reveals who has
  an account.
- After a password reset, every session of that account is signed out. The browser that did the reset is signed in.
  A reset also counts as proving the email.
- A Google account joining an account that was **never verified** removes that account's password and signs out its
  sessions. Someone who signed up with another person's email cannot keep a way in.
- A Google-only account has no password. It can add one through "forgot password".
- Accounts that existed before this change are marked verified (the migration sets `email_verified_at`).
- Links in emails open a page that confirms through the API when it loads (a POST). An email scanner that only
  fetches the link does not use up a reset link.
- With no SMTP settings outside production, the link is written to the server log so local work still runs. In
  production nothing is logged.
- Google is plain OAuth 2.0 with PKCE and a `state` cookie, scope `openid email profile`. The ID token comes straight
  from Google's token endpoint over TLS, so the app checks its issuer, audience, expiry and `email_verified` without
  fetching Google's signing keys (OpenID Connect Core §3.1.3.7).

## Shape

- **Domain (`packages/domain/src/auth`).** The `User` model gains `emailVerifiedAt`, `googleSubject` and a nullable
  `passwordHash`. New ports:
  - `OneTimeTokenGateway` (hashed, single-use tokens with a purpose)
  - `AccountEmailGateway`
  - `GoogleIdentityGateway`
  - extra methods on `UserGateway` and `SessionGateway`

  New use cases:
  - `ConfirmEmailUseCase`
  - `ResendVerificationUseCase`
  - `RequestPasswordResetUseCase`
  - `ResetPasswordUseCase`
  - `SignInWithGoogleUseCase`

  `SignUpUseCase` sends the verify email. `assertEmailVerified` is the rule the app's gates call.
- **Database.** Migration `0006_account_handling`:
  - `users.password_hash` becomes nullable
  - new `users.email_verified_at` and `users.google_subject` (unique)
  - new `app.auth_tokens` table
- **API (`/api/v1/auth`).**
  - `verification/confirm`, `verification/resend`
  - `password/forgot`, `password/reset`
  - `google/start`, `google/callback`
  - `me` now returns `emailVerified`
- **Screens.**
  - `/sign-in` gains "Continue with Google" and "Forgot password?"
  - new `/verify-email`, `/verify-email/confirm`, `/forgot-password` and `/reset-password`
- **Environment.**
  - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (new)
  - `APP_URL` (used to build email links and the Google redirect)
  - the existing SMTP settings

## Not in scope

- Rate limits on password guessing
- Changing email address
- Deleting an account
- Google sign-in inside the future native app

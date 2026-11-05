type Env = Readonly<Record<string, string | undefined>>;

/**
 * Who may create a family. SIGNUP_MODE=open (the default since 2026-11-06, owner: anyone may create an account and a
 * family, once the email is verified). SIGNUP_MODE=invite: only emails listed in ALLOWED_SIGNUP_EMAILS; everyone else
 * joins through an invite.
 */
export function signupAllowed(email: string, env: Env = process.env): boolean {
  if ((env.SIGNUP_MODE ?? 'open') !== 'invite') return true;
  const allowed = (env.ALLOWED_SIGNUP_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

/** Setup shows "Import our plan" only to an Admin whose email may import (a member's tap would only fail with 403). */
export function setupShowsImport(email: string, role: 'admin' | 'member' | 'viewer', env: Env = process.env): boolean {
  return role === 'admin' && planImportAllowed(email, env);
}

/** Who may load the family's own plan from fixtures/sample-plan.ts at setup: only emails in PLAN_IMPORT_EMAILS. */
export function planImportAllowed(email: string, env: Env = process.env): boolean {
  return (env.PLAN_IMPORT_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.trim().toLowerCase());
}

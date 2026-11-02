type Env = Readonly<Record<string, string | undefined>>;

/**
 * Who may create a family (TRD §7). SIGNUP_MODE=invite (the default until Stage 4): only emails listed in
 * ALLOWED_SIGNUP_EMAILS; everyone else joins through an invite. SIGNUP_MODE=open: anyone.
 */
export function signupAllowed(email: string, env: Env = process.env): boolean {
  if ((env.SIGNUP_MODE ?? 'invite') === 'open') return true;
  const allowed = (env.ALLOWED_SIGNUP_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.trim().toLowerCase());
}

/** Who may load the family's own plan from fixtures/sample-plan.ts at setup: only emails in PLAN_IMPORT_EMAILS. */
export function planImportAllowed(email: string, env: Env = process.env): boolean {
  return (env.PLAN_IMPORT_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.trim().toLowerCase());
}

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

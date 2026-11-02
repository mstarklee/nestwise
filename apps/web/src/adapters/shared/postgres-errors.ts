import 'server-only';

/** True when `error` (or its cause, as Drizzle wraps driver errors) is a Postgres unique violation (23505). */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  for (let e: unknown = error; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    const pg = e as { code?: string; constraint?: string };
    if (pg.code === '23505') return constraint === undefined || pg.constraint === constraint;
  }
  return false;
}

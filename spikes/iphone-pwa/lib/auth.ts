import "server-only";
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { getSql } from "./db";

// Own email + password accounts (owner's choice, 2026-11-02): users and sessions live in our database.
// Passwords are stored only as scrypt hashes; sessions are random tokens stored only as SHA-256 hashes.

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number, options: object) => Promise<Buffer>;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;
export const SESSION_COOKIE = "nw_session";
const SESSION_DAYS = 180;

export class NotSignedInError extends Error {}
export class AuthInputError extends Error {}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export function normaliseEmail(input: unknown): string {
  const email = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new AuthInputError("Enter a valid email.");
  return email;
}

export function checkPassword(input: unknown): string {
  const password = typeof input === "string" ? input : "";
  if (password.length < 8) throw new AuthInputError("Use a password of at least 8 characters.");
  if (password.length > 200) throw new AuthInputError("That password is too long.");
  return password;
}

/** Creates a session and returns the Set-Cookie header value. */
export async function startSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const sql = await getSql();
  await sql`insert into public.spike_sessions (token_hash, user_id, expires_at)
    values (${sha256(token)}, ${userId}, now() + make_interval(days => ${SESSION_DAYS}))`;
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 24 * 60 * 60}`;
}

export const clearedCookie = `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

/** The session token from the cookie, or from `Authorization: Bearer` (what a future native app would send). */
export function sessionToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Bearer ")) return header.slice(7);
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.split(/;\s*/).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(SESSION_COOKIE.length + 1)) : null;
}

export async function endSession(request: Request): Promise<void> {
  const token = sessionToken(request);
  if (!token) return;
  const sql = await getSql();
  await sql`delete from public.spike_sessions where token_hash = ${sha256(token)}`;
}

export async function currentUser(request: Request): Promise<{ id: string; email: string } | null> {
  const token = sessionToken(request);
  if (!token) return null;
  const sql = await getSql();
  const rows = await sql<{ id: string; email: string }[]>`
    select u.id, u.email from public.spike_sessions s join public.spike_users u on u.id = s.user_id
    where s.token_hash = ${sha256(token)} and s.expires_at > now()`;
  return rows[0] ?? null;
}

export async function requireUserId(request: Request): Promise<string> {
  const user = await currentUser(request);
  if (!user) throw new NotSignedInError();
  return user.id;
}

export async function createUser(email: string, password: string): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<{ id: string }[]>`
    insert into public.spike_users (id, email, password_hash) values (${randomUUID()}, ${email}, ${await hashPassword(password)})
    on conflict (email) do nothing returning id`;
  return rows[0]?.id ?? null;
}

export async function checkCredentials(email: string, password: string): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<{ id: string; password_hash: string }[]>`
    select id, password_hash from public.spike_users where email = ${email}`;
  const user = rows[0];
  // Hash even when the email is unknown, so timing does not reveal which emails have accounts.
  const ok = await verifyPassword(password, user?.password_hash ?? (await hashPassword("not-a-real-password")));
  return user && ok ? user.id : null;
}

export function handle(fn: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    try {
      return await fn(request);
    } catch (error) {
      if (error instanceof NotSignedInError) return Response.json({ error: "not_signed_in" }, { status: 401 });
      if (error instanceof AuthInputError) return Response.json({ error: error.message }, { status: 422 });
      console.error(error);
      return Response.json({ error: "server_error" }, { status: 500 });
    }
  };
}

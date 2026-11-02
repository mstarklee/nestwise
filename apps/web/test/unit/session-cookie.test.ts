import { describe, expect, it } from 'vitest';
import { clearedSessionCookie, sessionCookie } from '@/http/session-cookie';

const expires = new Date('2027-05-01T00:00:00Z');
const now = new Date('2026-11-02T00:00:00Z');

describe('sessionCookie', () => {
  it('is HttpOnly and Secure on https', () => {
    const cookie = sessionCookie(new Request('https://nestwise.vercel.app/api/v1/auth/signin'), 'tok', expires, now);
    expect(cookie).toBe('nw_session=tok; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=15552000');
  });

  it('drops Secure only for plain-http localhost (local browser tests), never for another host', () => {
    expect(sessionCookie(new Request('http://localhost:3100/x'), 'tok', expires, now)).not.toContain('Secure');
    expect(sessionCookie(new Request('http://127.0.0.1:3100/x'), 'tok', expires, now)).not.toContain('Secure');
    expect(sessionCookie(new Request('http://example.com/x'), 'tok', expires, now)).toContain('Secure');
    expect(clearedSessionCookie(new Request('http://localhost:3100/x'))).toBe('nw_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    expect(clearedSessionCookie(new Request('https://nestwise.vercel.app/x'))).toContain('Secure');
  });
});

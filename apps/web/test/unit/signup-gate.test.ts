import { describe, expect, it } from 'vitest';
import { signupAllowed } from '@/http/signup-gate';

describe('signupAllowed', () => {
  it('in invite mode, allows only listed emails (any case, spaces ignored)', () => {
    const env = { SIGNUP_MODE: 'invite', ALLOWED_SIGNUP_EMAILS: ' Priya@Example.com , arun@example.com' };
    expect(signupAllowed('priya@example.com', env)).toBe(true);
    expect(signupAllowed('ARUN@example.com', env)).toBe(true);
    expect(signupAllowed('stranger@example.com', env)).toBe(false);
  });

  it('defaults to invite mode with nobody allowed', () => {
    expect(signupAllowed('priya@example.com', {})).toBe(false);
  });

  it('in open mode, allows everyone', () => {
    expect(signupAllowed('stranger@example.com', { SIGNUP_MODE: 'open' })).toBe(true);
  });
});

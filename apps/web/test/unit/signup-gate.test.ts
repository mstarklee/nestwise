import { describe, expect, it } from 'vitest';
import { planImportAllowed, setupShowsImport, signupAllowed } from '@/http/signup-gate';

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

describe('planImportAllowed', () => {
  it('allows only emails in PLAN_IMPORT_EMAILS, whatever the signup mode', () => {
    const env = { SIGNUP_MODE: 'open', PLAN_IMPORT_EMAILS: 'Priya@example.com' };
    expect(planImportAllowed(' priya@EXAMPLE.com', env)).toBe(true);
    expect(planImportAllowed('stranger@example.com', env)).toBe(false);
    expect(planImportAllowed('priya@example.com', {})).toBe(false);
  });
});

describe('setupShowsImport', () => {
  const env = { PLAN_IMPORT_EMAILS: 'priya@example.com' };
  it('shows "Import our plan" only to a listed Admin', () => {
    expect(setupShowsImport('priya@example.com', 'admin', env)).toBe(true);
    expect(setupShowsImport('priya@example.com', 'member', env)).toBe(false);
    expect(setupShowsImport('arun@example.com', 'admin', env)).toBe(false);
  });
});

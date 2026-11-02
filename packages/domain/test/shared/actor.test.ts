import { describe, expect, it } from 'vitest';
import { type Actor, assertCan, NotAllowedError, type Permission } from '../../src/shared';

const actor = (role: Actor['role']): Actor => ({ userId: 'u1', familyId: 'f1', role });
const viewer = actor('viewer');
const member = actor('member');
const admin = actor('admin');

describe('assertCan', () => {
  it('refuses what a role may not do', () => {
    expect(() => assertCan(viewer, 'record_expense')).toThrow(NotAllowedError);
    expect(() => assertCan(member, 'edit_plan')).toThrow(NotAllowedError);
    expect(() => assertCan(member, 'manage_family')).toThrow(NotAllowedError);
  });

  it('allows what a role may do', () => {
    expect(() => assertCan(admin, 'manage_family')).not.toThrow();
    expect(() => assertCan(viewer, 'read')).not.toThrow();
  });

  it('follows the role → permission table exactly', () => {
    const all: Permission[] = ['read', 'record_expense', 'edit_month_budget', 'confirm_checklist', 'edit_plan', 'manage_family'];
    const allowed = (a: Actor) =>
      all.filter((p) => {
        try {
          assertCan(a, p);
          return true;
        } catch {
          return false;
        }
      });
    expect(allowed(viewer)).toEqual(['read']);
    expect(allowed(member)).toEqual(['read', 'record_expense', 'edit_month_budget', 'confirm_checklist']);
    expect(allowed(admin)).toEqual(all);
  });

  it('NotAllowedError has category not_allowed', () => {
    expect(new NotAllowedError('no').category).toBe('not_allowed');
  });
});

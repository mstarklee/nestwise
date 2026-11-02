import { NotAllowedError } from './errors';

export type Role = 'admin' | 'member' | 'viewer';

/** Who is asking: resolved from the session by the outside, never from a request body. */
export interface Actor {
  readonly userId: string;
  readonly familyId: string;
  readonly role: Role;
}

export type Permission = 'read' | 'record_expense' | 'edit_month_budget' | 'confirm_checklist' | 'edit_plan' | 'manage_family';

const VIEWER: readonly Permission[] = ['read'];
const MEMBER: readonly Permission[] = [...VIEWER, 'record_expense', 'edit_month_budget', 'confirm_checklist'];
const ADMIN: readonly Permission[] = [...MEMBER, 'edit_plan', 'manage_family'];

const PERMISSIONS: Record<Role, readonly Permission[]> = { viewer: VIEWER, member: MEMBER, admin: ADMIN };

export function assertCan(actor: Actor, permission: Permission): void {
  if (!PERMISSIONS[actor.role].includes(permission)) {
    throw new NotAllowedError(`A ${actor.role} may not ${permission.replaceAll('_', ' ')}`);
  }
}

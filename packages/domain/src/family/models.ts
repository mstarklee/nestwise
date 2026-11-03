import type { Actor, IsoDate, MinorUnit, Period, Role } from '../shared';

export const INVITE_DAYS = 7;

export interface Family {
  readonly id: string;
  readonly name: string;
  readonly currencyCode: string;
  /** Locked with the currency once the family exists. */
  readonly minorUnit: MinorUnit;
  /** For number formatting, e.g. en-IN (lakh grouping). */
  readonly numberLocale: string;
  readonly timeZone: string;
  readonly countryCode: string | null;
  readonly setAsideOverrideMinor: number | null;
  readonly alertThresholds: readonly number[];
  readonly createdBy: string;
  readonly createdAt: Date;
}

export interface Membership {
  readonly familyId: string;
  readonly userId: string;
  readonly role: Role;
  readonly joinedAt: Date;
}

export interface Invite {
  readonly id: string;
  readonly familyId: string;
  readonly role: Role;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly usedBy: string | null;
  readonly usedAt: Date | null;
  readonly cancelledAt: Date | null;
}

export interface OpeningPotEntry {
  readonly id: string;
  readonly familyId: string;
  readonly kind: 'opening';
  readonly amountMinor: number;
  readonly entryDate: IsoDate;
  readonly period: Period;
  readonly createdBy: string;
}

export interface CreateFamilyCommand {
  /** The signed-in user; not yet a member of any family, so not an Actor. */
  readonly actorUserId: string;
  readonly name: string;
  readonly currencyCode: string;
  readonly timeZone: string;
  readonly countryCode?: string | null;
  readonly openingPotMinor: number;
  /** Computed by the app from SIGNUP_MODE / ALLOWED_SIGNUP_EMAILS. */
  readonly signupAllowed: boolean;
}

export interface CreateInviteCommand {
  readonly actor: import('../shared').Actor;
  readonly role: Role;
}

export interface CreatedInvite {
  readonly invite: Invite;
  /** Shown once (in the join link); only its hash is stored. */
  readonly token: string;
}

export interface AcceptInviteCommand {
  readonly userId: string;
  readonly token: string;
}

export interface GetFamilyCommand {
  readonly actor: Actor;
}

export interface FamilyView {
  readonly family: Family;
  readonly role: Role;
}

export interface ResolveActorCommand {
  readonly userId: string;
}

/** Number formatting follows the family's country, with en-IN for INR when no country is given. */
export function numberLocaleFor(currencyCode: string, countryCode: string | null): string {
  if (countryCode) return `en-${countryCode}`;
  return currencyCode === 'INR' ? 'en-IN' : 'en';
}

export function inviteUsable(invite: Invite, now: Date): boolean {
  return invite.usedAt === null && invite.cancelledAt === null && invite.expiresAt > now;
}

export interface UpdateFamilySettingsCommand {
  readonly actor: Actor;
  readonly name?: string;
  /** Spending-alert levels in percent, e.g. [80, 100]. */
  readonly alertThresholds?: readonly number[];
}

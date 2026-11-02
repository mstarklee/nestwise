import type { ActivityGateway, Role } from '../shared';
import type { Family, Invite, Membership, OpeningPotEntry } from './models';

export interface FamilyGateway {
  save(family: Family): Promise<Family>;
  findById(familyId: string): Promise<Family | undefined>;
}

export interface MembershipGateway {
  /** The user's live membership (not removed), if any. */
  findActive(userId: string): Promise<{ familyId: string; role: Role } | undefined>;
  save(membership: Membership): Promise<Membership>;
}

export interface InviteGateway {
  /** Stores the invite with only a hash of `token`. */
  create(invite: Invite, token: string): Promise<Invite>;
  findByToken(token: string): Promise<Invite | undefined>;
  /** Marks a still-unused invite used; false if someone used it first (the adapter's guard against a race). */
  markUsed(inviteId: string, userId: string, at: Date): Promise<boolean>;
}

export interface OpeningPotGateway {
  record(entry: OpeningPotEntry): Promise<void>;
}

export interface FamilyGateways {
  readonly families: FamilyGateway;
  readonly memberships: MembershipGateway;
  readonly invites: InviteGateway;
  readonly openingPot: OpeningPotGateway;
  readonly activity: ActivityGateway;
}

/** Writes that must succeed or fail together (family + admin membership + opening pot; invite use + membership). */
export interface FamilyUnitOfWork {
  run<T>(work: (gateways: FamilyGateways) => Promise<T>): Promise<T>;
}

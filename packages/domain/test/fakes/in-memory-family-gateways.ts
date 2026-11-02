import type {
  Family,
  FamilyGateway,
  FamilyGateways,
  FamilyUnitOfWork,
  Invite,
  InviteGateway,
  Membership,
  MembershipGateway,
  OpeningPotEntry,
  OpeningPotGateway,
} from '../../src/family';
import type { ActivityEvent, ActivityGateway, Role } from '../../src/shared';
import { InMemoryActivityGateway } from './in-memory-activity-gateway';

export class InMemoryFamilyGateway implements FamilyGateway {
  rows = new Map<string, Family>();
  async save(family: Family) {
    this.rows.set(family.id, family);
    return family;
  }
  async findById(familyId: string) {
    return this.rows.get(familyId);
  }
  all() {
    return [...this.rows.values()];
  }
}

export class InMemoryMembershipGateway implements MembershipGateway {
  rows: (Membership & { removedAt: Date | null })[] = [];
  async findActive(userId: string): Promise<{ familyId: string; role: Role } | undefined> {
    const row = this.rows.find((m) => m.userId === userId && m.removedAt === null);
    return row ? { familyId: row.familyId, role: row.role } : undefined;
  }
  async save(membership: Membership) {
    this.rows.push({ ...membership, removedAt: null });
    return membership;
  }
  remove(userId: string, at: Date) {
    this.rows = this.rows.map((m) => (m.userId === userId ? { ...m, removedAt: at } : m));
  }
  all(): Membership[] {
    return this.rows.map(({ familyId, userId, role }) => ({ familyId, userId, role }) as Membership);
  }
}

export class InMemoryInviteGateway implements InviteGateway {
  rows = new Map<string, Invite>(); // keyed by token (the real adapter keys by its hash)
  async create(invite: Invite, token: string) {
    this.rows.set(token, invite);
    return invite;
  }
  async findByToken(token: string) {
    return this.rows.get(token);
  }
  async markUsed(inviteId: string, userId: string, at: Date) {
    for (const [token, invite] of this.rows) {
      if (invite.id === inviteId) {
        if (invite.usedAt !== null) return false;
        this.rows.set(token, { ...invite, usedBy: userId, usedAt: at });
        return true;
      }
    }
    return false;
  }
  set(token: string, invite: Invite) {
    this.rows.set(token, invite);
  }
  all() {
    return [...this.rows.values()];
  }
}

export class InMemoryOpeningPotGateway implements OpeningPotGateway {
  rows: OpeningPotEntry[] = [];
  async record(entry: OpeningPotEntry) {
    this.rows.push(entry);
  }
  all() {
    return [...this.rows];
  }
}

class FailingActivityGateway implements ActivityGateway {
  constructor(
    private readonly inner: InMemoryActivityGateway,
    private readonly shouldFail: () => boolean,
  ) {}
  async record(event: ActivityEvent) {
    if (this.shouldFail()) throw new Error('activity write failed');
    await this.inner.record(event);
  }
}

/** Runs work against the in-memory gateways; restores a snapshot if the work throws, so tests can prove "nothing saved". */
export class InMemoryFamilyUnitOfWork implements FamilyUnitOfWork {
  readonly families = new InMemoryFamilyGateway();
  readonly memberships = new InMemoryMembershipGateway();
  readonly invites = new InMemoryInviteGateway();
  readonly openingPot = new InMemoryOpeningPotGateway();
  readonly activity = new InMemoryActivityGateway();
  failActivity = false;

  async run<T>(work: (gateways: FamilyGateways) => Promise<T>): Promise<T> {
    const snapshot = {
      families: new Map(this.families.rows),
      memberships: [...this.memberships.rows],
      invites: new Map(this.invites.rows),
      openingPot: [...this.openingPot.rows],
      activity: this.activity.snapshot(),
    };
    try {
      return await work({
        families: this.families,
        memberships: this.memberships,
        invites: this.invites,
        openingPot: this.openingPot,
        activity: new FailingActivityGateway(this.activity, () => this.failActivity),
      });
    } catch (error) {
      this.families.rows = snapshot.families;
      this.memberships.rows = snapshot.memberships;
      this.invites.rows = snapshot.invites;
      this.openingPot.rows = snapshot.openingPot;
      this.activity.restore(snapshot.activity);
      throw error;
    }
  }
}

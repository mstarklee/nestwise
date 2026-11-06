import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { CreateFamilyUseCase, type Invite } from '@nestwise/domain/family';
import { describe, expect, it } from 'vitest';
import { DrizzleUserGateway } from '@/adapters/auth/drizzle-user-gateway';
import { DrizzleFamilyGateway } from '@/adapters/family/drizzle-family-gateway';
import { DrizzleFamilyUnitOfWork } from '@/adapters/family/drizzle-family-unit-of-work';
import { DrizzleInviteGateway } from '@/adapters/family/drizzle-invite-gateway';
import { DrizzleMembershipGateway } from '@/adapters/family/drizzle-membership-gateway';
import { useTestDb } from '../../setup';

const db = useTestDb();

const U1 = '00000000-0000-4000-8000-000000000001';
const U2 = '00000000-0000-4000-8000-000000000002';
let next = 0;
const ids = { next: () => `10000000-0000-4000-8000-${String(++next).padStart(12, '0')}` };
const clock = { now: () => new Date('2026-10-31T19:00:00Z') };

async function addUser(id: string, email: string) {
  await new DrizzleUserGateway(db()).save({ id, email, passwordHash: 'x', emailVerifiedAt: null, googleSubject: null, createdAt: clock.now() });
}

const createFamily = () =>
  new CreateFamilyUseCase(new DrizzleFamilyUnitOfWork(db()), new DrizzleMembershipGateway(db()), ids, clock);

const command = { actorUserId: U1, name: 'Our Family', currencyCode: 'INR', timeZone: 'Asia/Kolkata', openingPotMinor: 5_000_000, signupAllowed: true };

describe('family adapters', () => {
  it('creates family, admin membership, opening pot entry and activity row in one transaction', async () => {
    await addUser(U1, 'priya@example.com');
    const family = await createFamily().execute(command);

    expect(await new DrizzleFamilyGateway(db()).findById(family.id)).toEqual(family);
    expect(await new DrizzleMembershipGateway(db()).findActive(U1)).toEqual({ familyId: family.id, role: 'admin' });
    const { rows: pot } = await db().execute<{ kind: string; amount_minor: string; entry_date: string; period_month: number }>(
      sql`select kind, amount_minor, entry_date::text as entry_date, period_month from app.pot_entries`,
    );
    expect(pot).toEqual([{ kind: 'opening', amount_minor: '5000000', entry_date: '2026-11-01', period_month: 11 }]);
    const { rows: activity } = await db().execute<{ action: string }>(sql`select action from app.activity`);
    expect(activity).toEqual([{ action: 'family.created' }]);
  });

  it('leaves nothing behind when a later write in the transaction fails', async () => {
    // U1 has no users row, so the membership insert hits the foreign key after the family row was written.
    await expect(createFamily().execute(command)).rejects.toThrow();
    const { rows } = await db().execute(sql`select 1 from app.families union all select 1 from app.pot_entries`);
    expect(rows).toHaveLength(0);
  });

  it('findActive returns only that user’s live membership', async () => {
    await addUser(U1, 'priya@example.com');
    await addUser(U2, 'arun@example.com');
    const family = await createFamily().execute(command);
    const memberships = new DrizzleMembershipGateway(db());
    expect(await memberships.findActive(U2)).toBeUndefined();
    await db().execute(sql`update app.members set removed_at = now() where user_id = ${U1}`);
    expect(await memberships.findActive(U1)).toBeUndefined();
    expect(family.id).toBeTruthy();
  });

  it('stores only a hash of the invite token, and lets an invite be used once even when two accept at once', async () => {
    await addUser(U1, 'priya@example.com');
    const family = await createFamily().execute(command);
    const invites = new DrizzleInviteGateway(db());
    const invite: Invite = {
      id: ids.next(),
      familyId: family.id,
      role: 'admin',
      createdBy: U1,
      createdAt: clock.now(),
      expiresAt: new Date('2026-11-07T19:00:00Z'),
      usedBy: null,
      usedAt: null,
      cancelledAt: null,
    };
    await invites.create(invite, 'secret-token');
    const { rows } = await db().execute<{ token_hash: string }>(sql`select token_hash from app.invites`);
    expect(rows).toEqual([{ token_hash: createHash('sha256').update('secret-token').digest('hex') }]);
    expect(await invites.findByToken('secret-token')).toEqual(invite);
    expect(await invites.findByToken('other')).toBeUndefined();

    await addUser(U2, 'arun@example.com');
    const results = await Promise.all([invites.markUsed(invite.id, U2, clock.now()), invites.markUsed(invite.id, U2, clock.now())]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await invites.findByToken('secret-token'))?.usedBy).toBe(U2);
  });
});

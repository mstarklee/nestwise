import { beforeEach, describe, expect, it } from 'vitest';
import {
  AcceptInviteUseCase,
  AlreadyInFamilyError,
  type CreateFamilyCommand,
  CreateFamilyUseCase,
  CreateInviteUseCase,
  InvalidFamilyCommandError,
  type Invite,
  InviteNotFoundError,
  InviteNotUsableError,
  NotAMemberError,
  ResolveActorUseCase,
  SignupClosedError,
} from '../../src/family';
import { type Actor, NotAllowedError } from '../../src/shared';
import { FixedClock } from '../fakes/fixed-clock';
import { InMemoryFamilyUnitOfWork } from '../fakes/in-memory-family-gateways';
import { SequentialIds } from '../fakes/sequential-ids';

let uow: InMemoryFamilyUnitOfWork;
let clock: FixedClock;
let ids: SequentialIds;
let createFamily: CreateFamilyUseCase;
let createInvite: CreateInviteUseCase;
let acceptInvite: AcceptInviteUseCase;
let resolveActor: ResolveActorUseCase;

beforeEach(() => {
  uow = new InMemoryFamilyUnitOfWork();
  clock = new FixedClock('2026-10-31T19:00:00Z'); // 00:30 on 1 Nov in India
  ids = new SequentialIds();
  createFamily = new CreateFamilyUseCase(uow, uow.memberships, ids, clock);
  createInvite = new CreateInviteUseCase(uow.invites, ids, clock);
  acceptInvite = new AcceptInviteUseCase(uow, uow.invites, uow.memberships, clock);
  resolveActor = new ResolveActorUseCase(uow.memberships);
});

const command = (overrides: Partial<CreateFamilyCommand> = {}): CreateFamilyCommand => ({
  actorUserId: 'u1',
  name: '  Our Family ',
  currencyCode: 'INR',
  timeZone: 'Asia/Kolkata',
  openingPotMinor: 0,
  signupAllowed: true,
  ...overrides,
});

const nothingSaved = () => {
  expect(uow.families.all()).toHaveLength(0);
  expect(uow.memberships.all()).toHaveLength(0);
  expect(uow.openingPot.all()).toHaveLength(0);
  expect(uow.activity.count()).toBe(0);
};

describe('CreateFamilyUseCase', () => {
  it('creates the family with the creator as admin, an opening pot entry and an activity row', async () => {
    const family = await createFamily.execute(command({ openingPotMinor: 5_000_000 }));
    expect(family).toEqual({
      id: 'id-1',
      name: 'Our Family',
      currencyCode: 'INR',
      minorUnit: 2,
      numberLocale: 'en-IN',
      timeZone: 'Asia/Kolkata',
      countryCode: null,
      setAsideOverrideMinor: null,
      alertThresholds: [80, 100],
      createdBy: 'u1',
      createdAt: clock.now(),
    });
    expect(uow.memberships.all()).toEqual([{ userId: 'u1', familyId: 'id-1', role: 'admin' }]);
    expect(uow.openingPot.all()).toEqual([
      {
        id: 'id-2',
        familyId: 'id-1',
        kind: 'opening',
        amountMinor: 5_000_000,
        entryDate: '2026-11-01', // the family's date, not UTC's 31 Oct
        period: { year: 2026, month: 11 },
        createdBy: 'u1',
      },
    ]);
    expect(uow.activity.all()).toMatchObject([{ familyId: 'id-1', actorId: 'u1', action: 'family.created', entityId: 'id-1' }]);
  });

  it('allows an opening balance of 0 and keeps a country code', async () => {
    const family = await createFamily.execute(command({ countryCode: 'IN' }));
    expect(family.countryCode).toBe('IN');
    expect(uow.openingPot.all()[0]).toMatchObject({ kind: 'opening', amountMinor: 0 });
  });

  it('locks minorUnit from ISO 4217 (JPY 0, KWD 3, INR 2) and picks a number locale', async () => {
    const jpy = await createFamily.execute(command({ actorUserId: 'a', currencyCode: 'JPY', timeZone: 'Asia/Tokyo', countryCode: 'JP' }));
    const kwd = await createFamily.execute(command({ actorUserId: 'b', currencyCode: 'KWD', timeZone: 'Asia/Kuwait' }));
    const inr = await createFamily.execute(command({ actorUserId: 'c' }));
    expect([jpy.minorUnit, kwd.minorUnit, inr.minorUnit]).toEqual([0, 3, 2]);
    expect([jpy.numberLocale, kwd.numberLocale]).toEqual(['en-JP', 'en']);
  });

  it('refuses an unknown currency, a bad time zone, a bad name, country or opening balance — and saves nothing', async () => {
    const bad: Partial<CreateFamilyCommand>[] = [
      { currencyCode: 'XYZ' },
      { currencyCode: 'inr' },
      { timeZone: 'Mars/Olympus' },
      { name: '   ' },
      { name: 'ந'.repeat(81) },
      { countryCode: 'India' },
      { openingPotMinor: -1 },
      { openingPotMinor: 10.5 },
    ];
    for (const overrides of bad) {
      await expect(createFamily.execute(command(overrides)), JSON.stringify(overrides)).rejects.toBeInstanceOf(
        InvalidFamilyCommandError,
      );
    }
    nothingSaved();
  });

  it('accepts a name of 80 characters in any language', async () => {
    const family = await createFamily.execute(command({ name: 'ந'.repeat(80) }));
    expect([...family.name]).toHaveLength(80);
  });

  it('refuses when signup is not allowed, and saves nothing', async () => {
    await expect(createFamily.execute(command({ signupAllowed: false }))).rejects.toBeInstanceOf(SignupClosedError);
    nothingSaved();
  });

  it('refuses a second family for someone already in one', async () => {
    await createFamily.execute(command());
    await expect(createFamily.execute(command())).rejects.toBeInstanceOf(AlreadyInFamilyError);
    expect(uow.families.all()).toHaveLength(1);
  });

  it('saves nothing when the activity row cannot be written', async () => {
    uow.failActivity = true;
    await expect(createFamily.execute(command())).rejects.toThrow('activity write failed');
    nothingSaved();
  });
});

describe('invites', () => {
  let admin: Actor;

  beforeEach(async () => {
    const family = await createFamily.execute(command());
    admin = { userId: 'u1', familyId: family.id, role: 'admin' };
  });

  it('an admin creates an invite that expires in 7 days; the token is returned once', async () => {
    const { invite, token } = await createInvite.execute({ actor: admin, role: 'admin' });
    expect(token).toBe('id-3');
    expect(invite).toEqual({
      id: 'id-4',
      familyId: admin.familyId,
      role: 'admin',
      createdBy: 'u1',
      createdAt: clock.now(),
      expiresAt: new Date('2026-11-07T19:00:00Z'),
      usedBy: null,
      usedAt: null,
      cancelledAt: null,
    });
  });

  it('a member cannot invite; an unknown role is refused', async () => {
    await expect(createInvite.execute({ actor: { ...admin, role: 'member' }, role: 'member' })).rejects.toBeInstanceOf(
      NotAllowedError,
    );
    await expect(createInvite.execute({ actor: admin, role: 'owner' as never })).rejects.toBeInstanceOf(
      InvalidFamilyCommandError,
    );
    expect(uow.invites.all()).toHaveLength(0);
  });

  it('accepts an invite once: the spouse joins with the invite role; a second accept throws InviteNotUsableError', async () => {
    const { token } = await createInvite.execute({ actor: admin, role: 'admin' });
    const membership = await acceptInvite.execute({ userId: 'u2', token });
    expect(membership).toEqual({ familyId: admin.familyId, userId: 'u2', role: 'admin', joinedAt: clock.now() });
    expect(await resolveActor.execute({ userId: 'u2' })).toEqual({ userId: 'u2', familyId: admin.familyId, role: 'admin' });
    await expect(acceptInvite.execute({ userId: 'u3', token })).rejects.toBeInstanceOf(InviteNotUsableError);
    expect(uow.memberships.all()).toHaveLength(2);
  });

  it('refuses an expired or cancelled invite, an unknown token, and someone already in a family', async () => {
    const { invite, token } = await createInvite.execute({ actor: admin, role: 'member' });
    await expect(acceptInvite.execute({ userId: 'u2', token: 'made-up' })).rejects.toBeInstanceOf(InviteNotFoundError);
    await expect(acceptInvite.execute({ userId: 'u1', token })).rejects.toBeInstanceOf(AlreadyInFamilyError);

    uow.invites.set(token, { ...invite, cancelledAt: clock.now() } satisfies Invite);
    await expect(acceptInvite.execute({ userId: 'u2', token })).rejects.toBeInstanceOf(InviteNotUsableError);

    uow.invites.set(token, invite);
    clock.set('2026-11-07T19:00:00Z');
    await expect(acceptInvite.execute({ userId: 'u2', token })).rejects.toBeInstanceOf(InviteNotUsableError);
    expect(uow.memberships.all()).toHaveLength(1);
  });
});

describe('ResolveActorUseCase', () => {
  it('resolves a member to an Actor, and refuses a removed member or a stranger', async () => {
    const family = await createFamily.execute(command());
    expect(await resolveActor.execute({ userId: 'u1' })).toEqual({ userId: 'u1', familyId: family.id, role: 'admin' });
    await expect(resolveActor.execute({ userId: 'stranger' })).rejects.toBeInstanceOf(NotAMemberError);
    uow.memberships.remove('u1', clock.now());
    await expect(resolveActor.execute({ userId: 'u1' })).rejects.toBeInstanceOf(NotAMemberError);
  });
});

import { randomUUID } from 'node:crypto';
import type { Db } from '@nestwise/db';
import type { Actor } from '@nestwise/domain/shared';
import { importPlan } from '../../../../../scripts/import-plan';
import { DrizzleUserGateway } from '@/adapters/auth/drizzle-user-gateway';
import { DrizzlePlanGateway } from '@/adapters/plan/drizzle-plan-gateway';
import { makeCreateFamilyUseCase } from '@/composition/family';

/** A user, a family (INR, Asia/Kolkata) with the sample plan imported, and a seedKey → itemId lookup. */
export async function familyWithPlan(db: Db, email = `${randomUUID()}@example.com`) {
  const userId = randomUUID();
  await new DrizzleUserGateway(db).save({ id: userId, email, passwordHash: 'x', emailVerifiedAt: null, googleSubject: null, createdAt: new Date() });
  const family = await makeCreateFamilyUseCase(db).execute({
    actorUserId: userId,
    name: 'Family',
    currencyCode: 'INR',
    timeZone: 'Asia/Kolkata',
    openingPotMinor: 0,
    signupAllowed: true,
  });
  await importPlan({ db, familyId: family.id });
  const items = await new DrizzlePlanGateway(db).listItems(family.id, { includeArchived: true });
  const itemId = (seedKey: string) => items.find((i) => i.seedKey === seedKey)!.id;
  const actor: Actor = { userId, familyId: family.id, role: 'admin' };
  return { userId, familyId: family.id, actor, itemId };
}

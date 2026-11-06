/**
 * Loads the FICTIONAL sample family (fixtures/sample-family.ts: the plan plus October 2026's 36 expenses and two yearly
 * payments) into a LOCAL development database, so the screens have something to show.
 *
 *   pnpm seed:dev              the plan and October 2026
 *   pnpm seed:dev --showcase   also fictional spending in the current month, so every screen case shows
 *
 * It never runs against production, never uses DATABASE_URL (the hosted database), and only accepts a DB_HOST on this
 * computer. Sign in afterwards as dev@example.com with the password in DEV_PASSWORD below (a local test value).
 */
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createDb, databaseUrl, type Db } from '@nestwise/db';
import { EmailAlreadyRegisteredError } from '@nestwise/domain/auth';
import type { Actor, IsoDate } from '@nestwise/domain/shared';
import { todayIn } from '@nestwise/domain/shared';
import { sampleFamily, showcaseRows } from '../fixtures/sample-family';
import { DrizzleFamilyGateway } from '../apps/web/src/adapters/family/drizzle-family-gateway';
import { systemClock } from '../apps/web/src/adapters/shared/system-clock';
import { DrizzlePlanGateway } from '../apps/web/src/adapters/plan/drizzle-plan-gateway';
import { DrizzleUserGateway } from '../apps/web/src/adapters/auth/drizzle-user-gateway';
import { makeSignUpUseCase, noAccountEmails } from '../apps/web/src/composition/auth';
import { makeRecordExpenseUseCase } from '../apps/web/src/composition/expenses';
import { makeCreateFamilyUseCase } from '../apps/web/src/composition/family';
import { makeApplyFirstYearCheckUseCase, makeEnsureYearPlanUseCase } from '../apps/web/src/composition/year-plan';
import { importPlan } from './import-plan';

type Env = Readonly<Record<string, string | undefined>>;

const DEV_EMAIL = 'dev@example.com';
const DEV_PASSWORD = 'nestwise-dev-password';
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1'];
const SETUP = { year: 2026, month: 10 };
/** Still to come in 2026 when the sample family starts in October: the dated bills from October on, and Deepavali. */
const STILL_TO_COME = ['car_ins', 'school_t2', 'bike_ins', 'deepavali', 'diwali_dress'];

export interface SeedOptions {
  /** Also load fictional rows in the current month so every screen case shows (design stage). */
  readonly showcase?: boolean;
}

export async function runSeedDev(env: Env, injectedDb?: Db, options: SeedOptions = {}): Promise<{ actor: Actor; familyId: string }> {
  if (env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed production: seed:dev loads fictional data');
  }
  if (!env.DB_HOST) throw new Error('seed:dev uses the DB_* database (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD), never DATABASE_URL');
  if (!LOCAL_HOSTS.includes(env.DB_HOST)) throw new Error('seed:dev only runs against a database on this computer (DB_HOST=localhost)');

  const db = injectedDb ?? createDb(databaseUrl({ ...env, DATABASE_URL: undefined }), { max: 2 });
  try {
    let userId: string;
    try {
      // Fictional account: no email is sent, and it counts as verified so you can sign in straight away.
      userId = (await makeSignUpUseCase(noAccountEmails, db).execute({ email: DEV_EMAIL, password: DEV_PASSWORD })).user.id;
      const users = new DrizzleUserGateway(db);
      const created = (await users.findById(userId))!;
      await users.update({ ...created, emailVerifiedAt: created.createdAt });
    } catch (error) {
      if (error instanceof EmailAlreadyRegisteredError) throw new Error('This database is already seeded; empty it first', { cause: error });
      throw error;
    }
    const family = await makeCreateFamilyUseCase(db).execute({
      actorUserId: userId,
      name: sampleFamily.name,
      currencyCode: sampleFamily.currencyCode,
      timeZone: sampleFamily.timeZone,
      countryCode: 'IN',
      openingPotMinor: 0,
      signupAllowed: true,
    });
    const actor: Actor = { userId, familyId: family.id, role: 'admin' };
    await importPlan({ db, familyId: family.id });
    const items = await new DrizzlePlanGateway(db).listItems(family.id, { includeArchived: true });
    const itemId = (key: string) => {
      const item = items.find((i) => i.seedKey === key);
      if (!item) throw new Error(`The sample plan has no item ${key}`);
      return item.id;
    };

    const plan = await makeEnsureYearPlanUseCase(db).execute({ familyId: family.id, year: SETUP.year });
    const ticked = plan.lines.filter((l) => STILL_TO_COME.some((key) => itemId(key) === l.itemId)).map((l) => l.id);
    await makeApplyFirstYearCheckUseCase(db).execute({ actor, year: SETUP.year, stillToComeLineIds: ticked, setupPeriod: SETUP });

    const record = makeRecordExpenseUseCase(db);
    for (const t of sampleFamily.october2026Transactions) {
      await record.execute({
        actor,
        id: randomUUID(),
        amountMinor: t.amountMinor,
        txnDate: t.date as IsoDate,
        merchant: t.description,
        allocations: [{ itemId: itemId(t.itemKey), amountMinor: t.amountMinor }],
      });
    }
    for (const p of sampleFamily.october2026YearlyPayments) {
      await record.execute({
        actor,
        id: randomUUID(),
        amountMinor: p.amountMinor,
        txnDate: p.date as IsoDate,
        allocations: [{ itemId: itemId(p.itemKey), amountMinor: p.amountMinor }],
      });
    }

    if (options.showcase) {
      // FICTIONAL: spending in the current month, a part-paid bike insurance, and a set-aside too small for June 2027.
      const today = todayIn(sampleFamily.timeZone, systemClock.now());
      for (const row of showcaseRows(today)) {
        await record.execute({
          actor,
          id: randomUUID(),
          amountMinor: row.amountMinor,
          txnDate: row.date,
          merchant: row.merchant,
          allocations: [{ itemId: itemId(row.itemKey), amountMinor: row.amountMinor }],
        });
      }
      await record.execute({
        actor,
        id: randomUUID(),
        amountMinor: 50_000,
        txnDate: today,
        merchant: 'FICTIONAL Insurance Agent',
        allocations: [{ itemId: itemId('bike_ins'), amountMinor: 50_000 }],
      });
      const families = new DrizzleFamilyGateway(db);
      const saved = await families.findById(family.id);
      if (saved) await families.save({ ...saved, setAsideOverrideMinor: 2_000_000 });
    }
    return { actor, familyId: family.id };
  } finally {
    if (!injectedDb) await db.$client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSeedDev(process.env, undefined, { showcase: process.argv.includes('--showcase') })
    .then(({ familyId }) => console.log(`Seeded the fictional sample family (${familyId}). Sign in as ${DEV_EMAIL}.`))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}

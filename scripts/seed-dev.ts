/**
 * Loads the FICTIONAL sample family (fixtures/sample-family.ts: the plan plus October 2026's 36 expenses and two yearly
 * payments) into a LOCAL development database, so the screens have something to show.
 *
 *   pnpm seed:dev
 *
 * It never runs against production, never uses DATABASE_URL (the hosted database), and only accepts a DB_HOST on this
 * computer. Sign in afterwards as dev@example.com with the password in DEV_PASSWORD below (a local test value).
 */
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createDb, databaseUrl, type Db } from '@nestwise/db';
import { EmailAlreadyRegisteredError } from '@nestwise/domain/auth';
import type { Actor, IsoDate } from '@nestwise/domain/shared';
import { sampleFamily } from '../fixtures/sample-family';
import { DrizzlePlanGateway } from '../apps/web/src/adapters/plan/drizzle-plan-gateway';
import { makeSignUpUseCase } from '../apps/web/src/composition/auth';
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

export async function runSeedDev(env: Env, injectedDb?: Db): Promise<{ actor: Actor; familyId: string }> {
  if (env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed production: seed:dev loads fictional data');
  }
  if (!env.DB_HOST) throw new Error('seed:dev uses the DB_* database (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD), never DATABASE_URL');
  if (!LOCAL_HOSTS.includes(env.DB_HOST)) throw new Error('seed:dev only runs against a database on this computer (DB_HOST=localhost)');

  const db = injectedDb ?? createDb(databaseUrl({ ...env, DATABASE_URL: undefined }), { max: 2 });
  try {
    let userId: string;
    try {
      userId = (await makeSignUpUseCase(db).execute({ email: DEV_EMAIL, password: DEV_PASSWORD })).user.id;
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
    return { actor, familyId: family.id };
  } finally {
    if (!injectedDb) await db.$client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runSeedDev(process.env)
    .then(({ familyId }) => console.log(`Seeded the fictional sample family (${familyId}). Sign in as ${DEV_EMAIL}.`))
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}

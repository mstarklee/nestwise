/**
 * Loads the family's plan (groups, items, template amounts — NO transactions) into one family, once.
 *
 *   pnpm import-plan --family <family-id>
 *
 * Uses DATABASE_URL (or the DB_* parts) from .env.local. Runs the ImportPlanUseCase as the family's first admin, so
 * every rule applies (it refuses a family that already has a plan).
 */
import { createDb, databaseUrl, type Db, members } from '@nestwise/db';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { samplePlanImport } from '../fixtures/sample-plan-import';
import { makeImportPlanUseCase } from '../apps/web/src/composition/plan';

export async function importPlan({ db, familyId }: { db: Db; familyId: string }) {
  const [admin] = await db
    .select({ userId: members.userId })
    .from(members)
    .where(and(eq(members.familyId, familyId), eq(members.role, 'admin'), isNull(members.removedAt)))
    .orderBy(asc(members.joinedAt))
    .limit(1);
  if (!admin) throw new Error(`No admin found for family ${familyId}`);
  return makeImportPlanUseCase(db).execute({
    actor: { userId: admin.userId, familyId, role: 'admin' },
    plan: samplePlanImport,
  });
}

async function main() {
  const index = process.argv.indexOf('--family');
  const familyId = index > 0 ? process.argv[index + 1] : undefined;
  if (!familyId) {
    console.error('Usage: pnpm import-plan --family <family-id>');
    process.exit(1);
  }
  const db = createDb(databaseUrl());
  try {
    const result = await importPlan({ db, familyId });
    console.log(`Imported ${result.groups} groups and ${result.items} items.`);
  } finally {
    await db.$client.end();
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/import-plan.ts')) {
  void main();
}

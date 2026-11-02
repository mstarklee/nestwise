import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Db, DbOrTx } from '../src/client';
import { getTestDb, truncateApp } from '../src/testing';

let db: Db;

beforeAll(async () => {
  db = await getTestDb();
});
beforeEach(async () => {
  await truncateApp(db);
});
afterAll(async () => {
  await db.$client.end();
});

const USER = '00000000-0000-4000-8000-000000000001';

async function insertFamily(x: DbOrTx, f: { currencyCode: string; minorUnit: number }): Promise<string> {
  const id = randomUUID();
  await x.execute(sql`insert into app.families (id, name, currency_code, minor_unit, number_locale, timezone, created_by)
    values (${id}, 'Test family', ${f.currencyCode}, ${f.minorUnit}, 'en-IN', 'Asia/Kolkata', ${USER})`);
  return id;
}

async function insertItem(x: DbOrTx, familyId: string, kind = 'monthly'): Promise<string> {
  const groupId = randomUUID();
  const itemId = randomUUID();
  await x.execute(sql`insert into app.groups (id, family_id, kind, name, sort) values (${groupId}, ${familyId}, ${kind}, 'G', 0)`);
  await x.execute(sql`insert into app.items (id, family_id, group_id, kind, name, sort) values (${itemId}, ${familyId}, ${groupId}, ${kind}, 'I', 0)`);
  return itemId;
}

async function insertTransaction(x: DbOrTx, familyId: string, t: { id?: string; amountMinor: number; txnDate?: string }): Promise<string> {
  const id = t.id ?? randomUUID();
  await x.execute(sql`insert into app.transactions
      (id, family_id, kind, amount_minor, currency_code, txn_date, entered_by, capture_method, status, entry_tz)
    values (${id}, ${familyId}, 'expense', ${t.amountMinor}, 'INR', ${t.txnDate ?? '2026-10-31'}, ${USER}, 'typed', 'confirmed', 'Asia/Kolkata')`);
  return id;
}

async function insertAllocation(x: DbOrTx, familyId: string, a: { transactionId: string; itemId: string; amountMinor: number }) {
  await x.execute(sql`insert into app.allocations (id, transaction_id, family_id, item_id, amount_minor)
    values (${randomUUID()}, ${a.transactionId}, ${familyId}, ${a.itemId}, ${a.amountMinor})`);
}

async function insertDeposit(x: DbOrTx, familyId: string, p: { year: number; month: number; deleted?: boolean }) {
  await x.execute(sql`insert into app.pot_entries (id, family_id, kind, amount_minor, entry_date, period_year, period_month, created_by, deleted_at)
    values (${randomUUID()}, ${familyId}, 'deposit', 3691666, '2026-11-01', ${p.year}, ${p.month}, ${USER}, ${p.deleted ? new Date().toISOString() : null})`);
}

describe('database guards', () => {
  it('rejects changing a family currency or minor unit', async () => {
    const id = await insertFamily(db, { currencyCode: 'INR', minorUnit: 2 });
    await expect(db.execute(sql`update app.families set currency_code = 'USD' where id = ${id}`)).rejects.toThrow();
    await expect(db.execute(sql`update app.families set minor_unit = 3 where id = ${id}`)).rejects.toThrow();
    await expect(db.execute(sql`update app.families set name = 'Renamed' where id = ${id}`)).resolves.toBeDefined();
  });

  it('rejects a transaction whose allocations do not add up, at commit', async () => {
    const familyId = await insertFamily(db, { currencyCode: 'INR', minorUnit: 2 });
    const itemId = await insertItem(db, familyId);
    await expect(
      db.transaction(async (tx) => {
        const transactionId = await insertTransaction(tx, familyId, { amountMinor: 1000 });
        await insertAllocation(tx, familyId, { transactionId, itemId, amountMinor: 900 });
      }),
    ).rejects.toThrow();
    const { rows } = await db.execute(sql`select 1 from app.transactions`);
    expect(rows).toHaveLength(0);
  });

  it('accepts a split whose allocations add up, and rejects a transaction with none', async () => {
    const familyId = await insertFamily(db, { currencyCode: 'INR', minorUnit: 2 });
    const groceries = await insertItem(db, familyId);
    const soaps = await insertItem(db, familyId);
    await db.transaction(async (tx) => {
      const transactionId = await insertTransaction(tx, familyId, { amountMinor: 94_500 });
      await insertAllocation(tx, familyId, { transactionId, itemId: groceries, amountMinor: 80_000 });
      await insertAllocation(tx, familyId, { transactionId, itemId: soaps, amountMinor: 14_500 });
    });
    await expect(db.transaction(async (tx) => void (await insertTransaction(tx, familyId, { amountMinor: 500 })))).rejects.toThrow();
  });

  it('derives the period from txn_date', async () => {
    const familyId = await insertFamily(db, { currencyCode: 'INR', minorUnit: 2 });
    const itemId = await insertItem(db, familyId);
    const transactionId = await db.transaction(async (tx) => {
      const id = await insertTransaction(tx, familyId, { amountMinor: 100, txnDate: '2026-11-01' });
      await insertAllocation(tx, familyId, { transactionId: id, itemId, amountMinor: 100 });
      return id;
    });
    const {
      rows: [row],
    } = await db.execute<{ period_year: number; period_month: number }>(
      sql`select period_year, period_month from app.transactions where id = ${transactionId}`,
    );
    expect(row).toEqual({ period_year: 2026, period_month: 11 });
  });

  it('allows only one live pot deposit per family-month', async () => {
    const familyId = await insertFamily(db, { currencyCode: 'INR', minorUnit: 2 });
    await insertDeposit(db, familyId, { year: 2026, month: 10, deleted: true });
    await insertDeposit(db, familyId, { year: 2026, month: 11 });
    await expect(insertDeposit(db, familyId, { year: 2026, month: 11 })).rejects.toMatchObject({ cause: { code: '23505' } });
    await expect(insertDeposit(db, familyId, { year: 2026, month: 10 })).resolves.toBeUndefined();
  });

  it('app role cannot update or delete activity rows, but can insert and read them', async () => {
    const familyId = await insertFamily(db, { currencyCode: 'INR', minorUnit: 2 });
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local role nestwise_app`);
      await tx.execute(sql`insert into app.activity (family_id, actor_id, action, entity_type, entity_id, at)
        values (${familyId}, ${USER}, 'create', 'family', ${familyId}, now())`);
      const { rows } = await tx.execute(sql`select 1 from app.activity`);
      expect(rows).toHaveLength(1);
    });
    for (const statement of [sql`update app.activity set action = 'x'`, sql`delete from app.activity`]) {
      await expect(
        db.transaction(async (tx) => {
          await tx.execute(sql`set local role nestwise_app`);
          await tx.execute(statement);
        }),
      ).rejects.toMatchObject({ cause: { code: '42501' } });
    }
  });

  it('app role can read and write app tables despite row-level security', async () => {
    await db.transaction(async (tx) => {
      await tx.execute(sql`set local role nestwise_app`);
      const familyId = await insertFamily(tx, { currencyCode: 'INR', minorUnit: 2 });
      const { rows } = await tx.execute(sql`select id from app.families where id = ${familyId}`);
      expect(rows).toHaveLength(1);
    });
  });

  it('every app table has RLS enabled', async () => {
    const { rows } = await db.execute(sql`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'app' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(rows).toHaveLength(0);
    const tables = await db.execute(sql`select 1 from pg_tables where schemaname = 'app'`);
    expect(tables.rows.length).toBeGreaterThanOrEqual(20);
  });
});

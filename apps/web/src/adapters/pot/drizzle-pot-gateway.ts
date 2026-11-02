import 'server-only';
import { allocations, checklistSkips, type DbOrTx, items, potEntries, savingsEntries, transactions } from '@nestwise/db';
import {
  type ChecklistSkip,
  PotDepositAlreadyExistsError,
  type PotEntry,
  type PotEntryKind,
  type PotGateway,
  SavingsAlreadyConfirmedError,
  type SavingsEntry,
} from '@nestwise/domain/pot';
import type { IsoDate, Period } from '@nestwise/domain/shared';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { isUniqueViolation } from '../shared/postgres-errors';

type EntryRow = typeof potEntries.$inferSelect;

const toEntry = (row: EntryRow): PotEntry => ({
  id: row.id,
  familyId: row.familyId,
  kind: row.kind,
  amountMinor: row.amountMinor,
  entryDate: row.entryDate as IsoDate,
  period: { year: row.periodYear, month: row.periodMonth },
  note: row.note,
  createdBy: row.createdBy,
  createdAt: row.createdAt,
});

const toSavings = (row: typeof savingsEntries.$inferSelect): SavingsEntry => ({
  id: row.id,
  familyId: row.familyId,
  itemId: row.itemId,
  period: { year: row.year, month: row.month },
  amountMinor: row.amountMinor,
  createdBy: row.createdBy,
  createdAt: row.createdAt,
});

const toSkip = (row: typeof checklistSkips.$inferSelect): ChecklistSkip => ({
  id: row.id,
  familyId: row.familyId,
  period: { year: row.year, month: row.month },
  itemId: row.itemId,
  createdBy: row.createdBy,
  createdAt: row.createdAt,
});

export class DrizzlePotGateway implements PotGateway {
  constructor(private readonly db: DbOrTx) {}

  async saveEntry(entry: PotEntry): Promise<PotEntry> {
    try {
      // A savepoint, so a duplicate deposit inside a unit of work can be reported without poisoning it.
      await this.db.transaction((tx) =>
        tx.insert(potEntries).values({
          id: entry.id,
          familyId: entry.familyId,
          kind: entry.kind,
          amountMinor: entry.amountMinor,
          entryDate: entry.entryDate,
          periodYear: entry.period.year,
          periodMonth: entry.period.month,
          note: entry.note,
          createdBy: entry.createdBy,
          createdAt: entry.createdAt,
        }),
      );
      return entry;
    } catch (error) {
      // The partial unique index is the real guard against two phones confirming at once.
      if (isUniqueViolation(error, 'pot_entries_one_live_deposit_idx')) {
        throw new PotDepositAlreadyExistsError('This month’s deposit is already confirmed', { cause: error });
      }
      throw error;
    }
  }

  async findDeposit(familyId: string, period: Period): Promise<PotEntry | undefined> {
    const [row] = await this.db
      .select()
      .from(potEntries)
      .where(
        and(
          eq(potEntries.familyId, familyId),
          eq(potEntries.kind, 'deposit'),
          eq(potEntries.periodYear, period.year),
          eq(potEntries.periodMonth, period.month),
          isNull(potEntries.deletedAt),
        ),
      )
      .limit(1);
    return row ? toEntry(row) : undefined;
  }

  async entryTotals(familyId: string): Promise<Readonly<Record<PotEntryKind, number>>> {
    const rows = await this.db
      .select({ kind: potEntries.kind, total: sql<string>`sum(${potEntries.amountMinor})` })
      .from(potEntries)
      .where(and(eq(potEntries.familyId, familyId), isNull(potEntries.deletedAt)))
      .groupBy(potEntries.kind);
    const totals: Record<PotEntryKind, number> = { opening: 0, deposit: 0, extra_in: 0, taken_out: 0 };
    for (const row of rows) totals[row.kind] = Number(row.total);
    return totals;
  }

  async yearlySpendMinor(familyId: string): Promise<number> {
    const [row] = await this.db
      .select({
        total: sql<string>`coalesce(sum(case when ${transactions.kind} = 'refund' then -${allocations.amountMinor} else ${allocations.amountMinor} end), 0)`,
      })
      .from(allocations)
      .innerJoin(transactions, eq(transactions.id, allocations.transactionId))
      .innerJoin(items, eq(items.id, allocations.itemId))
      .where(
        and(
          eq(allocations.familyId, familyId),
          eq(transactions.familyId, familyId),
          eq(items.kind, 'yearly'),
          eq(transactions.status, 'confirmed'),
          isNull(transactions.deletedAt),
          isNull(transactions.mergedInto),
        ),
      );
    return Number(row?.total ?? 0);
  }

  async findSavings(familyId: string, itemId: string, period: Period): Promise<SavingsEntry | undefined> {
    const [row] = await this.db
      .select()
      .from(savingsEntries)
      .where(
        and(
          eq(savingsEntries.familyId, familyId),
          eq(savingsEntries.itemId, itemId),
          eq(savingsEntries.year, period.year),
          eq(savingsEntries.month, period.month),
        ),
      )
      .limit(1);
    return row ? toSavings(row) : undefined;
  }

  async saveSavings(entry: SavingsEntry): Promise<SavingsEntry> {
    try {
      await this.db.transaction((tx) =>
        tx.insert(savingsEntries).values({
          id: entry.id,
          familyId: entry.familyId,
          itemId: entry.itemId,
          year: entry.period.year,
          month: entry.period.month,
          amountMinor: entry.amountMinor,
          createdBy: entry.createdBy,
          createdAt: entry.createdAt,
        }),
      );
      return entry;
    } catch (error) {
      if (isUniqueViolation(error, 'savings_entries_family_item_period_key')) {
        throw new SavingsAlreadyConfirmedError('This savings item is already confirmed for the month', { cause: error });
      }
      throw error;
    }
  }

  async listSavings(familyId: string, period: Period): Promise<readonly SavingsEntry[]> {
    const rows = await this.db
      .select()
      .from(savingsEntries)
      .where(and(eq(savingsEntries.familyId, familyId), eq(savingsEntries.year, period.year), eq(savingsEntries.month, period.month)));
    return rows.map(toSavings);
  }

  async listSkips(familyId: string, period: Period): Promise<readonly ChecklistSkip[]> {
    const rows = await this.db
      .select()
      .from(checklistSkips)
      .where(and(eq(checklistSkips.familyId, familyId), eq(checklistSkips.year, period.year), eq(checklistSkips.month, period.month)));
    return rows.map(toSkip);
  }

  async saveSkip(skip: ChecklistSkip): Promise<ChecklistSkip> {
    const inserted = await this.db
      .insert(checklistSkips)
      .values({
        id: skip.id,
        familyId: skip.familyId,
        year: skip.period.year,
        month: skip.period.month,
        itemId: skip.itemId,
        createdBy: skip.createdBy,
        createdAt: skip.createdAt,
      })
      .onConflictDoNothing({ target: [checklistSkips.familyId, checklistSkips.year, checklistSkips.month, checklistSkips.itemId] })
      .returning({ id: checklistSkips.id });
    if (inserted.length === 1) return skip;
    const existing = (await this.listSkips(skip.familyId, skip.period)).find((s) => s.itemId === skip.itemId);
    if (!existing) throw new Error('Checklist answer vanished after a conflict');
    return existing;
  }
}

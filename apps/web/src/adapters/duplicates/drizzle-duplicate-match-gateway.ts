import 'server-only';
import { type DbOrTx, duplicateMatches } from '@nestwise/db';
import { type DuplicateMatch, type DuplicateMatchGateway, type DuplicateReason, pairKey } from '@nestwise/domain/duplicates';
import { and, asc, eq, or } from 'drizzle-orm';

type MatchRow = typeof duplicateMatches.$inferSelect;

const toMatch = (row: MatchRow): DuplicateMatch => ({
  id: row.id,
  familyId: row.familyId,
  txnA: row.txnA,
  txnB: row.txnB,
  reasons: row.reasons as DuplicateReason[],
  status: row.status,
  resolvedBy: row.resolvedBy,
  resolvedAt: row.resolvedAt,
  createdAt: row.createdAt,
});

const involves = (txnId: string) => or(eq(duplicateMatches.txnA, txnId), eq(duplicateMatches.txnB, txnId));

export class DrizzleDuplicateMatchGateway implements DuplicateMatchGateway {
  constructor(private readonly db: DbOrTx) {}

  async create(match: DuplicateMatch): Promise<boolean> {
    // The unordered-pair unique index makes a second question about the same two expenses a no-op.
    const inserted = await this.db
      .insert(duplicateMatches)
      .values({ ...match, reasons: [...match.reasons] })
      .onConflictDoNothing()
      .returning({ id: duplicateMatches.id });
    return inserted.length > 0;
  }

  async find(familyId: string, id: string): Promise<DuplicateMatch | undefined> {
    const [row] = await this.db
      .select()
      .from(duplicateMatches)
      .where(and(eq(duplicateMatches.id, id), eq(duplicateMatches.familyId, familyId)))
      .limit(1);
    return row ? toMatch(row) : undefined;
  }

  async listPending(familyId: string): Promise<readonly DuplicateMatch[]> {
    const rows = await this.db
      .select()
      .from(duplicateMatches)
      .where(and(eq(duplicateMatches.familyId, familyId), eq(duplicateMatches.status, 'pending')))
      .orderBy(asc(duplicateMatches.createdAt));
    return rows.map(toMatch);
  }

  async differentPairsFor(familyId: string, txnId: string): Promise<ReadonlySet<string>> {
    const rows = await this.db
      .select({ a: duplicateMatches.txnA, b: duplicateMatches.txnB })
      .from(duplicateMatches)
      .where(and(eq(duplicateMatches.familyId, familyId), eq(duplicateMatches.status, 'different'), involves(txnId)));
    return new Set(rows.map((r) => pairKey(r.a, r.b)));
  }

  async answer(match: DuplicateMatch): Promise<boolean> {
    // The row lock this update takes makes a second answer at the same moment wait, then match nothing.
    const updated = await this.db
      .update(duplicateMatches)
      .set({ status: match.status, resolvedBy: match.resolvedBy, resolvedAt: match.resolvedAt })
      .where(and(eq(duplicateMatches.id, match.id), eq(duplicateMatches.familyId, match.familyId), eq(duplicateMatches.status, 'pending')))
      .returning({ id: duplicateMatches.id });
    return updated.length > 0;
  }

  async clearPendingFor(familyId: string, txnId: string): Promise<readonly DuplicateMatch[]> {
    const rows = await this.db
      .delete(duplicateMatches)
      .where(and(eq(duplicateMatches.familyId, familyId), eq(duplicateMatches.status, 'pending'), involves(txnId)))
      .returning();
    return rows.map(toMatch);
  }
}

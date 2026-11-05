import 'server-only';
import { captureBatches, captureEntries, type Db } from '@nestwise/db';
import type { CaptureBatch, CaptureEntry, CaptureGateway } from '@nestwise/domain/capture';
import type { IsoDate } from '@nestwise/domain/shared';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';

type BatchRow = typeof captureBatches.$inferSelect;
type EntryRow = typeof captureEntries.$inferSelect;

/** The staging store for spoken entries waiting to be checked. Every method is scoped to one family. */
export class DrizzleCaptureGateway implements CaptureGateway {
  constructor(private readonly db: Db) {}

  async create(batch: CaptureBatch): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.insert(captureBatches).values({
        id: batch.id,
        familyId: batch.familyId,
        createdBy: batch.createdBy,
        transcript: batch.transcript,
        sttModel: batch.sttModel,
        parseModel: batch.parseModel,
        createdAt: batch.createdAt,
        resolvedAt: batch.resolvedAt,
      });
      if (batch.entries.length === 0) return;
      await tx.insert(captureEntries).values(
        batch.entries.map((entry, sort) => ({
          id: entry.id,
          batchId: batch.id,
          familyId: batch.familyId,
          amountMinor: entry.amountMinor,
          itemId: entry.itemId,
          yearLineId: entry.yearLineId,
          kind: entry.kind,
          txnDate: entry.txnDate,
          merchant: entry.merchant,
          note: entry.note,
          heard: entry.heard,
          confidenceAmount: entry.confidence.amount,
          confidenceItem: entry.confidence.item,
          dropped: entry.dropped,
          sort,
        })),
      );
    });
  }

  async find(familyId: string, id: string): Promise<CaptureBatch | undefined> {
    const [batch] = await this.db
      .select()
      .from(captureBatches)
      .where(and(eq(captureBatches.familyId, familyId), eq(captureBatches.id, id)))
      .limit(1);
    if (!batch) return undefined;
    return toBatch(batch, await this.entriesOf([batch.id]));
  }

  async listWaiting(familyId: string): Promise<readonly CaptureBatch[]> {
    const batches = await this.db
      .select()
      .from(captureBatches)
      .where(and(eq(captureBatches.familyId, familyId), isNull(captureBatches.resolvedAt)))
      .orderBy(asc(captureBatches.createdAt), asc(captureBatches.id));
    if (batches.length === 0) return [];
    const entries = await this.entriesOf(batches.map((b) => b.id));
    return batches.map((batch) => toBatch(batch, entries));
  }

  /** False when it was already resolved, or belongs to another family: the guard against a double confirm. */
  async resolve(familyId: string, id: string, at: Date): Promise<boolean> {
    const updated = await this.db
      .update(captureBatches)
      .set({ resolvedAt: at })
      .where(and(eq(captureBatches.familyId, familyId), eq(captureBatches.id, id), isNull(captureBatches.resolvedAt)))
      .returning({ id: captureBatches.id });
    return updated.length === 1;
  }

  private async entriesOf(batchIds: readonly string[]): Promise<EntryRow[]> {
    if (batchIds.length === 0) return [];
    return this.db
      .select()
      .from(captureEntries)
      .where(inArray(captureEntries.batchId, [...batchIds]))
      .orderBy(asc(captureEntries.batchId), asc(captureEntries.sort));
  }
}

function toBatch(batch: BatchRow, entries: readonly EntryRow[]): CaptureBatch {
  return {
    id: batch.id,
    familyId: batch.familyId,
    createdBy: batch.createdBy,
    transcript: batch.transcript,
    sttModel: batch.sttModel,
    parseModel: batch.parseModel,
    entries: entries.filter((row) => row.batchId === batch.id).map(toEntry),
    createdAt: batch.createdAt,
    resolvedAt: batch.resolvedAt,
  };
}

function toEntry(row: EntryRow): CaptureEntry {
  return {
    id: row.id,
    amountMinor: row.amountMinor,
    itemId: row.itemId,
    yearLineId: row.yearLineId,
    kind: row.kind,
    txnDate: row.txnDate as IsoDate,
    merchant: row.merchant,
    note: row.note,
    heard: row.heard,
    confidence: { amount: row.confidenceAmount, item: row.confidenceItem },
    dropped: row.dropped,
  };
}

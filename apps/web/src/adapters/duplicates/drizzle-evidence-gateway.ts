import 'server-only';
import { type DbOrTx, evidence } from '@nestwise/db';
import type { Evidence, EvidenceGateway } from '@nestwise/domain/duplicates';
import { and, count, eq, inArray, isNull } from 'drizzle-orm';

export class DrizzleEvidenceGateway implements EvidenceGateway {
  constructor(private readonly db: DbOrTx) {}

  async add(proof: Evidence): Promise<void> {
    await this.db.insert(evidence).values({
      id: proof.id,
      familyId: proof.familyId,
      transactionId: proof.transactionId,
      kind: proof.kind,
      transcript: proof.transcript,
      // A merged-entry snapshot is the whole expense as it was; JSON keeps its dates as ISO strings.
      extracted: JSON.parse(JSON.stringify(proof.extracted)) as unknown,
      createdBy: proof.createdBy,
      createdAt: proof.createdAt,
    });
  }

  async countByTransaction(familyId: string, txnIds: readonly string[]): Promise<ReadonlyMap<string, number>> {
    if (txnIds.length === 0) return new Map();
    const rows = await this.db
      .select({ txnId: evidence.transactionId, n: count() })
      .from(evidence)
      .where(and(eq(evidence.familyId, familyId), inArray(evidence.transactionId, [...txnIds]), isNull(evidence.deletedAt)))
      .groupBy(evidence.transactionId);
    return new Map(rows.filter((r) => r.txnId !== null).map((r) => [r.txnId!, r.n]));
  }

  async moveTo(familyId: string, fromTxnId: string, toTxnId: string): Promise<void> {
    await this.db
      .update(evidence)
      .set({ transactionId: toTxnId })
      .where(and(eq(evidence.familyId, familyId), eq(evidence.transactionId, fromTxnId)));
  }
}

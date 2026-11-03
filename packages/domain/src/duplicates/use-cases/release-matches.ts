import type { TransactionGateway } from '../../expenses';
import type { DuplicateMatchGateway } from '../ports';

/**
 * Drops the unanswered questions a transaction is part of (it was deleted, merged, or its amount or date changed),
 * and lets each waiting expense count again. A question is stale once either side has changed.
 */
export async function releaseMatchesOf(
  gateways: { readonly transactions: TransactionGateway; readonly duplicates: DuplicateMatchGateway },
  familyId: string,
  txnId: string,
  now: Date,
): Promise<void> {
  for (const match of await gateways.duplicates.clearPendingFor(familyId, txnId)) {
    const waiting = await gateways.transactions.findById(familyId, match.txnB);
    if (waiting && waiting.status === 'pending' && waiting.deletedAt === null && waiting.mergedInto === null) {
      await gateways.transactions.update({ ...waiting, status: 'confirmed', updatedAt: now });
    }
  }
}

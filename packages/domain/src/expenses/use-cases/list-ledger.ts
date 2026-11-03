import type { EvidenceGateway } from '../../duplicates';
import { assertCan } from '../../shared';
import type { LedgerEntry, ListExpensesCommand } from '../models';
import type { TransactionGateway } from '../ports';

/**
 * The ledger (PRD §6.9): the month's confirmed expenses, filtered by item, person or method, each with its proof count.
 * Entries waiting in the Inbox and entries merged into another are not listed.
 */
export class ListLedgerUseCase {
  constructor(
    private readonly transactions: TransactionGateway,
    private readonly evidence: EvidenceGateway,
  ) {}

  async execute(command: ListExpensesCommand): Promise<readonly LedgerEntry[]> {
    assertCan(command.actor, 'read');
    const { actor, ...filter } = command;
    const listed = (await this.transactions.list(actor.familyId, filter)).filter((t) => t.status === 'confirmed' && t.mergedInto === null);
    const counts = await this.evidence.countByTransaction(
      actor.familyId,
      listed.map((t) => t.id),
    );
    return listed.map((transaction) => ({ transaction, proofs: 1 + (counts.get(transaction.id) ?? 0) }));
  }
}

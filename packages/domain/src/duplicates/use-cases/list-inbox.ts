import type { TransactionGateway } from '../../expenses';
import { type Actor, assertCan } from '../../shared';
import type { InboxEntry } from '../models';
import type { DuplicateMatchGateway } from '../ports';

/** The Inbox: unanswered "Same purchase?" questions, oldest first. Nothing here counts until someone answers. */
export class ListInboxUseCase {
  constructor(
    private readonly duplicates: DuplicateMatchGateway,
    private readonly transactions: TransactionGateway,
  ) {}

  async execute(command: { readonly actor: Actor }): Promise<readonly InboxEntry[]> {
    assertCan(command.actor, 'read');
    const familyId = command.actor.familyId;
    const entries: InboxEntry[] = [];
    for (const match of await this.duplicates.listPending(familyId)) {
      const pending = await this.transactions.findById(familyId, match.txnB);
      const other = await this.transactions.findById(familyId, match.txnA);
      if (!pending || !other || pending.deletedAt || other.deletedAt || pending.mergedInto || other.mergedInto) continue;
      entries.push({ matchId: match.id, pending, other, reasons: match.reasons });
    }
    return entries;
  }
}

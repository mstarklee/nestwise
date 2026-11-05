import type { CaptureGateway } from '../../capture/ports';
import type { TransactionGateway } from '../../expenses';
import { type Actor, assertCan } from '../../shared';
import type { Inbox, InboxEntry, WaitingCapture } from '../models';
import type { DuplicateMatchGateway } from '../ports';

/**
 * The Inbox: unanswered "Same purchase?" questions and spoken notes still to be checked, oldest first within each.
 * Nothing here counts until someone answers it.
 */
export class ListInboxUseCase {
  constructor(
    private readonly duplicates: DuplicateMatchGateway,
    private readonly transactions: TransactionGateway,
    private readonly captures: CaptureGateway,
  ) {}

  async execute(command: { readonly actor: Actor }): Promise<Inbox> {
    assertCan(command.actor, 'read');
    const familyId = command.actor.familyId;

    const entries: InboxEntry[] = [];
    for (const match of await this.duplicates.listPending(familyId)) {
      const pending = await this.transactions.findById(familyId, match.txnB);
      const other = await this.transactions.findById(familyId, match.txnA);
      if (!pending || !other || pending.deletedAt || other.deletedAt || pending.mergedInto || other.mergedInto) continue;
      entries.push({ matchId: match.id, pending, other, reasons: match.reasons });
    }

    const waiting: WaitingCapture[] = (await this.captures.listWaiting(familyId)).map((batch) => ({
      batchId: batch.id,
      createdBy: batch.createdBy,
      mine: batch.createdBy === command.actor.userId,
      transcript: batch.transcript,
      entries: batch.entries,
      createdAt: batch.createdAt,
    }));

    return { duplicates: entries, captures: waiting };
  }
}

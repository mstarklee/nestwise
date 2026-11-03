import type { ExpensesUnitOfWork } from '../../expenses';
import { assertCan, type Clock, type IdGenerator, type Period } from '../../shared';
import { DuplicateAlreadyResolvedError, DuplicateMatchNotFoundError, InvalidDuplicateAnswerError } from '../errors';
import type { DuplicateMatch, ResolveDuplicateCommand } from '../models';
import { earlier } from '../rules';
import { releaseMatchesOf } from './release-matches';

/**
 * Answers "Same purchase?". Same keeps one expense (the earlier, unless keepId says otherwise), merges the other into
 * it and keeps a snapshot as proof. Different lets the waiting one count, and the pair is never asked about again.
 */
export class ResolveDuplicateUseCase {
  constructor(
    private readonly uow: ExpensesUnitOfWork,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  /** Returns the month of the expenses in the question (where spending changed). */
  async execute(command: ResolveDuplicateCommand): Promise<{ readonly period: Period }> {
    assertCan(command.actor, 'record_expense');
    const familyId = command.actor.familyId;
    return this.uow.run(async (gateways) => {
      const { transactions, duplicates, evidence, activity } = gateways;
      const match = await duplicates.find(familyId, command.matchId);
      if (!match) throw new DuplicateMatchNotFoundError('That question was not found');
      if (match.status !== 'pending') throw new DuplicateAlreadyResolvedError('That question was already answered');
      if (command.keepId !== undefined && command.keepId !== match.txnA && command.keepId !== match.txnB) {
        throw new InvalidDuplicateAnswerError('Keep one of the two expenses in the question');
      }
      const a = await transactions.findById(familyId, match.txnA);
      const b = await transactions.findById(familyId, match.txnB);
      if (!a || !b) throw new DuplicateMatchNotFoundError('That question was not found');

      const now = this.clock.now();
      const resolved: DuplicateMatch = { ...match, status: command.answer, resolvedBy: command.actor.userId, resolvedAt: now };
      await duplicates.save(resolved);

      if (command.answer === 'different') {
        if (b.status === 'pending') await transactions.update({ ...b, status: 'confirmed', updatedAt: now });
      } else {
        const keeper = command.keepId === undefined ? earlier(a, b) : command.keepId === a.id ? a : b;
        const merged = keeper === a ? b : a;
        await transactions.update({ ...merged, mergedInto: keeper.id, updatedAt: now });
        await transactions.update({ ...keeper, status: 'confirmed', updatedAt: now });
        await evidence.moveTo(familyId, merged.id, keeper.id);
        await evidence.add({
          id: this.ids.next(),
          familyId,
          transactionId: keeper.id,
          kind: 'merged_entry',
          extracted: merged,
          createdBy: command.actor.userId,
          createdAt: now,
        });
        await releaseMatchesOf(gateways, familyId, merged.id, now);
      }

      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: `duplicate.${command.answer}`,
        entityType: 'duplicate_match',
        entityId: match.id,
        before: match,
        after: resolved,
        at: now,
      });
      return { period: b.period };
    });
  }
}

import { assertCan, type Clock } from '../../shared';
import { ExpenseNotRestorableError, TransactionNotFoundError } from '../errors';
import { type ExpenseIdCommand, RESTORE_DAYS, type Transaction } from '../models';
import type { ExpensesUnitOfWork, TransactionGateway } from '../ports';

const RESTORE_MS = RESTORE_DAYS * 24 * 60 * 60 * 1000;

/** Brings back a deleted expense, within 30 days of the delete. */
export class RestoreExpenseUseCase {
  constructor(
    private readonly uow: ExpensesUnitOfWork,
    private readonly transactions: TransactionGateway,
    private readonly clock: Clock,
  ) {}

  async execute(command: ExpenseIdCommand): Promise<Transaction> {
    assertCan(command.actor, 'record_expense');
    const familyId = command.actor.familyId;
    const before = await this.transactions.findById(familyId, command.id);
    if (!before) throw new TransactionNotFoundError('That expense was not found');
    if (!before.deletedAt) return before;
    const now = this.clock.now();
    if (now.getTime() - before.deletedAt.getTime() > RESTORE_MS) {
      throw new ExpenseNotRestorableError(`A deleted expense can be restored for ${RESTORE_DAYS} days`);
    }
    const after: Transaction = { ...before, deletedAt: null, updatedAt: now };
    return this.uow.run(async ({ transactions, activity, months }) => {
      await transactions.update(after);
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: 'expense.restore',
        entityType: 'transaction',
        entityId: after.id,
        before: { deletedAt: before.deletedAt },
        after: { deletedAt: null },
        at: now,
        lateEdit: (await months.statusOf(familyId, after.period)) === 'closed',
      });
      return after;
    });
  }
}

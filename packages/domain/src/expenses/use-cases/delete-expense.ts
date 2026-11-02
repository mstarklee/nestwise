import { assertCan, type Clock } from '../../shared';
import { TransactionNotFoundError } from '../errors';
import type { ExpenseIdCommand, Transaction } from '../models';
import type { ExpensesUnitOfWork, TransactionGateway } from '../ports';

/** Soft delete: the expense stops counting everywhere (month, year plan, pot) and can be restored for 30 days. */
export class DeleteExpenseUseCase {
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
    if (before.deletedAt) return before;
    const now = this.clock.now();
    const after: Transaction = { ...before, deletedAt: now, updatedAt: now };
    return this.uow.run(async ({ transactions, activity }) => {
      await transactions.update(after);
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: 'expense.delete',
        entityType: 'transaction',
        entityId: after.id,
        before: { deletedAt: null },
        after: { deletedAt: now },
        at: now,
      });
      return after;
    });
  }
}

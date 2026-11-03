import { releaseMatchesOf } from '../../duplicates/use-cases/release-matches';
import type { MembershipGateway } from '../../family';
import type { EnsureMonthBudgetUseCase } from '../../month-budget';
import type { PlanGateway } from '../../plan';
import { assertCan, type Clock, periodOf } from '../../shared';
import { InvalidExpenseCommandError, TransactionNotFoundError } from '../errors';
import type { AllocationInput, EditExpenseCommand, Transaction } from '../models';
import type { ExpensesUnitOfWork, TransactionGateway } from '../ports';
import { assertPayer, checkAmounts, checkDate, checkText, resolveAllocations } from './expense-rules';

/** Changes a live expense. A new date moves it to that month; totals come from allocations, so nothing double-counts. */
export class EditExpenseUseCase {
  constructor(
    private readonly uow: ExpensesUnitOfWork,
    private readonly transactions: TransactionGateway,
    private readonly plan: PlanGateway,
    private readonly memberships: MembershipGateway,
    private readonly ensureMonth: EnsureMonthBudgetUseCase,
    private readonly clock: Clock,
  ) {}

  async execute(command: EditExpenseCommand): Promise<Transaction> {
    assertCan(command.actor, 'record_expense');
    const familyId = command.actor.familyId;
    const before = await this.transactions.findById(familyId, command.id);
    if (!before || before.deletedAt) throw new TransactionNotFoundError('That expense was not found');
    const { changes } = command;

    const amountMinor = changes.amountMinor ?? before.amountMinor;
    const txnDate = changes.txnDate === undefined ? before.txnDate : checkDate(changes.txnDate);
    const inputs = changes.allocations ?? followAmount(before, amountMinor);
    checkAmounts(amountMinor, inputs);
    const merchant = changes.merchant === undefined ? before.merchant : checkText(changes.merchant, 'merchant');
    const note = changes.note === undefined ? before.note : checkText(changes.note, 'note');
    const paidBy = changes.paidBy === undefined ? before.paidBy : changes.paidBy;
    if (changes.paidBy !== undefined) await assertPayer(this.memberships, familyId, paidBy);
    const allocations = changes.allocations ? await resolveAllocations(this.plan, familyId, changes.allocations, txnDate) : inputs.map((a) => ({ ...a, planYear: a.planYear ?? null }));

    const period = periodOf(txnDate);
    await this.ensureMonth.execute({ familyId, period });
    const now = this.clock.now();
    const after: Transaction = { ...before, amountMinor, txnDate, period, merchant, note, paidBy, allocations, updatedAt: now };

    return this.uow.run(async (gateways) => {
      const { transactions, activity, months } = gateways;
      await transactions.update(after);
      // A changed amount or date makes any open "Same purchase?" question about it stale.
      if (after.amountMinor !== before.amountMinor || after.txnDate !== before.txnDate) await releaseMatchesOf(gateways, familyId, after.id, now);
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: 'expense.edit',
        entityType: 'transaction',
        entityId: after.id,
        before,
        after,
        at: now,
        lateEdit: (await months.statusOf(familyId, before.period)) === 'closed' || (await months.statusOf(familyId, period)) === 'closed',
      });
      return (await transactions.findById(familyId, after.id)) ?? after;
    });
  }
}

/** With no new allocations, a single-item expense follows the new amount; a split must be re-split by the caller. */
function followAmount(before: Transaction, amountMinor: number): readonly AllocationInput[] {
  if (amountMinor === before.amountMinor) return before.allocations;
  const [only, ...rest] = before.allocations;
  if (!only || rest.length > 0) throw new InvalidExpenseCommandError('Give the new split when changing the amount of a split expense');
  return [{ ...only, amountMinor }];
}

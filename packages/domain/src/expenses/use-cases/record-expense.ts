import type { FamilyGateway, MembershipGateway } from '../../family';
import type { EnsureMonthBudgetUseCase } from '../../month-budget';
import type { PlanGateway } from '../../plan';
import { assertCan, type Clock, periodOf, todayIn } from '../../shared';
import { ExpenseIdTakenError, InvalidExpenseCommandError } from '../errors';
import type { RecordExpenseCommand, RecordExpenseResult, Transaction } from '../models';
import type { ExpensesUnitOfWork, TransactionGateway } from '../ports';
import { assertClientId, assertPayer, checkAmounts, checkDate, checkText, resolveAllocations } from './expense-rules';

/** Saves a typed expense (or refund), split across one or more items. A resend of the same id returns the first save. */
export class RecordExpenseUseCase {
  constructor(
    private readonly uow: ExpensesUnitOfWork,
    private readonly transactions: TransactionGateway,
    private readonly plan: PlanGateway,
    private readonly memberships: MembershipGateway,
    private readonly families: FamilyGateway,
    private readonly ensureMonth: EnsureMonthBudgetUseCase,
    private readonly clock: Clock,
  ) {}

  async execute(command: RecordExpenseCommand): Promise<RecordExpenseResult> {
    assertCan(command.actor, 'record_expense');
    assertClientId(command.id);
    const kind = command.kind ?? 'expense';
    if (kind !== 'expense' && kind !== 'refund') throw new InvalidExpenseCommandError('Not an expense or refund');
    checkAmounts(command.amountMinor, command.allocations);
    if (command.txnDate !== undefined) checkDate(command.txnDate);
    const merchant = checkText(command.merchant, 'merchant');
    const note = checkText(command.note, 'note');

    const familyId = command.actor.familyId;
    const existing = await this.transactions.findById(familyId, command.id);
    if (existing) return { transaction: existing, created: false }; // the same client id, resent by the offline outbox

    const family = await this.families.findById(familyId);
    if (!family) throw new InvalidExpenseCommandError('Your family was not found');
    const txnDate = command.txnDate ?? todayIn(family.timeZone, this.clock.now());
    const paidBy = command.paidBy ?? command.actor.userId;
    await assertPayer(this.memberships, familyId, paidBy);
    const allocations = await resolveAllocations(this.plan, familyId, command.allocations, txnDate);

    const period = periodOf(txnDate);
    await this.ensureMonth.execute({ familyId, period }); // a back-dated month gets its budget from the template
    const now = this.clock.now();
    const transaction: Transaction = {
      id: command.id,
      familyId,
      kind,
      amountMinor: command.amountMinor,
      currencyCode: family.currencyCode,
      txnDate,
      period,
      merchant,
      note,
      enteredBy: command.actor.userId,
      paidBy,
      captureMethod: 'typed',
      status: 'confirmed',
      allocations,
      entryTimeZone: family.timeZone,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    return this.uow.run(async ({ transactions, activity }) => {
      if (!(await transactions.insert(transaction))) {
        const first = await transactions.findById(familyId, command.id);
        if (first) return { transaction: first, created: false }; // two resends raced; the first one won
        throw new ExpenseIdTakenError('That expense id is already used');
      }
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: kind === 'refund' ? 'refund.record' : 'expense.record',
        entityType: 'transaction',
        entityId: transaction.id,
        before: null,
        after: transaction,
        at: now,
      });
      return { transaction, created: true };
    });
  }
}

import { assertCan } from '../../shared';
import type { ListExpensesCommand, Transaction } from '../models';
import type { TransactionGateway } from '../ports';

/** The month's live expenses and refunds, newest first, optionally for one item or one person. */
export class ListExpensesUseCase {
  constructor(private readonly transactions: TransactionGateway) {}

  async execute(command: ListExpensesCommand): Promise<readonly Transaction[]> {
    assertCan(command.actor, 'read');
    const { actor: _actor, ...filter } = command;
    return this.transactions.list(command.actor.familyId, filter);
  }
}

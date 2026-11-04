import type { EvidenceGateway } from '../../duplicates';
import { InvalidFamilyCommandError, type FamilyGateway } from '../../family';
import type { RecordExpenseUseCase, Transaction } from '../../expenses';
import { type Actor, assertCan, type Clock, type IdGenerator, type IsoDate } from '../../shared';
import type { YearLine, YearPaidGateway, YearPlanGateway } from '../../year-plan';
import { BillAlreadyPaidError, BillNotPayableError, CaptureBatchNotFoundError, NotYourBatchError } from '../errors';
import type { CaptureKind } from '../models';
import type { CaptureGateway } from '../ports';

/** One row of the review screen as the person left it. */
export interface ConfirmedEntry {
  readonly id: string;
  readonly amountMinor: number;
  readonly itemId: string | null;
  readonly yearLineId: string | null;
  readonly kind: CaptureKind;
  readonly txnDate: IsoDate;
  readonly merchant: string | null;
  readonly note: string;
  readonly paidBy: string | null;
  /** The person removed this row; it writes nothing. */
  readonly dropped: boolean;
}

export interface ConfirmVoiceEntriesCommand {
  readonly actor: Actor;
  readonly batchId: string;
  readonly entries: readonly ConfirmedEntry[];
}

export interface ConfirmGateways {
  readonly captures: CaptureGateway;
  readonly yearPlans: YearPlanGateway;
  readonly yearPaid: YearPaidGateway;
  readonly evidence: EvidenceGateway;
  readonly families: FamilyGateway;
}

/**
 * Turns checked rows into real money (design §6 and §8).
 *
 * Every row goes through `RecordExpenseUseCase`, so allocations, rules, activity rows and the duplicate check are
 * exactly those of a typed expense. A bill payment is the same call with the allocation pointing at the yearly item
 * and carrying its plan year — **never** a write to the line's state.
 *
 * `MarkYearLineDoneUseCase` is deliberately not used: it moves no money, and it documents itself as "nothing more
 * is owed, whatever was paid", which on a short payment would drop the remainder out of the 12-month forecast. What
 * makes a bill paid here is the allocation; the line's status then derives itself, part-paid included.
 */
export class ConfirmVoiceEntriesUseCase {
  constructor(
    private readonly gateways: ConfirmGateways,
    private readonly recordExpense: RecordExpenseUseCase,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: ConfirmVoiceEntriesCommand): Promise<{ created: readonly Transaction[] }> {
    assertCan(command.actor, 'record_expense');
    const familyId = command.actor.familyId;

    const batch = await this.gateways.captures.find(familyId, command.batchId);
    if (!batch) throw new CaptureBatchNotFoundError('That voice note is no longer waiting');
    if (batch.createdBy !== command.actor.userId) {
      throw new NotYourBatchError('Only the person who recorded this can confirm it');
    }

    // Already dealt with: say so quietly rather than re-checking rows whose money has already moved — a second
    // confirm of a paid bill would otherwise come back as "already paid" instead of "nothing left to do".
    if (batch.resolvedAt !== null) return { created: [] };

    const family = await this.gateways.families.findById(familyId);
    if (!family) throw new InvalidFamilyCommandError('Your family was not found');

    const keeping = command.entries.filter((entry) => !entry.dropped);

    // Every bill row is checked before anything is written, so a bad one cannot leave half a batch behind.
    const lines = new Map<string, YearLine>();
    for (const entry of keeping.filter((e) => e.kind === 'yearly_bill')) {
      lines.set(entry.id, await this.payableLine(familyId, entry));
    }

    // Claimed first: a second confirm finds it already resolved and writes nothing.
    if (!(await this.gateways.captures.resolve(familyId, batch.id, this.clock.now()))) return { created: [] };

    const siblingIds = keeping.map((entry) => entry.id);
    const created: Transaction[] = [];

    for (const entry of keeping) {
      const line = lines.get(entry.id);
      const allocation = line
        ? { itemId: line.itemId, amountMinor: entry.amountMinor, planYear: line.year }
        : { itemId: entry.itemId ?? '', amountMinor: entry.amountMinor };

      const { transaction } = await this.recordExpense.execute({
        actor: command.actor,
        // The staged row's own id, so confirming twice can only ever write it once.
        id: entry.id,
        amountMinor: entry.amountMinor,
        txnDate: entry.txnDate,
        allocations: [allocation],
        merchant: entry.merchant,
        note: entry.note === '' ? null : entry.note,
        paidBy: entry.paidBy,
        captureMethod: 'voice',
        knownDistinctIds: siblingIds.filter((id) => id !== entry.id),
      });

      await this.gateways.evidence.add({
        id: this.ids.next(),
        familyId,
        transactionId: transaction.id,
        kind: 'voice',
        transcript: batch.transcript,
        extracted: entry,
        createdBy: command.actor.userId,
        createdAt: this.clock.now(),
      });

      created.push(transaction);
    }

    return { created };
  }

  /**
   * The bill this row pays, or a refusal. A line that is closed, cancelled, from another year's plan or missing
   * cannot be paid, and one with nothing left owing cannot be paid again (design §6).
   */
  private async payableLine(familyId: string, entry: ConfirmedEntry): Promise<YearLine> {
    if (entry.yearLineId === null) throw new BillNotPayableError('That row has no yearly bill to pay');

    const line = await this.gateways.yearPlans.findLine(familyId, entry.yearLineId);
    if (!line) throw new BillNotPayableError('That yearly bill is not in your plan');
    if (line.state !== 'open') throw new BillNotPayableError(`“${line.name}” is not open`);

    const thisYear = Number(entry.txnDate.slice(0, 4));
    if (line.year !== thisYear) throw new BillNotPayableError(`“${line.name}” belongs to your ${line.year} plan`);

    const paid = (await this.gateways.yearPaid.paidByLine(familyId, line.year)).get(line.id) ?? 0;
    if (paid >= line.plannedMinor && line.plannedMinor > 0) {
      throw new BillAlreadyPaidError(`“${line.name}” is already paid`);
    }

    return line;
  }
}

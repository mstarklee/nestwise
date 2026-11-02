import type { FamilyGateway } from '../../family';
import { assertCan, type Clock, type IdGenerator, periodOf } from '../../shared';
import { InvalidPotCommandError } from '../errors';
import type { PotEntry, RecordPotMovementCommand } from '../models';
import type { PotUnitOfWork } from '../ports';
import { assertPositiveAmount, familyToday } from './pot-rules';

const MAX_NOTE = 200;

/** Extra money in (a bonus), or money taken out for something else, which needs a note so the balance stays honest. */
export class RecordPotMovementUseCase {
  constructor(
    private readonly uow: PotUnitOfWork,
    private readonly families: FamilyGateway,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: RecordPotMovementCommand): Promise<PotEntry> {
    assertCan(command.actor, 'confirm_checklist');
    if (command.kind !== 'extra_in' && command.kind !== 'taken_out') throw new InvalidPotCommandError('Not a pot movement');
    assertPositiveAmount(command.amountMinor);
    const note = command.note?.trim() || null;
    if (command.kind === 'taken_out' && note === null) throw new InvalidPotCommandError('Say what the money was taken out for');
    if (note !== null && [...note].length > MAX_NOTE) throw new InvalidPotCommandError(`The note must be at most ${MAX_NOTE} characters`);

    const familyId = command.actor.familyId;
    const entryDate = await familyToday(this.families, familyId, this.clock);
    const entry: PotEntry = {
      id: this.ids.next(),
      familyId,
      kind: command.kind,
      amountMinor: command.amountMinor,
      entryDate,
      period: periodOf(entryDate),
      note,
      createdBy: command.actor.userId,
      createdAt: this.clock.now(),
    };
    return this.uow.run(async ({ pot, activity }) => {
      const saved = await pot.saveEntry(entry);
      await activity.record({
        familyId,
        actorId: command.actor.userId,
        action: `pot.${command.kind}`,
        entityType: 'pot_entry',
        entityId: saved.id,
        before: null,
        after: { amountMinor: saved.amountMinor, note: saved.note },
        at: entry.createdAt,
      });
      return saved;
    });
  }
}

import { assertCan, type Clock } from '../../shared';
import { InvalidFamilyCommandError } from '../errors';
import type { Family, UpdateFamilySettingsCommand } from '../models';
import type { FamilyGateway, FamilyUnitOfWork } from '../ports';

const MAX_LEVELS = 3;

/**
 * Renames the family or changes its spending-alert levels (Admin). The currency, minor unit and everything else stay
 * as they are (PRD §7 test 3).
 */
export class UpdateFamilySettingsUseCase {
  constructor(
    private readonly uow: FamilyUnitOfWork,
    private readonly families: FamilyGateway,
    private readonly clock: Clock,
  ) {}

  async execute(command: UpdateFamilySettingsCommand): Promise<Family> {
    assertCan(command.actor, 'manage_family');
    const before = await this.families.findById(command.actor.familyId);
    if (!before) throw new InvalidFamilyCommandError('Your family was not found');

    let name = before.name;
    if (command.name !== undefined) {
      name = command.name.trim();
      if (name.length < 1 || name.length > 80) throw new InvalidFamilyCommandError('The family name must be 1–80 characters');
    }
    let alertThresholds = before.alertThresholds;
    if (command.alertThresholds !== undefined) {
      const levels = [...new Set(command.alertThresholds)].sort((a, b) => a - b);
      if (levels.length < 1 || levels.length > MAX_LEVELS) throw new InvalidFamilyCommandError(`Choose 1 to ${MAX_LEVELS} alert levels`);
      if (levels.some((l) => !Number.isInteger(l) || l < 1 || l > 200)) throw new InvalidFamilyCommandError('Alert levels are whole percents from 1 to 200');
      alertThresholds = levels;
    }

    const after: Family = { ...before, name, alertThresholds };
    return this.uow.run(async ({ families, activity }) => {
      const saved = await families.save(after);
      await activity.record({
        familyId: before.id,
        actorId: command.actor.userId,
        action: 'family.updated',
        entityType: 'family',
        entityId: before.id,
        before: { name: before.name, alertThresholds: before.alertThresholds },
        after: { name: saved.name, alertThresholds: saved.alertThresholds },
        at: this.clock.now(),
      });
      return saved;
    });
  }
}

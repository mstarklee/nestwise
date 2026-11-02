import { type Clock, type IdGenerator, minorUnitOf, periodOf, todayIn } from '../../shared';
import { AlreadyInFamilyError, InvalidFamilyCommandError, SignupClosedError } from '../errors';
import { type CreateFamilyCommand, type Family, numberLocaleFor } from '../models';
import type { FamilyUnitOfWork, MembershipGateway } from '../ports';

const MAX_NAME = 80;

export class CreateFamilyUseCase {
  constructor(
    private readonly uow: FamilyUnitOfWork,
    private readonly memberships: MembershipGateway,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async execute(command: CreateFamilyCommand): Promise<Family> {
    const { name, minorUnit, countryCode } = validate(command);
    if (!command.signupAllowed) throw new SignupClosedError('NestWise is invite-only for now');
    if (await this.memberships.findActive(command.actorUserId)) {
      throw new AlreadyInFamilyError('You already belong to a family');
    }

    const now = this.clock.now();
    const family: Family = {
      id: this.ids.next(),
      name,
      currencyCode: command.currencyCode,
      minorUnit,
      numberLocale: numberLocaleFor(command.currencyCode, countryCode),
      timeZone: command.timeZone,
      countryCode,
      setAsideOverrideMinor: null,
      alertThresholds: [80, 100],
      createdBy: command.actorUserId,
      createdAt: now,
    };
    const entryDate = todayIn(command.timeZone, now);
    const openingId = this.ids.next();

    return this.uow.run(async ({ families, memberships, openingPot, activity }) => {
      await families.save(family);
      await memberships.save({ familyId: family.id, userId: command.actorUserId, role: 'admin', joinedAt: now });
      await openingPot.record({
        id: openingId,
        familyId: family.id,
        kind: 'opening',
        amountMinor: command.openingPotMinor,
        entryDate,
        period: periodOf(entryDate),
        createdBy: command.actorUserId,
      });
      await activity.record({
        familyId: family.id,
        actorId: command.actorUserId,
        action: 'family.created',
        entityType: 'family',
        entityId: family.id,
        before: null,
        after: family,
        at: now,
      });
      return family;
    });
  }
}

function validate(command: CreateFamilyCommand) {
  const name = command.name.trim();
  const length = [...name].length; // characters, so Tamil or emoji count as one each
  if (length < 1 || length > MAX_NAME) throw new InvalidFamilyCommandError(`The family name must be 1–${MAX_NAME} characters`);

  const minorUnit = minorUnitOf(command.currencyCode);
  if (minorUnit === undefined) throw new InvalidFamilyCommandError(`Unknown currency: ${command.currencyCode}`);

  if (!isTimeZone(command.timeZone)) throw new InvalidFamilyCommandError(`Unknown time zone: ${command.timeZone}`);

  const countryCode = command.countryCode ?? null;
  if (countryCode !== null && !/^[A-Z]{2}$/.test(countryCode)) {
    throw new InvalidFamilyCommandError('The country must be a two-letter code, e.g. IN');
  }

  if (!Number.isSafeInteger(command.openingPotMinor) || command.openingPotMinor < 0) {
    throw new InvalidFamilyCommandError('The opening pot balance must be zero or more, in whole minor units');
  }
  return { name, minorUnit, countryCode };
}

function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}

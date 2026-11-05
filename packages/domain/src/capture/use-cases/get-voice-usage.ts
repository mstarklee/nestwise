import { InvalidFamilyCommandError, type FamilyGateway } from '../../family';
import { type Actor, assertCan, type Clock, type Period, periodOf, todayIn } from '../../shared';
import type { UsageGateway } from '../ports';

/** What Settings shows about voice this month (design §9). `capPerMonth` is null for a family with no limit. */
export interface VoiceUsage {
  readonly period: Period;
  readonly used: number;
  /** A lower bound: not every speech service reports how long a recording was (see the Task 4 ledger note). */
  readonly secondsRecorded: number;
  readonly capPerMonth: number | null;
}

export class GetVoiceUsageUseCase {
  constructor(
    private readonly usage: UsageGateway,
    private readonly families: FamilyGateway,
    private readonly clock: Clock,
    /** `Infinity` for an uncapped family; reported as null. */
    private readonly capPerMonth: number,
  ) {}

  async execute(command: { readonly actor: Actor }): Promise<VoiceUsage> {
    assertCan(command.actor, 'read');
    const familyId = command.actor.familyId;
    const family = await this.families.findById(familyId);
    if (!family) throw new InvalidFamilyCommandError('Your family was not found');

    const period = periodOf(todayIn(family.timeZone, this.clock.now()));
    const { voiceCount, voiceSeconds } = await this.usage.countThisMonth(familyId, period);

    return {
      period,
      used: voiceCount,
      secondsRecorded: voiceSeconds,
      capPerMonth: Number.isFinite(this.capPerMonth) ? this.capPerMonth : null,
    };
  }
}

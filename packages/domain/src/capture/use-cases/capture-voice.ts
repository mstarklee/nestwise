import { InvalidFamilyCommandError, type Family } from '../../family';
import type { EnsureMiscellaneousItemUseCase } from '../../plan';
import { type Actor, assertCan, type Clock, type IdGenerator, type IsoDate, periodOf, todayIn } from '../../shared';
import { CaptureCapReachedError, CaptureNotUnderstoodError } from '../errors';
import type { CaptureBatch, CaptureEntry, ParseContext } from '../models';
import type { CaptureGateways, ExpenseParser, SpeechToText } from '../ports';

/**
 * The languages a recording may be in. Fixed for this family (design §4); opening up to the public in Stage 4 will
 * need it to become a family setting.
 */
export const CAPTURE_LANGUAGES: readonly string[] = ['ta', 'en'];

export interface CaptureVoiceCommand {
  readonly actor: Actor;
  readonly audio: Uint8Array;
  readonly mimeType: string;
}

/**
 * Listens to one recording, works out the expenses in it, and stages them for the speaker to check (design §8).
 *
 * Writes **no transaction** and touches **no total**. The audio is handed to the speech service and then dropped:
 * it is never stored, logged, or put in an error (design §9).
 */
export class CaptureVoiceUseCase {
  constructor(
    private readonly gateways: CaptureGateways,
    private readonly speech: SpeechToText,
    private readonly parser: ExpenseParser,
    private readonly ensureMiscellaneous: EnsureMiscellaneousItemUseCase,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    /** Recordings allowed per family per month; `Infinity` for an uncapped family. */
    private readonly capPerMonth: number,
  ) {}

  async execute(command: CaptureVoiceCommand): Promise<CaptureBatch> {
    assertCan(command.actor, 'record_expense');
    const familyId = command.actor.familyId;
    const family = await this.gateways.families.findById(familyId);
    if (!family) throw new InvalidFamilyCommandError('Your family was not found');

    const today = todayIn(family.timeZone, this.clock.now());
    const period = periodOf(today);

    // Checked before the audio goes anywhere, so reaching the cap costs nothing.
    const { voiceCount } = await this.gateways.usage.countThisMonth(familyId, period);
    if (voiceCount >= this.capPerMonth) {
      throw new CaptureCapReachedError("You've used this month's voice notes. You can still type an expense.");
    }

    const heard = await this.speech.transcribe(command.audio, command.mimeType, { languages: CAPTURE_LANGUAGES });
    // From here on the audio is not referenced again, so nothing below can store or leak it.

    await this.ensureMiscellaneous.execute({ familyId, actorId: command.actor.userId });
    const context = await this.contextFor(family, today);
    const parsed = await this.parser.parse(heard.text, context);
    if (parsed.length === 0) throw new CaptureNotUnderstoodError("Couldn't find any expenses in that recording");

    const entries: CaptureEntry[] = parsed.map((entry) => ({ ...entry, id: this.ids.next(), dropped: false }));
    const batch: CaptureBatch = {
      id: this.ids.next(),
      familyId,
      createdBy: command.actor.userId,
      transcript: heard.text,
      sttModel: heard.model,
      parseModel: this.parser.model,
      entries,
      createdAt: this.clock.now(),
      resolvedAt: null,
    };

    await this.gateways.captures.create(batch);
    await this.gateways.usage.record(familyId, period, heard.seconds);
    return batch;
  }

  /**
   * The family's live lists, and nothing else: this month's spendable items and this year's **open** bills, with
   * what has been paid on each. A bill that is already done or cancelled is left out, so voice cannot pay it twice.
   */
  private async contextFor(family: Family, today: IsoDate): Promise<ParseContext> {
    const familyId = family.id;
    const [groups, items] = await Promise.all([
      this.gateways.plan.listGroups(familyId),
      this.gateways.plan.listItems(familyId, { includeArchived: false }),
    ]);
    const groupName = new Map(groups.map((group) => [group.id, group.name]));

    const { year } = periodOf(today);
    const yearPlan = await this.gateways.yearPlans.findByYear(familyId, year);
    const paid = yearPlan ? await this.gateways.yearPaid.paidByLine(familyId, year) : new Map<string, number>();

    return {
      items: items
        .filter((item) => item.kind === 'monthly')
        .map((item) => ({ id: item.id, name: item.name, group: groupName.get(item.groupId) ?? '' })),
      yearLines: (yearPlan?.lines ?? [])
        .filter((line) => line.state === 'open')
        .map((line) => ({
          id: line.id,
          name: line.name,
          plannedMinor: line.plannedMinor,
          paidMinor: paid.get(line.id) ?? 0,
          dueMonth: line.dueMonth,
        })),
      today,
      currencyCode: family.currencyCode,
      minorUnits: family.minorUnit,
    };
  }
}

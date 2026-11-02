import type { FamilyGateway } from '../../family';
import { assertCan, type Clock, periodOf, sumMinor, todayIn } from '../../shared';
import { YearPlanNotFoundError } from '../errors';
import { type GetYearPlanCommand, remainingMinor, yearLineStatus, type YearLineView, type YearPlanView, yearTotalMinor } from '../models';
import type { YearPaidGateway, YearPlanGateway } from '../ports';
import type { EnsureYearPlanUseCase } from './ensure-year-plan';

/**
 * The year view: every line with paid, remaining and status for this month in the family's time zone.
 * The current year's plan is created on first use; other years must already exist (next year's is made on 1 December).
 */
export class GetYearPlanUseCase {
  constructor(
    private readonly ensure: EnsureYearPlanUseCase,
    private readonly yearPlans: YearPlanGateway,
    private readonly paid: YearPaidGateway,
    private readonly families: FamilyGateway,
    private readonly clock: Clock,
  ) {}

  async execute(command: GetYearPlanCommand): Promise<YearPlanView> {
    assertCan(command.actor, 'read');
    const familyId = command.actor.familyId;
    const family = await this.families.findById(familyId);
    if (!family) throw new YearPlanNotFoundError('Your family was not found');
    const current = periodOf(todayIn(family.timeZone, this.clock.now()));

    const plan =
      command.year === current.year
        ? await this.ensure.execute({ familyId, year: command.year })
        : await this.yearPlans.findByYear(familyId, command.year);
    if (!plan) throw new YearPlanNotFoundError(`There is no plan for ${command.year} yet`);

    const paidByLine = await this.paid.paidByLine(familyId, plan.year);
    const lines: YearLineView[] = plan.lines.map((line) => {
      const paidMinor = paidByLine.get(line.id) ?? 0;
      return { ...line, paidMinor, remainingMinor: remainingMinor(line, paidMinor), status: yearLineStatus(line, paidMinor, current) };
    });

    return {
      year: plan.year,
      firstYearCheckDone: plan.firstYearCheckAt !== null,
      lines,
      undatedRemainingMinor: sumMinor(lines.filter((l) => l.dueMonth === null && l.dueYear === plan.year).map((l) => l.remainingMinor)),
      totalMinor: yearTotalMinor(plan.lines),
    };
  }
}

import type { CaptureGateway } from '../../capture/ports';
import type { GetMonthSummaryUseCase, MonthStatusGateway } from '../../month-budget';
import type { GetChecklistUseCase } from '../../pot';
import { addMonths, assertCan } from '../../shared';
import type { GetYearEndReviewUseCase, YearPlanGateway } from '../../year-plan';
import { biggestMonthAhead } from '../biggest-month';
import type { ForecastCommand, HomeCard, HomeSummary } from '../models';
import type { GetForecastUseCase } from './get-forecast';

/**
 * Home: the pot (balance, safe to spend, the first short month), the next three months of bills, this month's
 * spending, and which cards to show: the month review while last month is open, next year's bills in December until
 * confirmed, and last year's open bills until each is answered.
 */
export class GetHomeSummaryUseCase {
  constructor(
    private readonly forecast: GetForecastUseCase,
    private readonly checklist: GetChecklistUseCase,
    private readonly monthSummary: GetMonthSummaryUseCase,
    private readonly months: MonthStatusGateway,
    private readonly yearPlans: YearPlanGateway,
    private readonly yearEnd: GetYearEndReviewUseCase,
    private readonly captures: CaptureGateway,
  ) {}

  async execute(command: ForecastCommand): Promise<HomeSummary> {
    assertCan(command.actor, 'read');
    const forecast = await this.forecast.execute(command);
    const current = forecast.months[0]!.period;
    const [checklist, month, lastMonth, nextYear, lastYear, waitingNotes] = await Promise.all([
      this.checklist.execute({ actor: command.actor, period: current }),
      this.monthSummary.execute({ actor: command.actor, period: current }),
      this.months.statusOf(command.actor.familyId, addMonths(current, -1)),
      current.month === 12 ? this.yearPlans.findByYear(command.actor.familyId, current.year + 1) : undefined,
      this.yearEnd.execute({ actor: command.actor, year: current.year - 1 }),
      this.captures.listWaiting(command.actor.familyId),
    ]);

    const red = forecast.months.find((m) => m.endMinor < 0);
    const cards: HomeCard[] = [];
    if (checklist.pot.status === 'pending' || checklist.savings.some((s) => s.status === 'pending')) cards.push('checklist');
    if (forecast.undated.some((u) => u.count > 0)) cards.push('undated');
    if (waitingNotes.length > 0) cards.push('capture');
    if (lastMonth === 'active') cards.push('month_review');
    if (nextYear && nextYear.nextYearReviewedAt === null) cards.push('next_year');
    if (lastYear.lines.length > 0) cards.push('year_end');

    return {
      pot: {
        balanceMinor: forecast.balanceMinor,
        safeToSpendNowMinor: forecast.safeToSpendNowMinor,
        firstRed: red ? { period: red.period, shortfallMinor: -red.endMinor } : null,
        fixPerMonthMinor: forecast.fixPerMonthMinor,
        setAsideMinor: forecast.months[1]!.inMinor,
        allCovered: forecast.redMonths.length === 0,
        topUpNowMinor: forecast.topUpNowMinor,
      },
      next3Months: forecast.bills.slice(0, 3).map((bills, i) => ({ ...bills, endMinor: forecast.months[i]!.endMinor })),
      biggestAhead: biggestMonthAhead(forecast.months, forecast.bills),
      thisMonth: {
        plannedMinor: month.totals.plannedMinor,
        actualMinor: month.totals.actualMinor,
        groupsOver: month.groups.filter((g) => g.varianceMinor > 0).map((g) => g.groupName),
        groups: month.groups.map((g) => ({ groupName: g.groupName, plannedMinor: g.plannedMinor, actualMinor: g.actualMinor })),
      },
      undated: forecast.undated,
      cards,
      checklist,
    };
  }
}

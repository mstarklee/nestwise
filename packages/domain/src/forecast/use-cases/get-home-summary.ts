import type { GetMonthSummaryUseCase } from '../../month-budget';
import type { GetChecklistUseCase } from '../../pot';
import { assertCan } from '../../shared';
import type { ForecastCommand, HomeCard, HomeSummary } from '../models';
import type { GetForecastUseCase } from './get-forecast';

/**
 * Home: the pot (balance, safe to spend, the first short month), the next three months of bills, this month's
 * spending, and which cards to show. The month-review card arrives with the month-end review (Stage 1b).
 */
export class GetHomeSummaryUseCase {
  constructor(
    private readonly forecast: GetForecastUseCase,
    private readonly checklist: GetChecklistUseCase,
    private readonly monthSummary: GetMonthSummaryUseCase,
  ) {}

  async execute(command: ForecastCommand): Promise<HomeSummary> {
    assertCan(command.actor, 'read');
    const forecast = await this.forecast.execute(command);
    const current = forecast.months[0]!.period;
    const [checklist, month] = await Promise.all([
      this.checklist.execute({ actor: command.actor, period: current }),
      this.monthSummary.execute({ actor: command.actor, period: current }),
    ]);

    const red = forecast.months.find((m) => m.endMinor < 0);
    const cards: HomeCard[] = [];
    if (checklist.pot.status === 'pending' || checklist.savings.some((s) => s.status === 'pending')) cards.push('checklist');
    if (forecast.undated.some((u) => u.count > 0)) cards.push('undated');

    return {
      pot: {
        balanceMinor: forecast.balanceMinor,
        safeToSpendNowMinor: forecast.safeToSpendNowMinor,
        firstRed: red ? { period: red.period, shortfallMinor: -red.endMinor } : null,
        fixPerMonthMinor: forecast.fixPerMonthMinor,
      },
      next3Months: forecast.bills.slice(0, 3),
      thisMonth: {
        plannedMinor: month.totals.plannedMinor,
        actualMinor: month.totals.actualMinor,
        groupsOver: month.groups.filter((g) => g.varianceMinor > 0).map((g) => g.groupName),
      },
      undated: forecast.undated,
      cards,
    };
  }
}

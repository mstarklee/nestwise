import type { CaptureGateway } from '../../capture/ports';
import type { ActualsGateway, GetMonthSummaryUseCase, MonthStatusGateway, MonthSummary } from '../../month-budget';
import type { PlanGateway } from '../../plan';
import type { GetChecklistUseCase } from '../../pot';
import { addMonths, assertCan, type IsoDate, sumMinor } from '../../shared';
import type { GetYearEndReviewUseCase, YearPlanGateway } from '../../year-plan';
import { biggestMonthAhead } from '../biggest-month';
import type { ForecastBills, ForecastCommand, HomeBill, HomeBills, HomeCard, HomeSummary } from '../models';
import type { GetForecastUseCase } from './get-forecast';

/**
 * Home: this month first (planned and paid, and each bill with done or not done: the monthly items marked as bills
 * and the yearly bills due now), then what is set aside, then what is coming (the pot, the three months after this
 * one, the biggest month). Also which cards to show: the month review while last month is open, next year's bills in
 * December until confirmed, and last year's open bills until each is answered.
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
    private readonly plan: PlanGateway,
    private readonly actuals: ActualsGateway,
  ) {}

  async execute(command: ForecastCommand): Promise<HomeSummary> {
    assertCan(command.actor, 'read');
    const familyId = command.actor.familyId;
    const forecast = await this.forecast.execute(command);
    const current = forecast.months[0]!.period;
    const [checklist, month, lastMonth, nextYear, lastYear, waitingNotes, items, paidOn] = await Promise.all([
      this.checklist.execute({ actor: command.actor, period: current }),
      this.monthSummary.execute({ actor: command.actor, period: current }),
      this.months.statusOf(familyId, addMonths(current, -1)),
      current.month === 12 ? this.yearPlans.findByYear(familyId, current.year + 1) : undefined,
      this.yearEnd.execute({ actor: command.actor, year: current.year - 1 }),
      this.captures.listWaiting(familyId),
      this.plan.listItems(familyId, { includeArchived: true }),
      this.actuals.lastDateByItem(familyId, current),
    ]);

    const red = forecast.months.find((m) => m.endMinor < 0);
    const cards: HomeCard[] = [];
    if (checklist.pot.status === 'pending' || checklist.savings.some((s) => s.status === 'pending')) cards.push('checklist');
    if (forecast.undated.some((u) => u.count > 0)) cards.push('undated');
    if (waitingNotes.length > 0) cards.push('capture');
    if (lastMonth === 'active') cards.push('month_review');
    if (nextYear && nextYear.nextYearReviewedAt === null) cards.push('next_year');
    if (lastYear.lines.length > 0) cards.push('year_end');

    const billItems = new Set(items.filter((i) => i.isBill && i.kind === 'monthly').map((i) => i.id));
    const bills = billsThisMonth(month, billItems, forecast.bills[0]!, paidOn);
    const yearly = bills.lines.filter((b) => b.kind === 'yearly');

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
      comingMonths: forecast.bills.slice(1, 4).map((b, i) => ({ ...b, endMinor: forecast.months[i + 1]!.endMinor })),
      biggestAhead: biggestMonthAhead(forecast.months, forecast.bills),
      thisMonth: {
        plannedMinor: month.totals.plannedMinor + sumMinor(yearly.map((b) => b.plannedMinor)),
        paidMinor: month.totals.actualMinor + sumMinor(yearly.map((b) => b.paidMinor)),
        monthlyPlannedMinor: month.totals.plannedMinor,
        monthlyActualMinor: month.totals.actualMinor,
        bills,
        groupsOver: month.groups.filter((g) => g.varianceMinor > 0).map((g) => g.groupName),
        groups: month.groups.map((g) => ({ groupName: g.groupName, plannedMinor: g.plannedMinor, actualMinor: g.actualMinor })),
      },
      undated: forecast.undated,
      cards,
      checklist,
    };
  }
}

const ORDER: Record<HomeBill['state'], number> = { to_pay: 0, paid: 1, not_this_month: 2 };

/**
 * This month's bills (design 2026-11-08 §3). A monthly bill is paid once anything is spent on it this month, and
 * "not this month" when this month plans ₹0 for it. A yearly bill is paid when its line is.
 */
function billsThisMonth(month: MonthSummary, billItems: ReadonlySet<string>, yearly: ForecastBills, paidOn: ReadonlyMap<string, IsoDate>): HomeBills {
  const monthly: HomeBill[] = month.lines
    .filter((l) => billItems.has(l.itemId))
    .map((l) => {
      const state = l.actualMinor > 0 ? 'paid' : l.plannedMinor === 0 ? 'not_this_month' : 'to_pay';
      return {
        kind: 'monthly',
        itemId: l.itemId,
        yearLineId: null,
        planYear: null,
        name: l.name,
        plannedMinor: l.plannedMinor,
        paidMinor: l.actualMinor,
        toPayMinor: state === 'to_pay' ? l.plannedMinor : 0,
        paidOn: l.actualMinor > 0 ? (paidOn.get(l.itemId) ?? null) : null,
        state,
        overdue: false,
      };
    });
  const dueNow: HomeBill[] = yearly.lines.map((l) => {
    const paid = l.status === 'paid';
    return {
      kind: 'yearly',
      itemId: l.itemId,
      yearLineId: l.yearLineId,
      planYear: l.planYear,
      name: l.name,
      plannedMinor: l.plannedMinor,
      paidMinor: l.paidMinor,
      toPayMinor: paid ? 0 : l.remainingMinor,
      paidOn: paid ? (paidOn.get(l.itemId) ?? null) : null,
      state: paid ? 'paid' : 'to_pay',
      overdue: l.status === 'overdue',
    };
  });
  // Still to pay leads with the yearly bills (larger, once a year); paid ones keep plan order, monthly first.
  const toPay = [...dueNow.filter((b) => b.state === 'to_pay'), ...monthly.filter((b) => b.state === 'to_pay')];
  const rest = [...monthly, ...dueNow].filter((b) => b.state !== 'to_pay').sort((a, b) => ORDER[a.state] - ORDER[b.state]);
  const lines = [...toPay, ...rest];
  const counted = lines.filter((b) => b.state !== 'not_this_month');
  return {
    lines,
    count: counted.length,
    paidCount: counted.filter((b) => b.state === 'paid').length,
    toPayMinor: sumMinor(toPay.map((b) => b.toPayMinor)),
  };
}

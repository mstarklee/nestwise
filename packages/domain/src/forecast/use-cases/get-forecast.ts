import { type FamilyGateway, NotAMemberError } from '../../family';
import { assembleTemplates, type PlanGateway } from '../../plan';
import { type PotGateway, potBalance, setAsideFor } from '../../pot';
import { addMonths, assertCan, type Clock, comparePeriods, type Period, periodOf, sumMinor, todayIn } from '../../shared';
import {
  remainingMinor,
  type YearLine,
  type YearLineStatus,
  yearLineStatus,
  type YearPaidGateway,
  type YearPlanGateway,
  yearTotalMinor,
} from '../../year-plan';
import {
  type ForecastBillLine,
  type ForecastBills,
  type ForecastCommand,
  type ForecastMonthInput,
  type ForecastView,
  projectPot,
  type UndatedSummary,
} from '../models';

/** A year line with what is still owed and its status this month; estimate lines come from the template. */
interface CountedLine {
  readonly line: YearLine;
  readonly estimate: boolean;
  readonly remainingMinor: number;
  readonly status: YearLineStatus;
}

const MONTHS = 12;
const isOpenBill = (c: CountedLine) => c.line.state !== 'cancelled' && c.line.state !== 'before_nestwise';
const dueIn = (c: CountedLine, p: Period) => c.line.dueMonth !== null && c.line.dueYear === p.year && c.line.dueMonth === p.month;

/**
 * The 12-month pot forecast from this month (TRD §5.5): set-asides in, yearly bills still owed out. Years without a
 * plan use the yearly template and are flagged `estimate`. Unpaid dated bills from earlier months count once, now.
 */
export class GetForecastUseCase {
  constructor(
    private readonly families: FamilyGateway,
    private readonly pot: PotGateway,
    private readonly yearPlans: YearPlanGateway,
    private readonly paid: YearPaidGateway,
    private readonly plan: PlanGateway,
    private readonly clock: Clock,
  ) {}

  async execute(command: ForecastCommand): Promise<ForecastView> {
    assertCan(command.actor, 'read');
    const familyId = command.actor.familyId;
    const family = await this.families.findById(familyId);
    if (!family) throw new NotAMemberError('Your family was not found');
    const current = periodOf(todayIn(family.timeZone, this.clock.now()));
    const periods = Array.from({ length: MONTHS }, (_, i) => addMonths(current, i));
    const windowYears = [...new Set(periods.map((p) => p.year))];

    const [totals, yearlySpend, deposit, skips, groups, items, templateLines] = await Promise.all([
      this.pot.entryTotals(familyId),
      this.pot.yearlySpendMinor(familyId),
      this.pot.findDeposit(familyId, current),
      this.pot.listSkips(familyId, current),
      this.plan.listGroups(familyId),
      this.plan.listItems(familyId, { includeArchived: false }),
      this.plan.listTemplateLines(familyId),
    ]);
    const templates = assembleTemplates(groups, items, templateLines);

    // Real plans for last year (its unpaid bills may still be overdue) and every year in the window.
    const lines: CountedLine[] = [];
    const yearTotal = new Map<number, number>();
    const estimateYears = new Set<number>();
    const plannedYears: number[] = [];
    for (const year of [current.year - 1, ...windowYears]) {
      const plan = await this.yearPlans.findByYear(familyId, year);
      if (plan) {
        plannedYears.push(year);
        yearTotal.set(year, yearTotalMinor(plan.lines));
        const paidByLine = await this.paid.paidByLine(familyId, year);
        for (const line of plan.lines) {
          const paidMinor = paidByLine.get(line.id) ?? 0;
          lines.push({ line, estimate: false, remainingMinor: remainingMinor(line, paidMinor), status: yearLineStatus(line, paidMinor, current) });
        }
      } else if (year >= current.year) {
        estimateYears.add(year);
        yearTotal.set(year, templates.totals.yearly);
        for (const e of templates.yearly) {
          const line: YearLine = {
            id: '',
            familyId,
            year,
            itemId: e.itemId,
            name: e.name,
            plannedMinor: e.amountMinor,
            dueYear: year,
            dueMonth: e.dueMonth,
            dueDay: e.dueDay,
            state: 'open',
          };
          lines.push({ line, estimate: true, remainingMinor: line.plannedMinor, status: yearLineStatus(line, 0, current) });
        }
      }
    }

    const overdue = lines.filter(
      (c) => !c.estimate && c.line.dueMonth !== null && comparePeriods({ year: c.line.dueYear, month: c.line.dueMonth }, current) < 0 && c.remainingMinor > 0,
    );
    const toBill = (c: CountedLine): ForecastBillLine => ({
      yearLineId: c.estimate ? null : c.line.id,
      name: c.line.name,
      remainingMinor: c.remainingMinor,
      status: c.status,
    });

    const months: ForecastMonthInput[] = periods.map((period) => ({
      period,
      setAsideMinor: setAsideFor(period.month, yearTotal.get(period.year) ?? 0, family.setAsideOverrideMinor),
      datedOutMinor: sumMinor(lines.filter((c) => dueIn(c, period)).map((c) => c.remainingMinor)),
      estimate: estimateYears.has(period.year),
    }));
    const bills: ForecastBills[] = periods.map((period, i) => ({
      period,
      lines: [...(i === 0 ? overdue : []), ...lines.filter((c) => dueIn(c, period) && isOpenBill(c))].map(toBill),
    }));

    const balanceMinor = potBalance(totals, yearlySpend);
    const projection = projectPot({
      balanceMinor,
      currentDepositSettled: deposit !== undefined || skips.some((s) => s.itemId === null),
      overdueOutMinor: sumMinor(overdue.map((c) => c.remainingMinor)),
      months,
    });

    return {
      ...projection,
      balanceMinor,
      bills,
      undated: windowYears.filter((y) => plannedYears.includes(y)).flatMap((year) => undatedFor(year, lines)),
      monthlyPlanMinor: templates.totals.monthly,
      savingsPlanMinor: templates.totals.savings,
    };
  }
}

function undatedFor(year: number, lines: readonly CountedLine[]): UndatedSummary[] {
  const open = lines.filter((c) => !c.estimate && c.line.dueMonth === null && c.line.dueYear === year && c.remainingMinor > 0);
  if (open.length === 0) return [];
  return [
    {
      year,
      totalMinor: sumMinor(open.map((c) => c.remainingMinor)),
      count: open.length,
      lines: open.map((c) => ({ yearLineId: c.line.id, name: c.line.name, remainingMinor: c.remainingMinor })),
    },
  ];
}

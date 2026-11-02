import type { FamilyGateway } from '../../family';
import type { EnsureMonthBudgetUseCase } from '../../month-budget';
import { assembleTemplates, type PlanGateway } from '../../plan';
import { assertCan } from '../../shared';
import { type YearPlanGateway, yearTotalMinor } from '../../year-plan';
import { InvalidPotCommandError } from '../errors';
import { type Checklist, type ChecklistSavingsLine, type ChecklistStatus, type GetChecklistCommand, setAsideFor } from '../models';
import type { PotGateway } from '../ports';
import { assertPeriod } from './pot-rules';

/**
 * The month's checklist (PRD §5.2): the pot deposit, suggested from that year's plan ÷ 12 (or the family's override),
 * and each savings line of the month budget, each pending, done or skipped.
 */
export class GetChecklistUseCase {
  constructor(
    private readonly ensureMonth: EnsureMonthBudgetUseCase,
    private readonly yearPlans: YearPlanGateway,
    private readonly plan: PlanGateway,
    private readonly families: FamilyGateway,
    private readonly pot: PotGateway,
  ) {}

  async execute(command: GetChecklistCommand): Promise<Checklist> {
    assertCan(command.actor, 'read');
    assertPeriod(command.period);
    const familyId = command.actor.familyId;
    const { period } = command;
    const [family, yearPlan, templateLines, budget, deposit, savings, skips] = await Promise.all([
      this.families.findById(familyId),
      this.yearPlans.findByYear(familyId, period.year),
      this.plan.listTemplateLines(familyId),
      this.ensureMonth.execute({ familyId, period }),
      this.pot.findDeposit(familyId, period),
      this.pot.listSavings(familyId, period),
      this.pot.listSkips(familyId, period),
    ]);
    if (!family) throw new InvalidPotCommandError('Your family was not found');

    const yearTotal = yearPlan ? yearTotalMinor(yearPlan.lines) : await this.templateYearTotal(familyId);
    const skipped = new Set(skips.map((s) => s.itemId));
    const status = (done: boolean, itemId: string | null): ChecklistStatus => (done ? 'done' : skipped.has(itemId) ? 'skipped' : 'pending');
    const hintOf = new Map(templateLines.map((l) => [l.itemId, l]));

    const savingsLines: ChecklistSavingsLine[] = budget.lines
      .filter((l) => l.kind === 'savings')
      .map((l) => {
        const entry = savings.find((s) => s.itemId === l.itemId);
        const t = hintOf.get(l.itemId);
        const hint = t && (t.hintMinMinor !== null || t.hintMaxMinor !== null) ? { minMinor: t.hintMinMinor, maxMinor: t.hintMaxMinor } : null;
        return {
          itemId: l.itemId,
          name: l.nameSnapshot,
          plannedMinor: l.plannedMinor,
          hint,
          status: status(entry !== undefined, l.itemId),
          confirmedMinor: entry?.amountMinor ?? null,
        };
      });

    return {
      period,
      pot: {
        suggestedMinor: setAsideFor(period.month, yearTotal, family.setAsideOverrideMinor),
        status: status(deposit !== undefined, null),
        confirmedMinor: deposit?.amountMinor ?? null,
        estimate: yearPlan === undefined,
      },
      savings: savingsLines,
    };
  }

  private async templateYearTotal(familyId: string): Promise<number> {
    const [groups, items, lines] = await Promise.all([
      this.plan.listGroups(familyId),
      this.plan.listItems(familyId, { includeArchived: false }),
      this.plan.listTemplateLines(familyId),
    ]);
    return assembleTemplates(groups, items, lines).totals.yearly;
  }
}

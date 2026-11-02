import type { ActivityGateway } from '../../src/shared';
import type { YearLine, YearPaidGateway, YearPlan, YearPlanGateway, YearPlanUnitOfWork } from '../../src/year-plan';
import { InMemoryActivityGateway } from './in-memory-activity-gateway';

const key = (familyId: string, year: number) => `${familyId}:${year}`;

export class InMemoryYearPlanGateway implements YearPlanGateway {
  rows = new Map<string, YearPlan>();

  async findByYear(familyId: string, year: number) {
    return this.rows.get(key(familyId, year));
  }
  async create(plan: YearPlan) {
    const existing = this.rows.get(key(plan.familyId, plan.year));
    if (existing) return existing; // like the adapter after a unique violation
    this.rows.set(key(plan.familyId, plan.year), plan);
    return plan;
  }
  async findLine(familyId: string, lineId: string) {
    for (const plan of this.rows.values()) {
      const line = plan.lines.find((l) => l.id === lineId && l.familyId === familyId);
      if (line) return line;
    }
    return undefined;
  }
  async saveLine(line: YearLine) {
    for (const [k, plan] of this.rows) {
      if (plan.familyId !== line.familyId || !plan.lines.some((l) => l.id === line.id)) continue;
      this.rows.set(k, { ...plan, lines: plan.lines.map((l) => (l.id === line.id ? line : l)) });
    }
  }
  async markFirstYearCheck(familyId: string, yearPlanId: string, at: Date) {
    for (const [k, plan] of this.rows) {
      if (plan.id !== yearPlanId || plan.familyId !== familyId) continue;
      if (plan.firstYearCheckAt) return false;
      this.rows.set(k, { ...plan, firstYearCheckAt: at });
      return true;
    }
    return false;
  }
  async hasFirstYearCheck(familyId: string) {
    return [...this.rows.values()].some((p) => p.familyId === familyId && p.firstYearCheckAt !== null);
  }
  count() {
    return this.rows.size;
  }
}

export class InMemoryYearPaidGateway implements YearPaidGateway {
  paid = new Map<string, Map<string, number>>();

  set(familyId: string, year: number, lineId: string, paidMinor: number) {
    const byLine = this.paid.get(key(familyId, year)) ?? new Map<string, number>();
    byLine.set(lineId, paidMinor);
    this.paid.set(key(familyId, year), byLine);
  }
  async paidByLine(familyId: string, year: number) {
    return this.paid.get(key(familyId, year)) ?? new Map<string, number>();
  }
}

export class InMemoryYearPlanUnitOfWork implements YearPlanUnitOfWork {
  constructor(
    readonly yearPlans: InMemoryYearPlanGateway,
    readonly activity = new InMemoryActivityGateway(),
  ) {}

  async run<T>(work: (gateways: { yearPlans: YearPlanGateway; activity: ActivityGateway }) => Promise<T>): Promise<T> {
    const snapshot = { rows: new Map(this.yearPlans.rows), activity: this.activity.snapshot() };
    try {
      return await work({ yearPlans: this.yearPlans, activity: this.activity });
    } catch (error) {
      this.yearPlans.rows = snapshot.rows;
      this.activity.restore(snapshot.activity);
      throw error;
    }
  }
}

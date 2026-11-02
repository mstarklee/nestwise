import type { ActivityGateway } from '../shared';
import type { YearLine, YearPlan } from './models';

/** Every method is scoped to one family. */
export interface YearPlanGateway {
  findByYear(familyId: string, year: number): Promise<YearPlan | undefined>;
  /** Creates the plan with its lines; if another request created that year first, returns that one instead. */
  create(plan: YearPlan): Promise<YearPlan>;
  findLine(familyId: string, yearLineId: string): Promise<YearLine | undefined>;
  /** Saves the line's schedule and state. */
  saveLine(line: YearLine): Promise<void>;
  /** Marks the first-year check answered; false if it already was (the guard against two taps at once). */
  markFirstYearCheck(familyId: string, yearPlanId: string, at: Date): Promise<boolean>;
  /** True once any of the family's year plans has its first-year check answered (that is, setup is finished). */
  hasFirstYearCheck(familyId: string): Promise<boolean>;
}

export interface YearPaidGateway {
  /** Paid per year-line id: confirmed, live allocations to the line's item with plan_year = year; refunds subtracted. */
  paidByLine(familyId: string, year: number): Promise<ReadonlyMap<string, number>>;
}

/** Year-plan writes plus their activity rows, all or nothing. */
export interface YearPlanUnitOfWork {
  run<T>(work: (gateways: { yearPlans: YearPlanGateway; activity: ActivityGateway }) => Promise<T>): Promise<T>;
}

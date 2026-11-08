import { z } from 'zod';

const Period = z.object({ year: z.number().int(), month: z.number().int() });
const Minor = z.number().int();
const Status = z.enum(['planned', 'due_soon', 'part_paid', 'paid', 'overdue', 'cancelled', 'before_nestwise']);

const Bills = z.object({
  period: Period,
  lines: z.array(
    z.object({
      yearLineId: z.string().nullable(),
      itemId: z.string(),
      planYear: z.number().int(),
      name: z.string(),
      plannedMinor: Minor,
      paidMinor: Minor,
      remainingMinor: Minor,
      status: Status,
    }),
  ),
});

/** One bill on Home this month: a monthly item marked as a bill, or a yearly bill due now or overdue. */
const HomeBill = z.object({
  kind: z.enum(['monthly', 'yearly']),
  itemId: z.string(),
  yearLineId: z.string().nullable(),
  planYear: z.number().int().nullable(),
  name: z.string(),
  plannedMinor: Minor,
  paidMinor: Minor,
  toPayMinor: Minor,
  paidOn: z.string().nullable(),
  state: z.enum(['to_pay', 'paid', 'not_this_month']),
  overdue: z.boolean(),
});

const ChecklistStatus = z.enum(['pending', 'done', 'skipped']);

const Undated = z.object({
  year: z.number().int(),
  totalMinor: Minor,
  count: z.number().int(),
  lines: z.array(z.object({ yearLineId: z.string(), name: z.string(), remainingMinor: Minor })),
});

export const ForecastResponse = z.object({
  balanceMinor: Minor,
  months: z.array(z.object({ period: Period, inMinor: Minor, outMinor: Minor, endMinor: Minor, estimate: z.boolean() })),
  safeToSpendNowMinor: Minor,
  redMonths: z.array(Period),
  fixPerMonthMinor: Minor.nullable(),
  topUpNowMinor: Minor.nullable(),
  bills: z.array(Bills),
  undated: z.array(Undated),
  monthlyPlanMinor: Minor,
  savingsPlanMinor: Minor,
});
export type ForecastResponse = z.infer<typeof ForecastResponse>;

export const HomeResponse = z.object({
  pot: z.object({
    balanceMinor: Minor,
    safeToSpendNowMinor: Minor,
    firstRed: z.object({ period: Period, shortfallMinor: Minor }).nullable(),
    fixPerMonthMinor: Minor.nullable(),
    setAsideMinor: Minor,
    allCovered: z.boolean(),
    topUpNowMinor: Minor.nullable(),
  }),
  /** The three months after this one. */
  comingMonths: z.array(Bills.extend({ endMinor: Minor })),
  thisMonth: z.object({
    plannedMinor: Minor,
    paidMinor: Minor,
    monthlyPlannedMinor: Minor,
    monthlyActualMinor: Minor,
    bills: z.object({ lines: z.array(HomeBill), count: z.number().int(), paidCount: z.number().int(), toPayMinor: Minor }),
    groupsOver: z.array(z.string()),
  }),
  undated: z.array(Undated),
  cards: z.array(z.enum(['checklist', 'undated', 'capture', 'month_review', 'next_year', 'year_end'])),
  checklist: z.object({
    period: Period,
    pot: z.object({ suggestedMinor: Minor, status: ChecklistStatus, confirmedMinor: Minor.nullable(), estimate: z.boolean() }),
    savings: z.array(z.object({ itemId: z.string(), name: z.string(), plannedMinor: Minor, status: ChecklistStatus, confirmedMinor: Minor.nullable() })),
  }),
});
export type HomeResponse = z.infer<typeof HomeResponse>;

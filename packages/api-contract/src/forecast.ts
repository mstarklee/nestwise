import { z } from 'zod';

const Period = z.object({ year: z.number().int(), month: z.number().int() });
const Minor = z.number().int();
const Status = z.enum(['planned', 'due_soon', 'part_paid', 'paid', 'overdue', 'cancelled', 'before_nestwise']);

const Bills = z.object({
  period: Period,
  lines: z.array(z.object({ yearLineId: z.string().nullable(), name: z.string(), remainingMinor: Minor, status: Status })),
});

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
  }),
  next3Months: z.array(Bills),
  thisMonth: z.object({ plannedMinor: Minor, actualMinor: Minor, groupsOver: z.array(z.string()) }),
  undated: z.array(Undated),
  cards: z.array(z.enum(['checklist', 'undated', 'month_review'])),
});
export type HomeResponse = z.infer<typeof HomeResponse>;

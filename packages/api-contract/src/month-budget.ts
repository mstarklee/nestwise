import { z } from 'zod';

/** "YYYY-MM" in a path → { year, month }; anything else is a 400. */
export const MonthParam = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
  .transform((ym) => ({ year: Number(ym.slice(0, 4)), month: Number(ym.slice(5, 7)) }));

export const SetMonthLineRequest = z.object({ plannedMinor: z.number().int() });
export type SetMonthLineRequest = z.infer<typeof SetMonthLineRequest>;

export const ResetMonthRequest = z.object({ mode: z.enum(['copy_previous', 'blank']) });
export type ResetMonthRequest = z.infer<typeof ResetMonthRequest>;

const Figures = {
  plannedMinor: z.number().int(),
  actualMinor: z.number().int(),
  remainingMinor: z.number().int(),
  varianceMinor: z.number().int(),
  pct: z.number().nullable(),
};

export const MonthSummaryResponse = z.object({
  period: z.object({ year: z.number().int(), month: z.number().int() }),
  status: z.enum(['draft', 'active', 'closed']),
  lines: z.array(z.object({ ...Figures, itemId: z.string(), name: z.string(), groupName: z.string() })),
  groups: z.array(z.object({ ...Figures, groupName: z.string() })),
  totals: z.object(Figures),
  savings: z.object({
    lines: z.array(z.object({ itemId: z.string(), name: z.string(), plannedMinor: z.number().int() })),
    plannedMinor: z.number().int(),
  }),
});
export type MonthSummaryResponse = z.infer<typeof MonthSummaryResponse>;

export const MonthLineResponse = z.object({
  line: z.object({ itemId: z.string(), plannedMinor: z.number().int(), nameSnapshot: z.string(), groupNameSnapshot: z.string() }),
});
export type MonthLineResponse = z.infer<typeof MonthLineResponse>;

const Answer = z.enum(['done', 'different', 'skipped', 'unanswered']);
const Line = z.object({ ...Figures, itemId: z.string(), name: z.string(), groupName: z.string() });

export const MonthReviewResponse = z.object({
  period: z.object({ year: z.number().int(), month: z.number().int() }),
  status: z.enum(['draft', 'active', 'closed']),
  totals: z.object(Figures),
  over: z.array(Line),
  under: z.array(Line),
  billsPaid: z.array(z.object({ itemId: z.string(), name: z.string(), paidMinor: z.number().int() })),
  billsUnpaid: z.array(z.object({ lineId: z.string(), name: z.string(), remainingMinor: z.number().int() })),
  potDeposit: Answer,
  savings: z.array(z.object({ itemId: z.string(), name: z.string(), plannedMinor: z.number().int(), answer: Answer, amountMinor: z.number().int().nullable() })),
  inboxCount: z.number().int(),
  streaks: z.array(z.object({ itemId: z.string(), name: z.string(), months: z.number().int(), suggestedMinor: z.number().int() })),
});
export type MonthReviewResponse = z.infer<typeof MonthReviewResponse>;

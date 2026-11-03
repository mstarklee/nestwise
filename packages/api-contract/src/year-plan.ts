import { z } from 'zod';
import { MonthParam } from './month-budget';

/** "YYYY" in a path → a number; anything else is a 400. */
export const YearParam = z
  .string()
  .regex(/^\d{4}$/)
  .transform(Number);

export const SetYearLineScheduleRequest = z.object({ dueMonth: z.number().nullable(), dueDay: z.number().nullable() });
export type SetYearLineScheduleRequest = z.infer<typeof SetYearLineScheduleRequest>;

export const FirstYearCheckRequest = z.object({
  stillToComeLineIds: z.array(z.uuid()).max(500),
  /** The month the family starts using NestWise, "YYYY-MM". */
  setupMonth: MonthParam,
});
export type FirstYearCheckRequest = z.infer<typeof FirstYearCheckRequest>;

const State = z.enum(['open', 'done', 'cancelled', 'before_nestwise']);

const Line = {
  id: z.string(),
  year: z.number().int(),
  itemId: z.string(),
  name: z.string(),
  plannedMinor: z.number().int(),
  dueYear: z.number().int(),
  dueMonth: z.number().int().nullable(),
  dueDay: z.number().int().nullable(),
  state: State,
};

export const YearLineResponse = z.object({ line: z.object(Line) });
export type YearLineResponse = z.infer<typeof YearLineResponse>;

export const YearPlanLinesResponse = z.object({ year: z.number().int(), lines: z.array(z.object(Line)) });
export type YearPlanLinesResponse = z.infer<typeof YearPlanLinesResponse>;

export const YearPlanResponse = z.object({
  year: z.number().int(),
  firstYearCheckDone: z.boolean(),
  lines: z.array(
    z.object({
      ...Line,
      paidMinor: z.number().int(),
      remainingMinor: z.number().int(),
      status: z.enum(['planned', 'due_soon', 'part_paid', 'paid', 'overdue', 'cancelled', 'before_nestwise']),
    }),
  ),
  undatedRemainingMinor: z.number().int(),
  totalMinor: z.number().int(),
});
export type YearPlanResponse = z.infer<typeof YearPlanResponse>;

export const YearEndAnswerRequest = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('done') }),
  z.object({ kind: z.literal('drop') }),
  z.object({ kind: z.literal('carry'), dueMonth: z.number().int().nullable() }),
]);
export type YearEndAnswerRequest = z.infer<typeof YearEndAnswerRequest>;

export const YearEndReviewResponse = z.object({
  year: z.number().int(),
  lines: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      plannedMinor: z.number().int(),
      paidMinor: z.number().int(),
      remainingMinor: z.number().int(),
      dueMonth: z.number().int().nullable(),
    }),
  ),
});
export type YearEndReviewResponse = z.infer<typeof YearEndReviewResponse>;

export const NextYearReviewResponse = YearPlanResponse.pick({ year: true, lines: true }).extend({ confirmed: z.boolean() });
export type NextYearReviewResponse = z.infer<typeof NextYearReviewResponse>;

export const SetYearLineAmountRequest = z.object({ plannedMinor: z.number().int() });
export type SetYearLineAmountRequest = z.infer<typeof SetYearLineAmountRequest>;

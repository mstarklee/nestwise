import { z } from 'zod';
import { MonthParam } from './month-budget';

const Period = z.object({ year: z.number().int(), month: z.number().int() });

export const ConfirmPotDepositRequest = z.object({ period: MonthParam, amountMinor: z.number().int() });
export type ConfirmPotDepositRequest = z.infer<typeof ConfirmPotDepositRequest>;

export const ConfirmSavingsRequest = z.object({ period: MonthParam, itemId: z.uuid(), amountMinor: z.number().int() });
export type ConfirmSavingsRequest = z.infer<typeof ConfirmSavingsRequest>;

/** itemId null skips the pot deposit. */
export const SkipChecklistItemRequest = z.object({ period: MonthParam, itemId: z.uuid().nullable() });
export type SkipChecklistItemRequest = z.infer<typeof SkipChecklistItemRequest>;

export const RecordPotMovementRequest = z.object({
  kind: z.enum(['extra_in', 'taken_out']),
  amountMinor: z.number().int(),
  note: z.string().max(1000).nullable(),
});
export type RecordPotMovementRequest = z.infer<typeof RecordPotMovementRequest>;

export const PotEntryResponse = z.object({
  entry: z.object({
    id: z.string(),
    kind: z.enum(['opening', 'deposit', 'extra_in', 'taken_out']),
    amountMinor: z.number().int(),
    entryDate: z.string(),
    period: Period,
    note: z.string().nullable(),
  }),
});
export type PotEntryResponse = z.infer<typeof PotEntryResponse>;

export const SavingsEntryResponse = z.object({
  entry: z.object({ id: z.string(), itemId: z.string(), period: Period, amountMinor: z.number().int() }),
});
export type SavingsEntryResponse = z.infer<typeof SavingsEntryResponse>;

export const ChecklistSkipResponse = z.object({ skip: z.object({ id: z.string(), itemId: z.string().nullable(), period: Period }) });
export type ChecklistSkipResponse = z.infer<typeof ChecklistSkipResponse>;

const Status = z.enum(['pending', 'done', 'skipped']);

export const ChecklistResponse = z.object({
  period: Period,
  pot: z.object({ suggestedMinor: z.number().int(), status: Status, confirmedMinor: z.number().int().nullable(), estimate: z.boolean() }),
  savings: z.array(
    z.object({
      itemId: z.string(),
      name: z.string(),
      plannedMinor: z.number().int(),
      hint: z.object({ minMinor: z.number().int().nullable(), maxMinor: z.number().int().nullable() }).nullable(),
      status: Status,
      confirmedMinor: z.number().int().nullable(),
    }),
  ),
});
export type ChecklistResponse = z.infer<typeof ChecklistResponse>;

export const PotBalanceResponse = z.object({ balanceMinor: z.number().int() });
export type PotBalanceResponse = z.infer<typeof PotBalanceResponse>;

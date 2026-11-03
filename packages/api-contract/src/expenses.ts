import { z } from 'zod';
import { MonthParam } from './month-budget';

/** "YYYY-MM-DD"; whether it is a real date is the domain's check. */
const IsoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Text = z.string().max(1000).nullish();

const AllocationRequest = z.object({ itemId: z.uuid(), amountMinor: z.number().int(), planYear: z.number().int().nullish() });

export const RecordExpenseRequest = z.object({
  id: z.uuid(),
  kind: z.enum(['expense', 'refund']).optional(),
  amountMinor: z.number().int(),
  txnDate: IsoDateString.optional(),
  allocations: z.array(AllocationRequest).max(50),
  merchant: Text,
  note: Text,
  paidBy: z.uuid().nullish(),
});
export type RecordExpenseRequest = z.infer<typeof RecordExpenseRequest>;

export const EditExpenseRequest = z.object({
  amountMinor: z.number().int().optional(),
  txnDate: IsoDateString.optional(),
  allocations: z.array(AllocationRequest).max(50).optional(),
  merchant: Text,
  note: Text,
  paidBy: z.uuid().nullish(),
});
export type EditExpenseRequest = z.infer<typeof EditExpenseRequest>;

export const ListExpensesQuery = z.object({ month: MonthParam, itemId: z.uuid().optional(), enteredBy: z.uuid().optional() });
export type ListExpensesQuery = z.infer<typeof ListExpensesQuery>;

export const Transaction = z.object({
  id: z.string(),
  kind: z.enum(['expense', 'refund']),
  amountMinor: z.number().int(),
  currencyCode: z.string(),
  txnDate: z.string(),
  period: z.object({ year: z.number().int(), month: z.number().int() }),
  merchant: z.string().nullable(),
  note: z.string().nullable(),
  enteredBy: z.string(),
  paidBy: z.string().nullable(),
  captureMethod: z.enum(['typed', 'voice', 'receipt']),
  status: z.enum(['pending', 'confirmed']),
  mergedInto: z.string().nullable(),
  allocations: z.array(z.object({ itemId: z.string(), amountMinor: z.number().int(), planYear: z.number().int().nullable() })),
  deletedAt: z.date().nullable(),
  createdAt: z.date(),
});

export const TransactionResponse = z.object({ transaction: Transaction });

/** POST /transactions: the saved expense, and the "Same purchase?" question when it may repeat another. */
export const RecordExpenseResponse = z.object({
  transaction: Transaction,
  duplicate: z.object({ matchId: z.string(), other: Transaction }).nullable(),
});
export type RecordExpenseResponse = z.infer<typeof RecordExpenseResponse>;
export type TransactionResponse = z.infer<typeof TransactionResponse>;

export const TransactionListResponse = z.object({ transactions: z.array(Transaction) });
export type TransactionListResponse = z.infer<typeof TransactionListResponse>;

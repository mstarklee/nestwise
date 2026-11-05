import { z } from 'zod';

/** "YYYY-MM-DD"; whether it is a real date is the domain's check. */
const IsoDateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Text = z.string().max(1000).nullable();

const Confidence = z.object({ amount: z.number().min(0).max(1), item: z.number().min(0).max(1) });

/** One heard expense on the review screen. `amountMinor` is null when it was not clearly heard — never invented. */
export const CaptureEntryResponse = z.object({
  id: z.uuid(),
  amountMinor: z.number().int().positive().nullable(),
  itemId: z.uuid().nullable(),
  yearLineId: z.uuid().nullable(),
  kind: z.enum(['expense', 'yearly_bill']),
  txnDate: IsoDateString,
  merchant: Text,
  note: z.string(),
  heard: z.string(),
  confidence: Confidence,
  dropped: z.boolean(),
  /** Whether the screen must highlight this row and refuse to add it unchecked. */
  needsAttention: z.boolean(),
});
export type CaptureEntryResponse = z.infer<typeof CaptureEntryResponse>;

export const CaptureBatchResponse = z.object({
  batch: z.object({
    id: z.uuid(),
    createdBy: z.uuid(),
    transcript: z.string(),
    entries: z.array(CaptureEntryResponse),
    createdAt: z.string(),
  }),
});
export type CaptureBatchResponse = z.infer<typeof CaptureBatchResponse>;

/** What the review screen sends back: the rows as the person left them, dropped ones included. */
export const ConfirmCaptureRequest = z.object({
  entries: z
    .array(
      z.object({
        id: z.uuid(),
        amountMinor: z.number().int().positive(),
        itemId: z.uuid().nullable(),
        yearLineId: z.uuid().nullable(),
        kind: z.enum(['expense', 'yearly_bill']),
        txnDate: IsoDateString,
        merchant: Text,
        note: z.string().max(1000),
        paidBy: z.uuid().nullable(),
        dropped: z.boolean(),
      }),
    )
    .max(50),
});
export type ConfirmCaptureRequest = z.infer<typeof ConfirmCaptureRequest>;

import { z } from 'zod';
import { Transaction } from './expenses';

export const ResolveDuplicateRequest = z.object({ answer: z.enum(['same', 'different']), keepId: z.uuid().optional() });
export type ResolveDuplicateRequest = z.infer<typeof ResolveDuplicateRequest>;

const DuplicateReason = z.enum(['other_person', 'other_method', 'same_shop']);

export const InboxResponse = z.object({
  entries: z.array(z.object({ matchId: z.string(), pending: Transaction, other: Transaction, reasons: z.array(DuplicateReason) })),
  /** Spoken notes still to be checked. Only their speaker may confirm one, which `mine` says. */
  voiceNotes: z.array(
    z.object({
      batchId: z.uuid(),
      createdBy: z.uuid(),
      mine: z.boolean(),
      transcript: z.string(),
      entryCount: z.number().int().nonnegative(),
      createdAt: z.string(),
    }),
  ),
});
export type InboxResponse = z.infer<typeof InboxResponse>;

import { z } from 'zod';

export const ActivityQuery = z.object({
  before: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});
export type ActivityQuery = z.infer<typeof ActivityQuery>;

export const ActivityResponse = z.object({
  rows: z.array(
    z.object({
      id: z.number().int(),
      actorId: z.string(),
      actorEmail: z.string(),
      action: z.string(),
      entityType: z.string(),
      entityId: z.string(),
      before: z.unknown(),
      after: z.unknown(),
      at: z.date(),
      lateEdit: z.boolean(),
    }),
  ),
  nextBefore: z.number().int().nullable(),
});
export type ActivityResponse = z.infer<typeof ActivityResponse>;

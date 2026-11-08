import { z } from 'zod';
import { MonthParam } from './month-budget';

/** Shape only; the template rules (≥ 0, due fields only on yearly items) live in the domain. */
export const TemplateFieldsRequest = z.object({
  amountMinor: z.number().int(),
  dueMonth: z.number().int().nullish(),
  dueDay: z.number().int().nullish(),
  hintMinMinor: z.number().int().nullish(),
  hintMaxMinor: z.number().int().nullish(),
});

export const AddItemRequest = TemplateFieldsRequest.extend({ groupId: z.uuid(), name: z.string().max(400), isBill: z.boolean().optional() });
export type AddItemRequest = z.infer<typeof AddItemRequest>;

export const UpdateItemRequest = z.object({
  name: z.string().max(400).optional(),
  template: TemplateFieldsRequest.optional(),
  isBill: z.boolean().optional(),
  /** Months after this one that also take the new amount (PRD §6.2), as "YYYY-MM". */
  applyToMonths: z.array(MonthParam).max(24).optional(),
});
export type UpdateItemRequest = z.infer<typeof UpdateItemRequest>;

export const ReorderItemsRequest = z.object({ itemIds: z.array(z.uuid()).max(500) });
export type ReorderItemsRequest = z.infer<typeof ReorderItemsRequest>;

/** A path id; anything that is not a UUID is a 400, not a database error. */
export const IdParam = z.uuid();

const Kind = z.enum(['monthly', 'yearly', 'savings']);

export const ItemResponse = z.object({
  item: z.object({
    id: z.string(),
    groupId: z.string(),
    kind: Kind,
    name: z.string(),
    sort: z.number().int(),
    archived: z.boolean(),
    seedKey: z.string().nullable(),
    isBill: z.boolean(),
  }),
});
export type ItemResponse = z.infer<typeof ItemResponse>;

const TemplateEntry = z.object({
  itemId: z.string(),
  seedKey: z.string().nullable(),
  isBill: z.boolean(),
  name: z.string(),
  groupId: z.string(),
  groupName: z.string(),
  amountMinor: z.number().int(),
  dueMonth: z.number().int().nullable(),
  dueDay: z.number().int().nullable(),
  hintMinMinor: z.number().int().nullable(),
  hintMaxMinor: z.number().int().nullable(),
});

export const TemplatesResponse = z.object({
  monthly: z.array(TemplateEntry),
  savings: z.array(TemplateEntry),
  yearly: z.array(TemplateEntry),
  totals: z.object({ monthly: z.number().int(), savings: z.number().int(), yearly: z.number().int() }),
});
export type TemplatesResponse = z.infer<typeof TemplatesResponse>;

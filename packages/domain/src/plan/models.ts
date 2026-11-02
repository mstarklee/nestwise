import { type Actor, sumMinor } from '../shared';
import { InvalidPlanCommandError } from './errors';

export type ItemKind = 'monthly' | 'yearly' | 'savings';
export const ITEM_KINDS: readonly ItemKind[] = ['monthly', 'yearly', 'savings'];

export interface Group {
  readonly id: string;
  readonly familyId: string;
  readonly kind: ItemKind;
  readonly name: string;
  readonly sort: number;
  readonly archived: boolean;
}

/** The stable identity of a budget item across every month and year. */
export interface Item {
  readonly id: string;
  readonly familyId: string;
  readonly groupId: string;
  readonly kind: ItemKind;
  readonly name: string;
  readonly sort: number;
  readonly archived: boolean;
  readonly seedKey: string | null;
}

/** One per item: this is the template. Due fields apply to yearly items only. */
export interface TemplateLine {
  readonly itemId: string;
  readonly amountMinor: number;
  readonly dueMonth: number | null;
  readonly dueDay: number | null;
  readonly hintMinMinor: number | null;
  readonly hintMaxMinor: number | null;
}

/** The amount and schedule fields an item's template line can carry. */
export interface TemplateFields {
  readonly amountMinor: number;
  readonly dueMonth?: number | null;
  readonly dueDay?: number | null;
  readonly hintMinMinor?: number | null;
  readonly hintMaxMinor?: number | null;
}

export interface PlanImportItem extends TemplateFields {
  readonly key: string;
  readonly name: string;
}

export interface PlanImportGroup {
  readonly key: string;
  readonly kind: ItemKind;
  readonly name: string;
  readonly items: readonly PlanImportItem[];
}

export interface PlanImport {
  readonly groups: readonly PlanImportGroup[];
}

export interface TemplateEntry extends TemplateLine {
  readonly seedKey: string | null;
  readonly name: string;
  readonly groupId: string;
  readonly groupName: string;
}

export interface Templates {
  readonly monthly: readonly TemplateEntry[];
  readonly savings: readonly TemplateEntry[];
  readonly yearly: readonly TemplateEntry[];
  readonly totals: { readonly monthly: number; readonly savings: number; readonly yearly: number };
}

export interface ImportPlanCommand {
  readonly actor: Actor;
  readonly plan: PlanImport;
}

export interface GetTemplatesCommand {
  readonly actor: Actor;
}

export interface AddItemCommand extends TemplateFields {
  readonly actor: Actor;
  readonly groupId: string;
  readonly name: string;
}

export interface UpdateItemCommand {
  readonly actor: Actor;
  readonly itemId: string;
  readonly name?: string;
  readonly template?: TemplateFields;
}

export interface ArchiveItemCommand {
  readonly actor: Actor;
  readonly itemId: string;
}

export interface ReorderItemsCommand {
  readonly actor: Actor;
  readonly groupId: string;
  /** Every live item of the group, in the new order. */
  readonly itemIds: readonly string[];
}

const MAX_NAME = 80;

export function checkName(input: string, what: string): string {
  const name = input.trim();
  const length = [...name].length;
  if (length < 1 || length > MAX_NAME) throw new InvalidPlanCommandError(`The ${what} name must be 1–${MAX_NAME} characters`);
  return name;
}

const isAmount = (value: number | null | undefined) => value == null || (Number.isSafeInteger(value) && value >= 0);

/** The template rules: amounts ≥ 0 in whole minor units; due month/day only on yearly items, in range. */
export function toTemplateLine(itemId: string, kind: ItemKind, fields: TemplateFields): TemplateLine {
  const dueMonth = fields.dueMonth ?? null;
  const dueDay = fields.dueDay ?? null;
  const hintMinMinor = fields.hintMinMinor ?? null;
  const hintMaxMinor = fields.hintMaxMinor ?? null;
  if (!isAmount(fields.amountMinor) || !isAmount(hintMinMinor) || !isAmount(hintMaxMinor)) {
    throw new InvalidPlanCommandError('Amounts must be zero or more, in whole minor units');
  }
  if (hintMinMinor !== null && hintMaxMinor !== null && hintMinMinor > hintMaxMinor) {
    throw new InvalidPlanCommandError('The lowest suggested amount cannot be above the highest');
  }
  if (kind !== 'yearly' && (dueMonth !== null || dueDay !== null)) {
    throw new InvalidPlanCommandError('Only yearly items can have a due month or day');
  }
  if (dueMonth !== null && !(Number.isInteger(dueMonth) && dueMonth >= 1 && dueMonth <= 12)) {
    throw new InvalidPlanCommandError('The due month must be 1–12');
  }
  if (dueDay !== null && !(Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31)) {
    throw new InvalidPlanCommandError('The due day must be 1–31');
  }
  if (dueDay !== null && dueMonth === null) throw new InvalidPlanCommandError('A due day needs a due month');
  return { itemId, amountMinor: fields.amountMinor, dueMonth, dueDay, hintMinMinor, hintMaxMinor };
}

export function totalOf(entries: readonly TemplateEntry[]): number {
  return sumMinor(entries.map((e) => e.amountMinor));
}

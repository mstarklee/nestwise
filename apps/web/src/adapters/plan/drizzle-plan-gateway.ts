import 'server-only';
import { type DbOrTx, groups, items, templateLines } from '@nestwise/db';
import type { Group, Item, PlanGateway, TemplateLine } from '@nestwise/domain/plan';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';

type GroupRow = typeof groups.$inferSelect;
type ItemRow = typeof items.$inferSelect;
type LineRow = typeof templateLines.$inferSelect;

const toGroup = (row: GroupRow): Group => ({
  id: row.id,
  familyId: row.familyId,
  kind: row.kind,
  name: row.name,
  sort: row.sort,
  archived: row.archivedAt !== null,
});

const toItem = (row: ItemRow): Item => ({
  id: row.id,
  familyId: row.familyId,
  groupId: row.groupId,
  kind: row.kind,
  name: row.name,
  sort: row.sort,
  archived: row.archivedAt !== null,
  seedKey: row.seedKey,
});

const toLine = (row: LineRow): TemplateLine => ({
  itemId: row.itemId,
  amountMinor: row.amountMinor,
  dueMonth: row.dueMonth,
  dueDay: row.dueDay,
  hintMinMinor: row.hintMinMinor,
  hintMaxMinor: row.hintMaxMinor,
});

/** Archiving keeps the first archive time; un-archiving clears it. */
const archivedAt = (archived: boolean, column: typeof items.archivedAt | typeof groups.archivedAt) =>
  archived ? sql`coalesce(${column}, now())` : null;

export class DrizzlePlanGateway implements PlanGateway {
  constructor(private readonly db: DbOrTx) {}

  async listGroups(familyId: string): Promise<readonly Group[]> {
    const rows = await this.db.select().from(groups).where(eq(groups.familyId, familyId)).orderBy(asc(groups.sort));
    return rows.map(toGroup);
  }

  async listItems(familyId: string, options: { includeArchived: boolean }): Promise<readonly Item[]> {
    const where = options.includeArchived
      ? eq(items.familyId, familyId)
      : and(eq(items.familyId, familyId), isNull(items.archivedAt));
    const rows = await this.db.select().from(items).where(where).orderBy(asc(items.sort));
    return rows.map(toItem);
  }

  async findItem(familyId: string, itemId: string): Promise<Item | undefined> {
    const [row] = await this.db.select().from(items).where(and(eq(items.familyId, familyId), eq(items.id, itemId))).limit(1);
    return row ? toItem(row) : undefined;
  }

  async findGroup(familyId: string, groupId: string): Promise<Group | undefined> {
    const [row] = await this.db.select().from(groups).where(and(eq(groups.familyId, familyId), eq(groups.id, groupId))).limit(1);
    return row ? toGroup(row) : undefined;
  }

  async listTemplateLines(familyId: string): Promise<readonly TemplateLine[]> {
    const rows = await this.db.select().from(templateLines).where(eq(templateLines.familyId, familyId));
    return rows.map(toLine);
  }

  async findTemplateLine(familyId: string, itemId: string): Promise<TemplateLine | undefined> {
    const [row] = await this.db
      .select()
      .from(templateLines)
      .where(and(eq(templateLines.familyId, familyId), eq(templateLines.itemId, itemId)))
      .limit(1);
    return row ? toLine(row) : undefined;
  }

  async saveGroup(group: Group): Promise<Group> {
    await this.db
      .insert(groups)
      .values({ id: group.id, familyId: group.familyId, kind: group.kind, name: group.name, sort: group.sort, archivedAt: group.archived ? new Date() : null })
      .onConflictDoUpdate({
        target: groups.id,
        set: { name: group.name, sort: group.sort, archivedAt: archivedAt(group.archived, groups.archivedAt) },
        setWhere: eq(groups.familyId, group.familyId),
      });
    return group;
  }

  async saveItem(item: Item): Promise<Item> {
    await this.db
      .insert(items)
      .values({
        id: item.id,
        familyId: item.familyId,
        groupId: item.groupId,
        kind: item.kind,
        name: item.name,
        sort: item.sort,
        archivedAt: item.archived ? new Date() : null,
        seedKey: item.seedKey,
      })
      .onConflictDoUpdate({
        target: items.id,
        set: { groupId: item.groupId, name: item.name, sort: item.sort, archivedAt: archivedAt(item.archived, items.archivedAt) },
        setWhere: eq(items.familyId, item.familyId),
      });
    return item;
  }

  async saveTemplateLine(familyId: string, line: TemplateLine): Promise<TemplateLine> {
    const values = {
      amountMinor: line.amountMinor,
      dueMonth: line.dueMonth,
      dueDay: line.dueDay,
      hintMinMinor: line.hintMinMinor,
      hintMaxMinor: line.hintMaxMinor,
      updatedAt: new Date(),
    };
    await this.db
      .insert(templateLines)
      .values({ itemId: line.itemId, familyId, ...values })
      .onConflictDoUpdate({ target: templateLines.itemId, set: values, setWhere: eq(templateLines.familyId, familyId) });
    return line;
  }
}

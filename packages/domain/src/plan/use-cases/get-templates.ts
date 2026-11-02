import { assertCan } from '../../shared';
import { type GetTemplatesCommand, type TemplateEntry, type Templates, totalOf } from '../models';
import type { PlanGateway } from '../ports';

/** The three templates, grouped and ordered (group order, then item order), with a total per kind. */
export class GetTemplatesUseCase {
  constructor(private readonly plan: PlanGateway) {}

  async execute(command: GetTemplatesCommand): Promise<Templates> {
    assertCan(command.actor, 'read');
    const familyId = command.actor.familyId;
    const [groups, items, lines] = await Promise.all([
      this.plan.listGroups(familyId),
      this.plan.listItems(familyId, { includeArchived: false }),
      this.plan.listTemplateLines(familyId),
    ]);
    const groupById = new Map(groups.map((g) => [g.id, g]));
    const lineByItem = new Map(lines.map((l) => [l.itemId, l]));

    const entries: (TemplateEntry & { groupSort: number; itemSort: number; kind: string })[] = [];
    for (const item of items) {
      const group = groupById.get(item.groupId);
      if (!group || group.archived) continue;
      const line = lineByItem.get(item.id) ?? {
        itemId: item.id,
        amountMinor: 0,
        dueMonth: null,
        dueDay: null,
        hintMinMinor: null,
        hintMaxMinor: null,
      };
      entries.push({
        ...line,
        seedKey: item.seedKey,
        name: item.name,
        groupId: group.id,
        groupName: group.name,
        groupSort: group.sort,
        itemSort: item.sort,
        kind: item.kind,
      });
    }
    entries.sort((a, b) => a.groupSort - b.groupSort || a.itemSort - b.itemSort);
    const strip = ({ groupSort: _g, itemSort: _i, kind: _k, ...entry }: (typeof entries)[number]): TemplateEntry => entry;
    const ofKind = (kind: string) => entries.filter((e) => e.kind === kind).map(strip);

    const monthly = ofKind('monthly');
    const savings = ofKind('savings');
    const yearly = ofKind('yearly');
    return { monthly, savings, yearly, totals: { monthly: totalOf(monthly), savings: totalOf(savings), yearly: totalOf(yearly) } };
  }
}

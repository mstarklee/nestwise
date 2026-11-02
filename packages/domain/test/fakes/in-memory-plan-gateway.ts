import type { Group, Item, PlanGateway, PlanUnitOfWork, TemplateLine } from '../../src/plan';
import type { ActivityGateway } from '../../src/shared';
import { InMemoryActivityGateway } from './in-memory-activity-gateway';

export class InMemoryPlanGateway implements PlanGateway {
  groups = new Map<string, Group>();
  items = new Map<string, Item>();
  lines = new Map<string, TemplateLine & { familyId: string }>();

  async listGroups(familyId: string) {
    return [...this.groups.values()].filter((g) => g.familyId === familyId);
  }
  async listItems(familyId: string, options: { includeArchived: boolean }) {
    return [...this.items.values()].filter((i) => i.familyId === familyId && (options.includeArchived || !i.archived));
  }
  async findItem(familyId: string, itemId: string) {
    const item = this.items.get(itemId);
    return item?.familyId === familyId ? item : undefined;
  }
  async findGroup(familyId: string, groupId: string) {
    const group = this.groups.get(groupId);
    return group?.familyId === familyId ? group : undefined;
  }
  async listTemplateLines(familyId: string) {
    return [...this.lines.values()].filter((l) => l.familyId === familyId).map(({ familyId: _f, ...line }) => line);
  }
  async findTemplateLine(familyId: string, itemId: string) {
    const line = this.lines.get(itemId);
    if (line?.familyId !== familyId) return undefined;
    const { familyId: _f, ...rest } = line;
    return rest;
  }
  async saveGroup(group: Group) {
    this.groups.set(group.id, group);
    return group;
  }
  async saveItem(item: Item) {
    this.items.set(item.id, item);
    return item;
  }
  async saveTemplateLine(familyId: string, line: TemplateLine) {
    this.lines.set(line.itemId, { ...line, familyId });
    return line;
  }
  counts() {
    return { groups: this.groups.size, items: this.items.size, lines: this.lines.size };
  }
}

export class InMemoryPlanUnitOfWork implements PlanUnitOfWork {
  readonly plan = new InMemoryPlanGateway();
  readonly activity = new InMemoryActivityGateway();

  async run<T>(work: (gateways: { plan: PlanGateway; activity: ActivityGateway }) => Promise<T>): Promise<T> {
    const snapshot = {
      groups: new Map(this.plan.groups),
      items: new Map(this.plan.items),
      lines: new Map(this.plan.lines),
      activity: this.activity.snapshot(),
    };
    try {
      return await work({ plan: this.plan, activity: this.activity });
    } catch (error) {
      this.plan.groups = snapshot.groups;
      this.plan.items = snapshot.items;
      this.plan.lines = snapshot.lines;
      this.activity.restore(snapshot.activity);
      throw error;
    }
  }
}

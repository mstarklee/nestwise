import type { ActivityGateway } from '../shared';
import type { Group, Item, TemplateLine } from './models';

/** Every method is scoped to one family. */
export interface PlanGateway {
  listGroups(familyId: string): Promise<readonly Group[]>;
  listItems(familyId: string, options: { includeArchived: boolean }): Promise<readonly Item[]>;
  findItem(familyId: string, itemId: string): Promise<Item | undefined>;
  findGroup(familyId: string, groupId: string): Promise<Group | undefined>;
  listTemplateLines(familyId: string): Promise<readonly TemplateLine[]>;
  findTemplateLine(familyId: string, itemId: string): Promise<TemplateLine | undefined>;
  saveGroup(group: Group): Promise<Group>;
  saveItem(item: Item): Promise<Item>;
  saveTemplateLine(familyId: string, line: TemplateLine): Promise<TemplateLine>;
}

/** Plan writes plus their activity rows, all or nothing. */
export interface PlanUnitOfWork {
  run<T>(work: (gateways: { plan: PlanGateway; activity: ActivityGateway }) => Promise<T>): Promise<T>;
}

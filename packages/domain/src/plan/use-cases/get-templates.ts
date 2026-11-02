import { assertCan } from '../../shared';
import { assembleTemplates, type GetTemplatesCommand, type Templates } from '../models';
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
    return assembleTemplates(groups, items, lines);
  }
}

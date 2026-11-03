import 'server-only';
import { activity, type DbOrTx } from '@nestwise/db';
import type { ActivityEvent, ActivityGateway } from '@nestwise/domain/shared';

/** Insert-only: the app role has no UPDATE or DELETE on app.activity. */
export class DrizzleActivityGateway implements ActivityGateway {
  constructor(private readonly db: DbOrTx) {}

  async record(event: ActivityEvent): Promise<void> {
    await this.db.insert(activity).values({
      familyId: event.familyId,
      actorId: event.actorId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      before: event.before ?? null,
      after: event.after ?? null,
      at: event.at,
      lateEdit: event.lateEdit ?? false,
    });
  }
}

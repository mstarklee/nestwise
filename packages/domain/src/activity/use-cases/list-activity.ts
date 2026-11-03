import { assertCan } from '../../shared';
import { InvalidActivityQueryError } from '../errors';
import { type ActivityPage, type ListActivityCommand, MAX_ACTIVITY_PAGE } from '../models';
import type { ActivityReader } from '../ports';

/** The activity history, a page at a time, newest first (PRD §6.9). */
export class ListActivityUseCase {
  constructor(private readonly reader: ActivityReader) {}

  async execute(command: ListActivityCommand): Promise<ActivityPage> {
    assertCan(command.actor, 'read');
    if (!Number.isInteger(command.limit) || command.limit < 1) throw new InvalidActivityQueryError('Ask for at least one row');
    const limit = Math.min(command.limit, MAX_ACTIVITY_PAGE);
    const rows = await this.reader.list(command.actor.familyId, { before: command.before, limit });
    return { rows, nextBefore: rows.length === limit ? rows[rows.length - 1]!.id : null };
  }
}

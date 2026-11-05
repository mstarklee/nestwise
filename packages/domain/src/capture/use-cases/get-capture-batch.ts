import { type Actor, assertCan } from '../../shared';
import { CaptureBatchNotFoundError } from '../errors';
import type { CaptureEntry } from '../models';
import type { CaptureGateway } from '../ports';
import { needsAttention } from '../rules';

/** One row as the review screen needs it: the staged entry plus whether it must be looked at. */
export interface ReviewEntry extends CaptureEntry {
  readonly needsAttention: boolean;
}

/** One spoken note, ready to check. `mine` is false for anyone but its speaker, who alone may confirm it. */
export interface ReviewBatch {
  readonly id: string;
  readonly createdBy: string;
  readonly mine: boolean;
  readonly transcript: string;
  readonly entries: readonly ReviewEntry[];
  readonly createdAt: Date;
}

/**
 * Loads a spoken note for the review screen. A note that has already been dealt with is treated as gone, so an old
 * link cannot be used to confirm the same batch twice.
 */
export class GetCaptureBatchUseCase {
  constructor(private readonly captures: CaptureGateway) {}

  async execute(command: { readonly actor: Actor; readonly batchId: string }): Promise<ReviewBatch> {
    assertCan(command.actor, 'read');
    const batch = await this.captures.find(command.actor.familyId, command.batchId);
    if (!batch || batch.resolvedAt !== null) throw new CaptureBatchNotFoundError('That voice note is no longer waiting');

    return {
      id: batch.id,
      createdBy: batch.createdBy,
      mine: batch.createdBy === command.actor.userId,
      transcript: batch.transcript,
      entries: batch.entries.map((entry) => ({ ...entry, needsAttention: needsAttention(entry) })),
      createdAt: batch.createdAt,
    };
  }
}

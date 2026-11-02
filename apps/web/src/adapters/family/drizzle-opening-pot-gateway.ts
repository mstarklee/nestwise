import 'server-only';
import { type DbOrTx, potEntries } from '@nestwise/db';
import type { OpeningPotEntry, OpeningPotGateway } from '@nestwise/domain/family';

export class DrizzleOpeningPotGateway implements OpeningPotGateway {
  constructor(private readonly db: DbOrTx) {}

  async record(entry: OpeningPotEntry): Promise<void> {
    await this.db.insert(potEntries).values({
      id: entry.id,
      familyId: entry.familyId,
      kind: entry.kind,
      amountMinor: entry.amountMinor,
      entryDate: entry.entryDate,
      periodYear: entry.period.year,
      periodMonth: entry.period.month,
      createdBy: entry.createdBy,
    });
  }
}

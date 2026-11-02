import 'server-only';
import { type DbOrTx, redAlertState } from '@nestwise/db';
import type { RedState, RedStateGateway } from '@nestwise/domain/reminders';
import { eq } from 'drizzle-orm';

export class DrizzleRedStateGateway implements RedStateGateway {
  constructor(private readonly db: DbOrTx) {}

  async find(familyId: string): Promise<RedState | null> {
    const [row] = await this.db.select().from(redAlertState).where(eq(redAlertState.familyId, familyId)).limit(1);
    return row ? { firstRed: { year: row.firstRedYear, month: row.firstRedMonth }, shortfallMinor: row.shortfallMinor } : null;
  }

  async save(familyId: string, state: RedState | null): Promise<void> {
    if (state === null) {
      await this.db.delete(redAlertState).where(eq(redAlertState.familyId, familyId));
      return;
    }
    const values = { firstRedYear: state.firstRed.year, firstRedMonth: state.firstRed.month, shortfallMinor: state.shortfallMinor, updatedAt: new Date() };
    await this.db
      .insert(redAlertState)
      .values({ familyId, ...values })
      .onConflictDoUpdate({ target: redAlertState.familyId, set: values });
  }
}

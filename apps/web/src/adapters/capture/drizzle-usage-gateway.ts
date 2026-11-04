import 'server-only';
import { type DbOrTx, usage } from '@nestwise/db';
import type { UsageGateway } from '@nestwise/domain/capture';
import type { Period } from '@nestwise/domain/shared';
import { and, eq, sql } from 'drizzle-orm';

/** Monthly voice usage, over the `usage` table that has been there since 0000_init. */
export class DrizzleUsageGateway implements UsageGateway {
  constructor(private readonly db: DbOrTx) {}

  async countThisMonth(familyId: string, period: Period): Promise<{ voiceCount: number; voiceSeconds: number }> {
    const [row] = await this.db
      .select({ voiceCount: usage.voiceCount, voiceSeconds: usage.voiceSeconds })
      .from(usage)
      .where(and(eq(usage.familyId, familyId), eq(usage.year, period.year), eq(usage.month, period.month)))
      .limit(1);
    return row ?? { voiceCount: 0, voiceSeconds: 0 };
  }

  /** One upsert, so two recordings at the same moment both count. */
  async record(familyId: string, period: Period, seconds: number): Promise<void> {
    const whole = Math.max(Math.round(seconds), 0);
    await this.db
      .insert(usage)
      .values({ familyId, year: period.year, month: period.month, voiceCount: 1, voiceSeconds: whole })
      .onConflictDoUpdate({
        target: [usage.familyId, usage.year, usage.month],
        set: {
          voiceCount: sql`${usage.voiceCount} + 1`,
          voiceSeconds: sql`${usage.voiceSeconds} + ${whole}`,
        },
      });
  }
}

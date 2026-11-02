import 'server-only';
import { type DbOrTx, families } from '@nestwise/db';
import type { Family, FamilyGateway } from '@nestwise/domain/family';
import type { MinorUnit } from '@nestwise/domain/shared';
import { asc, eq } from 'drizzle-orm';

type FamilyRow = typeof families.$inferSelect;

const toFamily = (row: FamilyRow): Family => ({
  id: row.id,
  name: row.name,
  currencyCode: row.currencyCode,
  minorUnit: row.minorUnit as MinorUnit,
  numberLocale: row.numberLocale,
  timeZone: row.timezone,
  countryCode: row.countryCode,
  setAsideOverrideMinor: row.setAsideOverrideMinor,
  alertThresholds: row.alertThresholds,
  createdBy: row.createdBy,
  createdAt: row.createdAt,
});

export class DrizzleFamilyGateway implements FamilyGateway {
  constructor(private readonly db: DbOrTx) {}

  async save(family: Family): Promise<Family> {
    await this.db.insert(families).values({
      id: family.id,
      name: family.name,
      currencyCode: family.currencyCode,
      minorUnit: family.minorUnit,
      numberLocale: family.numberLocale,
      timezone: family.timeZone,
      countryCode: family.countryCode,
      setAsideOverrideMinor: family.setAsideOverrideMinor,
      alertThresholds: [...family.alertThresholds],
      createdBy: family.createdBy,
      createdAt: family.createdAt,
    });
    return family;
  }

  async findById(familyId: string): Promise<Family | undefined> {
    const [row] = await this.db.select().from(families).where(eq(families.id, familyId)).limit(1);
    return row ? toFamily(row) : undefined;
  }

  async listAll(): Promise<readonly Family[]> {
    return (await this.db.select().from(families).orderBy(asc(families.createdAt))).map(toFamily);
  }
}

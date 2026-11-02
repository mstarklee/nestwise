import { describe, expect, it } from 'vitest';
import { runSeedDev } from '../../../../../scripts/seed-dev';
import { makeGetMonthSummaryUseCase } from '@/composition/month-budget';
import { makeGetPotBalanceUseCase } from '@/composition/pot';
import { makeGetYearPlanUseCase } from '@/composition/year-plan';
import { useTestDb } from '../setup';

const db = useTestDb();
const OCT = { year: 2026, month: 10 };

describe('runSeedDev', () => {
  it('loads the fictional October 2026 into a dev family: PRD §7 tests 8 and 9 hold', async () => {
    const { actor } = await runSeedDev({ DB_HOST: 'localhost', DB_PORT: '5432', DB_NAME: 'nestwise', DB_USER: 'u', DB_PASSWORD: 'p' }, db());
    const october = await makeGetMonthSummaryUseCase(db()).execute({ actor, period: OCT });
    expect(october.totals).toMatchObject({ plannedMinor: 8_150_000, actualMinor: 8_445_000, varianceMinor: 295_000 });
    const line = (name: string) => october.lines.find((l) => l.name === name)!;
    expect(line('Groceries').varianceMinor).toBe(200_000);
    expect(line('Fruits').varianceMinor).toBe(-50_000);
    // The yearly payments are not monthly spending; they come out of the pot and the yearly lines.
    expect((await makeGetPotBalanceUseCase(db()).execute({ actor })).balanceMinor).toBe(-3_650_000);
    const year = await makeGetYearPlanUseCase(db()).execute({ actor, year: 2026 });
    expect(year.lines.find((l) => l.name === 'Car Insurance')).toMatchObject({ paidMinor: 650_000, status: 'paid' });
    await expect(runSeedDev({ DB_HOST: 'localhost', DB_PORT: '5432', DB_NAME: 'nestwise', DB_USER: 'u', DB_PASSWORD: 'p' }, db())).rejects.toThrow(/already/);
  });
});

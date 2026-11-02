import { addMonths, periodOf, todayIn } from '@nestwise/domain/shared';
import { describe, expect, it } from 'vitest';
import { GET as getForecast } from '../../../app/api/v1/forecast/route';
import { GET as getHome } from '../../../app/api/v1/home/route';
import { POST as deposit } from '../../../app/api/v1/pot/deposits/route';
import { makeEnsureYearPlanUseCase } from '@/composition/year-plan';
import { useTestDb } from '../setup';
import { adminWithPlan, request } from '../support/api';

const db = useTestDb();

type ForecastBody = {
  balanceMinor: number;
  months: { period: { year: number; month: number }; inMinor: number; outMinor: number; endMinor: number; estimate: boolean }[];
  bills: { period: unknown; lines: unknown[] }[];
  monthlyPlanMinor: number;
};
type HomeBody = { pot: { balanceMinor: number }; next3Months: unknown[]; cards: string[]; thisMonth: { plannedMinor: number } };

// The routes use the real clock, so the expectations follow today's month in India.
const current = periodOf(todayIn('Asia/Kolkata', new Date()));
const ym = `${current.year}-${String(current.month).padStart(2, '0')}`;

describe('/api/v1/forecast and /api/v1/home', () => {
  it('forecasts 12 months from this month, reading the year plans, the template and the pot', async () => {
    const { token, familyId } = await adminWithPlan(db());
    expect((await getForecast(request('GET', '/api/v1/forecast'))).status).toBe(401);
    await makeEnsureYearPlanUseCase(db()).execute({ familyId, year: current.year });

    const response = await getForecast(request('GET', '/api/v1/forecast', token));
    expect(response.status).toBe(200);
    const body = (await response.json()) as ForecastBody;
    expect(body.months.map((m) => m.period)).toEqual(Array.from({ length: 12 }, (_, i) => addMonths(current, i)));
    expect(body.months.map((m) => m.estimate)).toEqual(body.months.map((m) => m.period.year !== current.year));
    expect(body.balanceMinor).toBe(0);
    expect(body.months[0]!.inMinor).toBeGreaterThan(0);
    expect(body.bills).toHaveLength(12);
    expect(body.monthlyPlanMinor).toBe(8_150_000);

    await deposit(request('POST', '/api/v1/pot/deposits', token, { period: ym, amountMinor: 3_691_666 }));
    const after = (await (await getForecast(request('GET', '/api/v1/forecast', token))).json()) as ForecastBody;
    expect(after.balanceMinor).toBe(3_691_666);
    expect(after.months[0]!.inMinor).toBe(0);
  });

  it('home shows the pot, three months of bills, this month and the checklist card', async () => {
    const { token } = await adminWithPlan(db());
    const response = await getHome(request('GET', '/api/v1/home', token));
    expect(response.status).toBe(200);
    const body = (await response.json()) as HomeBody;
    expect(body.pot.balanceMinor).toBe(0);
    expect(body.next3Months).toHaveLength(3);
    expect(body.thisMonth.plannedMinor).toBe(8_150_000);
    expect(body.cards).toContain('checklist');
  });
});

import { describe, expect, it } from 'vitest';
import { planSpendingAlerts } from '../../src/reminders';

const input = (actualMinor: number, plannedMinor = 2_400_000) => ({
  period: { year: 2026, month: 11 },
  groups: [{ name: 'Food & Dining', plannedMinor, actualMinor }],
  thresholds: [80, 100],
  members: [{ userId: 'u1' }, { userId: 'u2' }],
});

describe('planSpendingAlerts', () => {
  it('Food at 79% gives no alert', () => {
    expect(planSpendingAlerts(input(1_896_000))).toEqual([]);
  });

  it('at 81% gives one 80% alert per member, deduped per group, month and level', () => {
    const alerts = planSpendingAlerts(input(1_944_000));
    expect(alerts.map((a) => [a.userId, a.dedupeKey])).toEqual([
      ['u1', 'alert:Food & Dining:2026-11:80'],
      ['u2', 'alert:Food & Dining:2026-11:80'],
    ]);
    expect(alerts[0]).toMatchObject({
      kind: 'spending_alert',
      url: '/month/2026-11',
      emailFallback: false,
      message: { key: 'spending_alert', values: { name: 'Food & Dining', threshold: 80, amountMinor: 1_944_000, plannedMinor: 2_400_000 } },
    });
  });

  it('at 105% both levels are due; "sent once" is the claim log’s job, so an earlier 80% is not sent again', () => {
    expect(planSpendingAlerts(input(2_520_000)).map((a) => a.dedupeKey)).toEqual([
      'alert:Food & Dining:2026-11:80',
      'alert:Food & Dining:2026-11:100',
      'alert:Food & Dining:2026-11:80',
      'alert:Food & Dining:2026-11:100',
    ]);
  });

  it('a group planned at ₹0 never alerts', () => {
    expect(planSpendingAlerts(input(10_000, 0))).toEqual([]);
  });

  it('exactly at the level counts as reaching it', () => {
    expect(planSpendingAlerts(input(1_920_000))).toHaveLength(2);
  });
});

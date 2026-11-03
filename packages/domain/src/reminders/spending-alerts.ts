import type { Period } from '../shared';
import type { PlannedNotification } from './models';

export interface SpendingAlertInput {
  readonly period: Period;
  /** Each spending group's month figures. */
  readonly groups: readonly { readonly name: string; readonly plannedMinor: number; readonly actualMinor: number }[];
  /** The family's alert levels in percent, e.g. [80, 100]. */
  readonly thresholds: readonly number[];
  readonly members: readonly { readonly userId: string }[];
}

const ym = (p: Period) => `${p.year}-${String(p.month).padStart(2, '0')}`;

/**
 * Spending alerts (PRD §5.5, TRD §8.4): every level a group has reached this month, for every member. A level is
 * sent once per group per month because the dedupe key is claimed before sending; this only says what is due.
 * A group planned at ₹0 never alerts.
 */
export function planSpendingAlerts(input: SpendingAlertInput): readonly PlannedNotification[] {
  const due: PlannedNotification[] = [];
  for (const member of input.members) {
    for (const group of input.groups) {
      if (group.plannedMinor <= 0) continue;
      for (const threshold of input.thresholds) {
        // Integer maths: actual ÷ planned ≥ threshold %.
        if (group.actualMinor * 100 < group.plannedMinor * threshold) continue;
        due.push({
          userId: member.userId,
          dedupeKey: `alert:${group.name}:${ym(input.period)}:${threshold}`,
          kind: 'spending_alert',
          message: { key: 'spending_alert', values: { name: group.name, threshold, amountMinor: group.actualMinor, plannedMinor: group.plannedMinor } },
          url: `/month/${ym(input.period)}`,
          emailFallback: false,
        });
      }
    }
  }
  return due;
}

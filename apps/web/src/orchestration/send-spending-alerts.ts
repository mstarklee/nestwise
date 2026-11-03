import 'server-only';
import { planSpendingAlerts } from '@nestwise/domain/reminders';
import type { Actor, Period } from '@nestwise/domain/shared';
import { DrizzleFamilyGateway } from '../adapters/family/drizzle-family-gateway';
import { DrizzleMembershipGateway } from '../adapters/family/drizzle-membership-gateway';
import { makeGetMonthSummaryUseCase } from '../composition/month-budget';
import { type DeliveryDeps, defaultDeliveryDeps, deliver } from './deliver-notification';

/**
 * After an expense counts (saved, or answered Different), tells every member about spending groups that reached an
 * alert level this month (PRD §5.5). Each level is sent once per group per month: deliver() claims its dedupe key.
 */
export async function sendSpendingAlerts(familyId: string, period: Period, deps: DeliveryDeps = defaultDeliveryDeps()): Promise<number> {
  const family = await new DrizzleFamilyGateway(deps.db).findById(familyId);
  if (!family) return 0;
  // Read as the system: a read-only actor scoped to this family.
  const actor: Actor = { userId: family.createdBy, familyId, role: 'viewer' };
  const [summary, members] = await Promise.all([
    makeGetMonthSummaryUseCase(deps.db).execute({ actor, period }),
    new DrizzleMembershipGateway(deps.db).listActive(familyId),
  ]);
  const due = planSpendingAlerts({
    period,
    groups: summary.groups.map((g) => ({ name: g.groupName, plannedMinor: g.plannedMinor, actualMinor: g.actualMinor })),
    thresholds: family.alertThresholds,
    members,
  });
  let sent = 0;
  const now = new Date();
  for (const notification of due) {
    if ((await deliver(notification, family, now, deps)) === 'sent') sent += 1;
  }
  return sent;
}

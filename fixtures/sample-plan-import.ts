import type { PlanImport, PlanImportGroup } from '../packages/domain/src/plan/models';
import { monthlyTemplate, savingsTemplate, yearlyTemplate } from './sample-plan';

/**
 * The sample plan as a PlanImport: 9 monthly groups (20 items), 1 savings group (2 items), 8 yearly groups (22
 * items). Due months only where the sample doc has them (8 insurance/education items + Pongal = January).
 */
function groupBy<T extends { groupKey: string; groupName: string }>(rows: readonly T[]) {
  const groups = new Map<string, { name: string; rows: T[] }>();
  for (const row of rows) {
    const group = groups.get(row.groupKey) ?? { name: row.groupName, rows: [] };
    group.rows.push(row);
    groups.set(row.groupKey, group);
  }
  return [...groups];
}

const monthlyGroups: PlanImportGroup[] = groupBy(monthlyTemplate).map(([key, g]) => ({
  key,
  kind: 'monthly',
  name: g.name,
  items: g.rows.map((r) => ({ key: r.key, name: r.name, amountMinor: r.amountMinor, isBill: r.bill === true })),
}));

const savingsGroup: PlanImportGroup = {
  key: 'savings',
  kind: 'savings',
  name: 'Savings',
  items: savingsTemplate.map((s) => ({
    key: s.key,
    name: s.name,
    amountMinor: s.amountMinor,
    hintMinMinor: s.hintMinMinor,
    hintMaxMinor: s.hintMaxMinor,
  })),
};

const yearlyGroups: PlanImportGroup[] = groupBy(yearlyTemplate).map(([key, g]) => ({
  key,
  kind: 'yearly',
  name: g.name,
  items: g.rows.map((r) => ({ key: r.key, name: r.name, amountMinor: r.amountMinor, dueMonth: r.dueMonth })),
}));

export const samplePlanImport: PlanImport = { groups: [...monthlyGroups, savingsGroup, ...yearlyGroups] };

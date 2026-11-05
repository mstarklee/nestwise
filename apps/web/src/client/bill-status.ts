import type { YearLineStatus } from '@nestwise/domain/year-plan';

export type BillLineKey = 'dueThisMonth' | 'overdue' | 'partPaid' | 'paid';

/** The words under a bill on Home. A planned bill in a later month says nothing; its month badge says when. */
export function billLine(status: YearLineStatus, inCurrentMonth: boolean): BillLineKey | null {
  switch (status) {
    case 'overdue':
      return 'overdue';
    case 'part_paid':
      return 'partPaid';
    case 'paid':
      return 'paid';
    case 'planned':
    case 'due_soon':
      return inCurrentMonth ? 'dueThisMonth' : null;
    default:
      return null;
  }
}

export type MonthCover = { readonly key: 'covers' } | { readonly key: 'short'; readonly shortfallMinor: number };

/** Whether the pot covers a month, from its end-of-month balance. The shortfall belongs to the pot, not to a bill. */
export function monthCover(endMinor: number): MonthCover {
  return endMinor >= 0 ? { key: 'covers' } : { key: 'short', shortfallMinor: -endMinor };
}

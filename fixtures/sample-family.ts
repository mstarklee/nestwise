/**
 * The sample family from docs/NestWise_Sample_Budget_and_Expense_Data.md, in minor units (paise).
 *
 * DEV AND TEST ONLY. The plan comes from sample-plan.ts (the family's real amounts); every transaction, payment and
 * piece of evidence below is FICTIONAL test data and must never be loaded into a production family.
 */
import type { IsoDate } from '@nestwise/domain/shared';
import { monthlyTemplate, rupees, savingsTemplate, yearlyTemplate } from './sample-plan';

export type { SampleMonthlyItem, SampleSavingsItem, SampleYearlyItem } from './sample-plan';

export type SampleMember = 'you' | 'spouse';
export type SampleCapture = 'manual' | 'receipt' | 'receipt_handwritten' | 'voice' | 'bank_alert' | 'linked';

export interface SampleTransaction {
  readonly id: string;
  readonly date: string;
  readonly description: string;
  readonly itemKey: string;
  readonly amountMinor: number;
  readonly member: SampleMember;
  readonly capture: SampleCapture;
}

export interface SampleYearlyPayment {
  readonly id: string;
  readonly date: string;
  readonly itemKey: string;
  readonly plannedMinor: number;
  readonly amountMinor: number;
}

export interface SampleEvidence {
  readonly id: string;
  readonly transactionId: string;
  readonly source: 'bank_alert' | 'receipt' | 'voice';
  readonly amountMinor: number;
}

export interface SampleItemRow {
  readonly itemKey: string;
  readonly plannedMinor: number;
  readonly actualMinor: number;
  readonly varianceMinor: number;
}

const tx = (
  id: string,
  date: string,
  description: string,
  itemKey: string,
  amountMinor: number,
  member: SampleMember,
  capture: SampleCapture,
): SampleTransaction => ({ id, date, description, itemKey, amountMinor, member, capture });

/** Sample doc §5: FICTIONAL. 36 confirmed expenses totalling ₹84,450.00. */
const october2026Transactions: readonly SampleTransaction[] = [
  tx('TX-001', '2026-10-02', 'October house rent', 'rent', 2_000_000, 'you', 'manual'),
  tx('TX-002', '2026-10-02', 'Monthly personal allocation', 'spouse', 500_000, 'spouse', 'manual'),
  tx('TX-003', '2026-10-03', 'Kids’ maintenance items', 'kids_maintenance', 520_000, 'spouse', 'receipt'),
  tx('TX-004', '2026-10-03', 'Electricity bill', 'electricity', 285_000, 'you', 'bank_alert'),
  tx('TX-005', '2026-10-04', 'Meat and fish shop', 'non_veg', 190_000, 'spouse', 'receipt'),
  tx('TX-006', '2026-10-04', 'Fruit stall', 'fruits', 89_550, 'you', 'voice'),
  tx('TX-007', '2026-10-05', 'Supermarket groceries', 'groceries', 220_000, 'spouse', 'bank_alert'),
  tx('TX-008', '2026-10-05', 'Home internet bill', 'internet', 250_000, 'you', 'bank_alert'),
  tx('TX-009', '2026-10-06', 'Vegetable vendor', 'vegetables', 125_000, 'spouse', 'receipt_handwritten'),
  tx('TX-010', '2026-10-07', 'Local grocery shop', 'groceries', 94_500, 'you', 'linked'),
  tx('TX-011', '2026-10-07', 'Fruit stall', 'fruits', 20_450, 'you', 'voice'),
  tx('TX-012', '2026-10-07', 'Vegetable shop', 'vegetables', 30_000, 'you', 'voice'),
  tx('TX-013', '2026-10-07', 'Snacks', 'outside_food', 10_000, 'you', 'voice'),
  tx('TX-014', '2026-10-07', 'Fuel', 'petrol', 30_000, 'you', 'voice'),
  tx('TX-015', '2026-10-07', 'Tea', 'outside_food', 2_300, 'you', 'voice'),
  tx('TX-016', '2026-10-09', 'Cafe / snacks', 'outside_food', 37_700, 'spouse', 'receipt'),
  tx('TX-017', '2026-10-10', 'Weekly groceries', 'groceries', 187_500, 'spouse', 'receipt'),
  tx('TX-018', '2026-10-10', 'Doctor visit and medicines', 'medical', 320_000, 'you', 'receipt'),
  tx('TX-019', '2026-10-11', 'Kids’ football coaching', 'football', 200_000, 'spouse', 'manual'),
  tx('TX-020', '2026-10-12', 'Fish shop', 'non_veg', 160_000, 'you', 'receipt'),
  tx('TX-021', '2026-10-12', 'Detergents and personal care', 'soaps', 160_000, 'spouse', 'receipt'),
  tx('TX-022', '2026-10-13', 'Vegetable vendor', 'vegetables', 125_000, 'you', 'receipt_handwritten'),
  tx('TX-023', '2026-10-14', 'Books and cloud/Claude subscriptions', 'books_cloud', 300_000, 'you', 'bank_alert'),
  tx('TX-024', '2026-10-15', 'Monthly grocery purchase', 'groceries', 330_000, 'spouse', 'bank_alert'),
  tx('TX-025', '2026-10-15', 'Video streaming subscriptions', 'ott', 100_000, 'you', 'bank_alert'),
  tx('TX-026', '2026-10-16', 'Fuel refill', 'petrol', 130_000, 'you', 'bank_alert'),
  tx('TX-027', '2026-10-16', 'Cooking gas', 'gas', 50_000, 'spouse', 'bank_alert'),
  tx('TX-028', '2026-10-18', 'Fruit purchase', 'fruits', 140_000, 'spouse', 'receipt'),
  tx('TX-029', '2026-10-19', 'Chicken shop', 'non_veg', 100_000, 'spouse', 'voice'),
  tx('TX-030', '2026-10-20', 'Ayurvedic medicines', 'ayurveda', 150_000, 'you', 'receipt'),
  tx('TX-031', '2026-10-22', 'Restaurant dinner', 'outside_food', 220_000, 'you', 'bank_alert'),
  tx('TX-032', '2026-10-24', 'End-of-month groceries', 'groceries', 168_000, 'spouse', 'receipt'),
  tx('TX-033', '2026-10-25', 'Diapers and cream', 'diapers', 90_000, 'spouse', 'receipt'),
  tx('TX-034', '2026-10-26', 'Housekeeping payment', 'housekeeping', 550_000, 'you', 'manual'),
  tx('TX-035', '2026-10-27', 'Fuel refill', 'petrol', 180_000, 'spouse', 'bank_alert'),
  tx('TX-036', '2026-10-29', 'Family restaurant outing', 'outside_food', 380_000, 'spouse', 'bank_alert'),
];

/** Sample doc §6: FICTIONAL. Paid from the pot; never part of the ₹84,450 monthly spending. */
const october2026YearlyPayments: readonly SampleYearlyPayment[] = [
  { id: 'YP-001', date: '2026-10-08', itemKey: 'car_ins', plannedMinor: 650_000, amountMinor: 650_000 },
  { id: 'YP-002', date: '2026-10-17', itemKey: 'school_t2', plannedMinor: 3_000_000, amountMinor: 3_000_000 },
];

/** Sample doc §5: FICTIONAL. Three captures of the one ₹945 purchase (TX-010). */
const tx010Evidence: readonly SampleEvidence[] = [
  { id: 'EV-010-A', transactionId: 'TX-010', source: 'bank_alert', amountMinor: 94_500 },
  { id: 'EV-010-B', transactionId: 'TX-010', source: 'receipt', amountMinor: 94_500 },
  { id: 'EV-010-C', transactionId: 'TX-010', source: 'voice', amountMinor: 94_500 },
];

const row = (itemKey: string, planned: number, actual: number, variance: number): SampleItemRow => ({
  itemKey,
  plannedMinor: rupees(planned),
  actualMinor: rupees(actual),
  varianceMinor: rupees(variance),
});

/** Sample doc §4 item table: the expected planned vs actual for October 2026. */
const october2026ItemTable: readonly SampleItemRow[] = [
  row('groceries', 8_000, 10_000, 2_000),
  row('fruits', 3_000, 2_500, -500),
  row('vegetables', 3_000, 2_800, -200),
  row('non_veg', 5_000, 4_500, -500),
  row('outside_food', 5_000, 6_500, 1_500),
  row('rent', 20_000, 20_000, 0),
  row('electricity', 3_000, 2_850, -150),
  row('internet', 2_500, 2_500, 0),
  row('gas', 500, 500, 0),
  row('housekeeping', 5_500, 5_500, 0),
  row('soaps', 1_500, 1_600, 100),
  row('kids_maintenance', 5_000, 5_200, 200),
  row('football', 2_000, 2_000, 0),
  row('diapers', 1_000, 900, -100),
  row('medical', 3_000, 3_200, 200),
  row('ayurveda', 1_500, 1_500, 0),
  row('petrol', 3_000, 3_400, 400),
  row('books_cloud', 3_000, 3_000, 0),
  row('ott', 1_000, 1_000, 0),
  row('spouse', 5_000, 5_000, 0),
];

export interface ShowcaseRow {
  readonly itemKey: string;
  readonly date: IsoDate;
  readonly amountMinor: number;
  readonly merchant: string;
}

/**
 * FICTIONAL. Spending in the CURRENT month for the design stage's local dev database only (seed:dev --showcase), so the
 * screens show every case: Food over plan (Rs 26,300 of 24,000), Kids nearly used up (7,200 of 8,000), Housing exactly
 * used (20,000 of 20,000) and Utilities fine (255 of 6,000). Never dated after `today`. Never goes into production data.
 */
export function showcaseRows(today: IsoDate): readonly ShowcaseRow[] {
  const month = today.slice(0, 7);
  const lastDay = Number(today.slice(8, 10));
  const rows: readonly (readonly [string, number, string])[] = [
    ['groceries', 1_000_000, 'FICTIONAL Corner Mart'],
    ['fruits', 400_000, 'FICTIONAL Fruit Cart'],
    ['vegetables', 380_000, 'FICTIONAL Veg Market'],
    ['non_veg', 500_000, 'FICTIONAL Meat Shop'],
    ['outside_food', 350_000, 'FICTIONAL Dosa Corner'],
    ['kids_maintenance', 450_000, 'FICTIONAL Kids Store'],
    ['football', 200_000, 'FICTIONAL Football Club'],
    ['diapers', 70_000, 'FICTIONAL Pharmacy'],
    ['rent', 2_000_000, 'FICTIONAL Landlord'],
    ['electricity', 25_500, 'FICTIONAL Power Board'],
  ];
  return rows.map(([itemKey, amountMinor, merchant], i) => ({
    itemKey,
    amountMinor,
    merchant,
    date: `${month}-${String(Math.min(i + 1, lastDay)).padStart(2, '0')}` as IsoDate,
  }));
}

export const sampleFamily = {
  name: 'Our Family',
  currencyCode: 'INR',
  minorUnit: 2,
  timeZone: 'Asia/Kolkata',
  monthlyTemplate,
  savingsTemplate,
  yearlyTemplate,
  october2026Transactions,
  october2026YearlyPayments,
  tx010Evidence,
  october2026ItemTable,
} as const;

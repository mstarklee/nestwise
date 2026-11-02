/**
 * The sample family from docs/NestWise_Sample_Budget_and_Expense_Data.md, in minor units (paise).
 *
 * DEV AND TEST ONLY. The plan amounts are the family's real figures; every transaction, payment and piece of
 * evidence below is FICTIONAL test data and must never be loaded into a production family
 * (scripts/import-plan.ts loads the templates only).
 */

export interface SampleMonthlyItem {
  readonly key: string;
  readonly name: string;
  readonly groupKey: string;
  readonly groupName: string;
  readonly amountMinor: number;
}

export interface SampleSavingsItem {
  readonly key: string;
  readonly name: string;
  readonly amountMinor: number;
  readonly hintMinMinor: number | null;
  readonly hintMaxMinor: number | null;
}

export interface SampleYearlyItem extends SampleMonthlyItem {
  /** Only the 8 insurance/education items and Pongal (January) have a month; the rest are "No month yet". */
  readonly dueMonth: number | null;
}

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

const rupees = (value: number) => Math.round(value * 100);

const monthly = (groupKey: string, groupName: string, key: string, name: string, amount: number): SampleMonthlyItem => ({
  key,
  name,
  groupKey,
  groupName,
  amountMinor: rupees(amount),
});

const yearly = (
  groupKey: string,
  groupName: string,
  key: string,
  name: string,
  amount: number,
  dueMonth: number | null,
): SampleYearlyItem => ({ ...monthly(groupKey, groupName, key, name, amount), dueMonth });

const FOOD = ['food', 'Food & Dining'] as const;
const HOUSING = ['housing', 'Housing'] as const;
const UTIL = ['util', 'Utilities & Bills'] as const;
const HOME = ['home', 'Home Care & Cleaning'] as const;
const KIDS = ['kids', 'Kids & Childcare'] as const;
const HEALTH = ['health', 'Healthcare'] as const;
const TRANS = ['trans', 'Transport'] as const;
const SUBS = ['subs', 'Subscriptions & Learning'] as const;
const PERSONAL = ['personal', 'Personal & Family'] as const;

const INS = ['ins', 'Insurance & Protection'] as const;
const EDU = ['edu', 'Kids’ Education'] as const;
const FEST = ['fest', 'Festivals & Traditions'] as const;
const BDAY = ['bday', 'Birthdays & Celebrations'] as const;
const TRAVEL = ['travel', 'Travel & Family Visits'] as const;
const VEH = ['veh', 'Vehicle Maintenance'] as const;
const RECREATION = ['recreation', 'Kids’ Recreation'] as const;
const REPAIR = ['repair', 'Appliance Maintenance'] as const;

/** Sample doc §2: 20 items in 9 groups, ₹81,500 a month. */
const monthlyTemplate: readonly SampleMonthlyItem[] = [
  monthly(...FOOD, 'groceries', 'Groceries', 8_000),
  monthly(...FOOD, 'fruits', 'Fruits', 3_000),
  monthly(...FOOD, 'vegetables', 'Vegetables', 3_000),
  monthly(...FOOD, 'non_veg', 'Non-veg', 5_000),
  monthly(...FOOD, 'outside_food', 'Outside Food / Restaurants', 5_000),
  monthly(...HOUSING, 'rent', 'House Rent', 20_000),
  monthly(...UTIL, 'electricity', 'Electricity Bill', 3_000),
  monthly(...UTIL, 'internet', 'Internet Bill', 2_500),
  monthly(...UTIL, 'gas', 'Cooking Gas', 500),
  monthly(...HOME, 'housekeeping', 'Housekeeping', 5_500),
  monthly(...HOME, 'soaps', 'Soap, Detergents & Washing Supplies', 1_500),
  monthly(...KIDS, 'kids_maintenance', 'Kids’ Maintenance', 5_000),
  monthly(...KIDS, 'football', 'Kids’ Football Fees', 2_000),
  monthly(...KIDS, 'diapers', 'Diapers & Cream', 1_000),
  monthly(...HEALTH, 'medical', 'Routine Medical Expenses', 3_000),
  monthly(...HEALTH, 'ayurveda', 'Ayurvedic Medicines', 1_500),
  monthly(...TRANS, 'petrol', 'Petrol', 3_000),
  monthly(...SUBS, 'books_cloud', 'Books & Claude/Cloud Subscription', 3_000),
  monthly(...SUBS, 'ott', 'OTT Subscriptions (Netflix, Amazon)', 1_000),
  monthly(...PERSONAL, 'spouse', 'Spouse’s Maintenance', 5_000),
];

/** Sample doc §2: ₹17,000 a month; gold is usually ₹10,000–₹20,000. */
const savingsTemplate: readonly SampleSavingsItem[] = [
  { key: 'rd', name: 'Recurring Deposit (RD)', amountMinor: rupees(2_000), hintMinMinor: null, hintMaxMinor: null },
  { key: 'gold', name: 'Gold Savings Scheme', amountMinor: rupees(15_000), hintMinMinor: rupees(10_000), hintMaxMinor: rupees(20_000) },
];

/** Sample doc §3: 22 items, ₹4,43,000 a year. */
const yearlyTemplate: readonly SampleYearlyItem[] = [
  yearly(...INS, 'car_ins', 'Car Insurance', 6_500, 10),
  yearly(...INS, 'bike_ins', 'Bike Insurance', 1_500, 11),
  yearly(...INS, 'self_health', 'Health Insurance — Self', 13_000, 7),
  yearly(...INS, 'parents_health', 'Health Insurance — Parents', 40_000, 7),
  yearly(...INS, 'inlaws_health', 'Health Insurance — In-laws', 70_000, 6),
  yearly(...INS, 'term_ins', 'Term Life Insurance', 50_000, 6),
  yearly(...EDU, 'school_t1', 'Kids’ School Fees — Term 1', 60_000, 5),
  yearly(...EDU, 'school_t2', 'Kids’ School Fees — Term 2', 30_000, 10),
  yearly(...FEST, 'pongal', 'Pongal', 15_000, 1),
  yearly(...FEST, 'deepavali', 'Deepavali Celebration', 5_000, null),
  yearly(...FEST, 'diwali_dress', 'Deepavali Clothing', 5_000, null),
  yearly(...FEST, 'native', 'Native-place Festival', 12_000, null),
  yearly(...BDAY, 'kids_bday', 'Kids’ Birthday', 5_000, null),
  yearly(...BDAY, 'spouse_bday', 'Spouse’s Birthday', 5_000, null),
  yearly(...BDAY, 'nephew_bday', 'Nephew’s Birthday', 5_000, null),
  yearly(...BDAY, 'other_bday', 'Fourth Family Birthday', 5_000, null),
  yearly(...BDAY, 'other_bday_exp', 'Additional Birthday-related Expenses', 10_000, null),
  yearly(...TRAVEL, 'tour', 'Family Tour / Vacation', 50_000, null),
  yearly(...TRAVEL, 'visits', 'Family & Friends Visits / Outings', 15_000, null),
  yearly(...VEH, 'car_bike_service', 'Car & Bike Servicing', 15_000, null),
  yearly(...RECREATION, 'indoor_play', 'Kids’ Games / Indoor Play', 10_000, null),
  yearly(...REPAIR, 'appliance', 'Household Electronics & Appliance Repairs', 15_000, null),
];

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

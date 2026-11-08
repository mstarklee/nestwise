/**
 * The sample family's PLAN, from docs/NestWise_Sample_Budget_and_Expense_Data.md, in minor units (paise).
 *
 * These are the family's real plan amounts (no transactions). scripts/import-plan.ts loads exactly this into the
 * real family. The fictional test transactions live in sample-family.ts and never go into production.
 */

export interface SampleMonthlyItem {
  readonly key: string;
  readonly name: string;
  readonly groupKey: string;
  readonly groupName: string;
  readonly amountMinor: number;
  /** A bill the family pays every month (rent, fees, subscriptions): Home lists it with done or not done. */
  readonly bill?: boolean;
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

export const rupees = (value: number) => Math.round(value * 100);

const monthly = (groupKey: string, groupName: string, key: string, name: string, amount: number): SampleMonthlyItem => ({
  key,
  name,
  groupKey,
  groupName,
  amountMinor: rupees(amount),
});

/** A monthly item that is a bill (owner, 2026-11-07). */
const bill = (groupKey: string, groupName: string, key: string, name: string, amount: number): SampleMonthlyItem => ({
  ...monthly(groupKey, groupName, key, name, amount),
  bill: true,
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

/** Sample doc §2: 20 items in 9 groups, ₹81,500 a month. Nine of them are bills (₹42,500). */
export const monthlyTemplate: readonly SampleMonthlyItem[] = [
  monthly(...FOOD, 'groceries', 'Groceries', 8_000),
  monthly(...FOOD, 'fruits', 'Fruits', 3_000),
  monthly(...FOOD, 'vegetables', 'Vegetables', 3_000),
  monthly(...FOOD, 'non_veg', 'Non-veg', 5_000),
  monthly(...FOOD, 'outside_food', 'Outside Food / Restaurants', 5_000),
  bill(...HOUSING, 'rent', 'House Rent', 20_000),
  bill(...UTIL, 'electricity', 'Electricity Bill', 3_000),
  bill(...UTIL, 'internet', 'Internet Bill', 2_500),
  bill(...UTIL, 'gas', 'Cooking Gas', 500),
  bill(...HOME, 'housekeeping', 'Housekeeping', 5_500),
  monthly(...HOME, 'soaps', 'Soap, Detergents & Washing Supplies', 1_500),
  monthly(...KIDS, 'kids_maintenance', 'Kids’ Maintenance', 5_000),
  bill(...KIDS, 'football', 'Kids’ Football Fees', 2_000),
  monthly(...KIDS, 'diapers', 'Diapers & Cream', 1_000),
  monthly(...HEALTH, 'medical', 'Routine Medical Expenses', 3_000),
  monthly(...HEALTH, 'ayurveda', 'Ayurvedic Medicines', 1_500),
  monthly(...TRANS, 'petrol', 'Petrol', 3_000),
  bill(...SUBS, 'books_cloud', 'Books & Claude/Cloud Subscription', 3_000),
  bill(...SUBS, 'ott', 'OTT Subscriptions (Netflix, Amazon)', 1_000),
  bill(...PERSONAL, 'spouse', 'Spouse’s Maintenance', 5_000),
];

/** Sample doc §2: ₹17,000 a month; gold is usually ₹10,000–₹20,000. */
export const savingsTemplate: readonly SampleSavingsItem[] = [
  { key: 'rd', name: 'Recurring Deposit (RD)', amountMinor: rupees(2_000), hintMinMinor: null, hintMaxMinor: null },
  { key: 'gold', name: 'Gold Savings Scheme', amountMinor: rupees(15_000), hintMinMinor: rupees(10_000), hintMaxMinor: rupees(20_000) },
];

/** Sample doc §3: 22 items, ₹4,43,000 a year. */
export const yearlyTemplate: readonly SampleYearlyItem[] = [
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

export const samplePlan = { monthlyTemplate, savingsTemplate, yearlyTemplate } as const;

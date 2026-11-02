import { type Actor, assertMinor, type IsoDate, type Period } from '../shared';

/**
 * Splits a yearly total into 12 monthly set-asides that add up exactly (TRD §4):
 * base = floor(T / 12), r = T − 12·base; months 1…r get base + 1, the rest get base.
 */
export function splitSetAside(totalMinor: number): readonly number[] {
  assertMinor(totalMinor);
  const base = Math.floor(totalMinor / 12);
  const remainder = totalMinor - base * 12;
  return Array.from({ length: 12 }, (_, i) => (i < remainder ? base + 1 : base));
}

/** The set-aside for calendar `month` (1–12): the override if the family set one, else the ÷12 split. */
export function setAsideFor(month: number, yearTotalMinor: number, overrideMinor: number | null): number {
  if (overrideMinor !== null) return overrideMinor;
  return splitSetAside(yearTotalMinor)[month - 1] ?? 0;
}

export type PotEntryKind = 'opening' | 'deposit' | 'extra_in' | 'taken_out';

/** One movement of money into or out of the pot (yearly bills paid are expenses, not pot entries). */
export interface PotEntry {
  readonly id: string;
  readonly familyId: string;
  readonly kind: PotEntryKind;
  readonly amountMinor: number;
  /** The day it was recorded, in the family's time zone. */
  readonly entryDate: IsoDate;
  /** For a deposit, the month it is for; otherwise the month of entryDate. */
  readonly period: Period;
  readonly note: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
}

export interface SavingsEntry {
  readonly id: string;
  readonly familyId: string;
  readonly itemId: string;
  readonly period: Period;
  readonly amountMinor: number;
  readonly createdBy: string;
  readonly createdAt: Date;
}

/** A "Not this month" answer; itemId null means the pot deposit. */
export interface ChecklistSkip {
  readonly id: string;
  readonly familyId: string;
  readonly period: Period;
  readonly itemId: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
}

export type ChecklistStatus = 'pending' | 'done' | 'skipped';

export interface ConfirmPotDepositCommand {
  readonly actor: Actor;
  readonly period: Period;
  readonly amountMinor: number;
}

export interface ConfirmSavingsCommand {
  readonly actor: Actor;
  readonly period: Period;
  readonly itemId: string;
  readonly amountMinor: number;
}

export interface SkipChecklistItemCommand {
  readonly actor: Actor;
  readonly period: Period;
  /** null skips the pot deposit. */
  readonly itemId: string | null;
}

export interface RecordPotMovementCommand {
  readonly actor: Actor;
  readonly kind: 'extra_in' | 'taken_out';
  readonly amountMinor: number;
  readonly note: string | null;
}

export interface GetChecklistCommand {
  readonly actor: Actor;
  readonly period: Period;
}

export interface GetPotBalanceCommand {
  readonly actor: Actor;
}

export interface ChecklistSavingsLine {
  readonly itemId: string;
  readonly name: string;
  readonly plannedMinor: number;
  readonly hint: { readonly minMinor: number | null; readonly maxMinor: number | null } | null;
  readonly status: ChecklistStatus;
  readonly confirmedMinor: number | null;
}

export interface Checklist {
  readonly period: Period;
  readonly pot: {
    readonly suggestedMinor: number;
    readonly status: ChecklistStatus;
    readonly confirmedMinor: number | null;
    /** The month's year has no year plan yet, so the suggestion comes from the yearly template. */
    readonly estimate: boolean;
  };
  readonly savings: readonly ChecklistSavingsLine[];
}

/** TRD §5.4: opening + deposits + extra in − taken out − yearly spend (refunds already subtracted). May be negative. */
export function potBalance(totals: Readonly<Record<PotEntryKind, number>>, yearlySpendMinor: number): number {
  const balance = totals.opening + totals.deposit + totals.extra_in - totals.taken_out - yearlySpendMinor;
  assertMinor(balance);
  return balance;
}

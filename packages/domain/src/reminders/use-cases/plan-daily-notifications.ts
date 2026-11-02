import { addMonths, comparePeriods, daysInMonth, type IsoDate, type Period, sumMinor, toIsoDate } from '../../shared';
import type { DailyFacts, DailyPlan, DailyYearLine, PlannedNotification, RedState, ReminderKind, ReminderMessage } from '../models';

const ym = (p: Period) => `${p.year}-${String(p.month).padStart(2, '0')}`;
const iso = (year: number, month: number, day: number) => toIsoDate(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
const owed = (l: DailyYearLine) => l.state === 'open' && l.remainingMinor > 0 && l.dueMonth !== null;
const dueIn = (l: DailyYearLine, p: Period) => l.dueYear === p.year && l.dueMonth === p.month;

/** The due date of a line with a day; a day past the month's end means the month's last day. */
function dueDate(l: DailyYearLine): IsoDate | null {
  if (l.dueMonth === null || l.dueDay === null) return null;
  return iso(l.dueYear, l.dueMonth, Math.min(l.dueDay, daysInMonth(l.dueYear, l.dueMonth)));
}

function minusDays(date: IsoDate, days: number): IsoDate {
  const t = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) - days * 86_400_000;
  const d = new Date(t);
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Decides which reminders one family gets today (PRD §5.5, TRD §8.4). Pure: no I/O, no clock. The daily job sends
 * them and skips any (user, dedupe key) already sent, so each reminder reaches each person once.
 */
export class PlanDailyNotificationsUseCase {
  execute(facts: DailyFacts): DailyPlan {
    const today = facts.today;
    const day = Number(today.slice(8, 10));
    const current: Period = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
    const planned: Omit<PlannedNotification, 'userId'>[] = [];
    const add = (kind: ReminderKind, dedupeKey: string, message: ReminderMessage['values'], url: string, emailFallback: boolean) =>
      planned.push({ kind, dedupeKey, message: { key: kind, values: message }, url, emailFallback });

    if (day === 1 && facts.checklistPending) add('checklist', `checklist:${ym(current)}`, {}, '/home', false);

    const bills = facts.yearLines.filter(owed);
    if (day === 1) {
      const next = addMonths(current, 1);
      const potAtMonthEnd = facts.forecast.months[0]?.endMinor ?? facts.forecast.balanceMinor;
      for (const l of bills.filter((b) => dueIn(b, next))) {
        add('bill_prior_month', `bill:${l.id}:bill_prior_month:${ym(next)}`, { name: l.name, amountMinor: l.remainingMinor, potMinor: potAtMonthEnd }, `/year/${l.dueYear}`, true);
      }
      for (const l of bills.filter((b) => dueIn(b, current))) {
        add('bill_due_month', `bill:${l.id}:bill_due_month:${ym(current)}`, { name: l.name, amountMinor: l.remainingMinor, potMinor: facts.forecast.balanceMinor }, `/year/${l.dueYear}`, true);
      }
    }
    for (const l of bills) {
      const due = dueDate(l);
      if (due && minusDays(due, 3) === today) {
        add('bill_3_days', `bill:${l.id}:bill_3_days:${due.slice(0, 7)}`, { name: l.name, amountMinor: l.remainingMinor, dueDate: due }, `/year/${l.dueYear}`, true);
      }
    }

    const { notify, next } = redDecision(facts);
    if (notify && next) add('red', `red:${today}`, { period: next.firstRed, shortfallMinor: next.shortfallMinor }, '/forecast', true);

    const undated = facts.forecast.undated.filter((u) => u.count > 0);
    if (day === 15 && undated.length > 0) {
      add(
        'undated',
        `undated:${ym(current)}`,
        { count: undated.reduce((n, u) => n + u.count, 0), totalMinor: sumMinor(undated.map((u) => u.totalMinor)) },
        `/year/${undated[0]!.year}`,
        false,
      );
    }

    return {
      notifications: planned.flatMap((n) => facts.members.map((m) => ({ userId: m.userId, ...n }))),
      nextRedState: next === null ? null : notify ? next : facts.lastRedState,
    };
  }
}

/**
 * Warn only when red appears, the shortfall grows by more than 10%, or the first red month moves earlier, compared with
 * the last warning sent. A clear forecast resets the state, so an unresolved bill does not re-alert every month.
 */
function redDecision(facts: DailyFacts): { notify: boolean; next: RedState | null } {
  const [firstRed] = facts.forecast.redMonths;
  if (!firstRed) return { notify: false, next: null };
  const shortfallMinor = Math.max(...facts.forecast.months.map((m) => -m.endMinor));
  const next: RedState = { firstRed, shortfallMinor };
  const last = facts.lastRedState;
  if (!last) return { notify: true, next };
  // shortfall > 110% of the last one, in integers: 10·new > 11·old.
  const grew = shortfallMinor * 10 > last.shortfallMinor * 11;
  const earlier = comparePeriods(firstRed, last.firstRed) < 0;
  return { notify: grew || earlier, next };
}

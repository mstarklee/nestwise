import 'server-only';
import { NotSignedInError, type SessionUser } from '@nestwise/domain/auth';
import { type Family, NotAMemberError } from '@nestwise/domain/family';
import { type Actor, type IsoDate, type Period, periodOf, todayIn } from '@nestwise/domain/shared';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { systemClock } from '../adapters/shared/system-clock';
import { makeResolveSessionUseCase } from '../composition/auth';
import { makeGetFamilyUseCase, makeResolveActorUseCase } from '../composition/family';
import { makeGetSetupStatusUseCase } from '../composition/year-plan';

/**
 * For Server Components (inbound adapters, like route handlers): the signed-in user from the nw_session cookie.
 * Not signed in → /sign-in. Call it inside a <Suspense> boundary (it reads the request).
 */
export async function pageUser(next?: string): Promise<SessionUser> {
  const token = (await cookies()).get('nw_session')?.value ?? null;
  try {
    return await makeResolveSessionUseCase().execute({ token });
  } catch (error) {
    if (error instanceof NotSignedInError) redirect(next ? `/sign-in?next=${encodeURIComponent(next)}` : '/sign-in');
    throw error;
  }
}

/** The signed-in user with no family yet gets undefined (setup decides what to show). */
export async function pageActorOrNone(user: SessionUser): Promise<Actor | undefined> {
  try {
    return await makeResolveActorUseCase().execute({ userId: user.userId });
  } catch (error) {
    if (error instanceof NotAMemberError) return undefined;
    throw error;
  }
}

export interface PageContext {
  readonly user: SessionUser;
  readonly actor: Actor;
  readonly family: Family;
  /** Today and this month in the family's time zone. */
  readonly today: IsoDate;
  readonly current: Period;
}

/**
 * Everything a family page needs. No family yet → /setup. An admin whose setup is not finished goes back to /setup
 * BEFORE any page reads data: reads create this month's budget and this year's plan from the templates, and doing that
 * before the plan is imported would leave them empty (a background prefetch of Home during setup did exactly that).
 */
export async function pageContext(): Promise<PageContext> {
  const user = await pageUser();
  const actor = await pageActorOrNone(user);
  if (!actor) redirect('/setup');
  const { family } = await makeGetFamilyUseCase().execute({ actor });
  const today = todayIn(family.timeZone, systemClock.now());
  const current = periodOf(today);
  if (actor.role === 'admin' && !(await makeGetSetupStatusUseCase().execute({ actor, year: current.year })).firstYearCheckDone) redirect('/setup');
  return { user, actor, family, today, current };
}

/** The family's money settings, for formatMoney in client components. */
export const moneyOf = (family: Family) => ({ currency: family.currencyCode, minorUnit: family.minorUnit, locale: family.numberLocale });

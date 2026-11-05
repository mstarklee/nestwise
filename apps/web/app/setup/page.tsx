import { CURRENCIES, periodOf, todayIn } from '@nestwise/domain/shared';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { systemClock } from '@/adapters/shared/system-clock';
import { makeGetFamilyUseCase } from '@/composition/family';
import { makeGetTemplatesUseCase } from '@/composition/plan';
import { makeGetSetupStatusUseCase, makeGetYearPlanUseCase } from '@/composition/year-plan';
import { AuthFrame } from '@/components/auth-frame';
import { PageLoading } from '@/components/page-loading';
import { moneyOf, pageActorOrNone, pageUser } from '@/http/page-session';
import { setupShowsImport } from '@/http/signup-gate';
import { FamilyForm } from './family-form';
import { FirstYearCheckForm } from './first-year-check-form';
import { PlanStep } from './plan-step';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Outside the app layout on purpose: no navigation links, so nothing else is loaded (or created) during setup. */
export default function SetupPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense
      fallback={
        <AuthFrame>
          <PageLoading />
        </AuthFrame>
      }
    >
      <Setup searchParams={searchParams} />
    </Suspense>
  );
}

/** Setup, one step at a time: the family, then its plan, then the first-year check. Each step shows until it is done. */
async function Setup({ searchParams }: { searchParams: SearchParams }) {
  const user = await pageUser();
  const actor = await pageActorOrNone(user);
  if (!actor)
    return (
      <AuthFrame step={{ n: 1, of: 3 }}>
        <FamilyForm currencies={[...CURRENCIES.keys()]} />
      </AuthFrame>
    );

  const templates = await makeGetTemplatesUseCase().execute({ actor });
  const hasPlan = templates.monthly.length + templates.savings.length + templates.yearly.length > 0;
  if (!hasPlan && (await searchParams).plan !== 'empty') return (
      <AuthFrame step={{ n: 2, of: 3 }}>
        <PlanStep canImport={setupShowsImport(user.email, actor.role)} />
      </AuthFrame>
    );
  if (actor.role !== 'admin' || (await makeGetSetupStatusUseCase().execute({ actor })).firstYearCheckDone) redirect('/home');

  const { family } = await makeGetFamilyUseCase().execute({ actor });
  const current = periodOf(todayIn(family.timeZone, systemClock.now()));
  const view = await makeGetYearPlanUseCase().execute({ actor, year: current.year });

  // Lines still possibly to come: undated ones, and dated ones due from this month on (PRD §6.1).
  const lines = view.lines
    .filter((l) => l.state === 'open' && l.dueYear === current.year && (l.dueMonth === null || l.dueMonth >= current.month))
    .map((l) => ({ id: l.id, name: l.name, plannedMinor: l.plannedMinor, dueMonth: l.dueMonth }));
  return (
    <AuthFrame step={{ n: 3, of: 3 }}>
      <FirstYearCheckForm
        year={current.year}
        setupMonth={`${current.year}-${String(current.month).padStart(2, '0')}`}
        lines={lines}
        money={moneyOf(family)}
      />
    </AuthFrame>
  );
}

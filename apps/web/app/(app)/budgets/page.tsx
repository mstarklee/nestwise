import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { toYm } from '@/client/format';
import { PageLoading } from '@/components/page-loading';
import { pageContext } from '@/http/page-session';

export default function BudgetsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Budgets />
    </Suspense>
  );
}

/** The Budgets tab opens straight onto this month; Templates is a button in that screen's header. */
async function Budgets(): Promise<never> {
  const { current } = await pageContext();
  redirect(`/month/${toYm(current)}`);
}

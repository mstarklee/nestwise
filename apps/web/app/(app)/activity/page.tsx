import { ActivityQuery } from '@nestwise/api-contract';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { makeListActivityUseCase } from '@/composition/activity';
import { PageLoading } from '@/components/page-loading';
import { Card } from '@/components/ui/card';
import { pageContext } from '@/http/page-session';

type Search = Promise<{ before?: string }>;

export default function ActivityPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Activity searchParams={searchParams} />
    </Suspense>
  );
}

/** The activity history (PRD §6.9): every change and decision, who made it and when. */
async function Activity({ searchParams }: { searchParams: Search }) {
  const { actor, family } = await pageContext();
  const t = await getTranslations('activity');
  const query = ActivityQuery.safeParse(await searchParams);
  const page = await makeListActivityUseCase().execute({ actor, limit: 30, before: query.success ? query.data.before : undefined });
  const when = new Intl.DateTimeFormat(family.numberLocale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: family.timeZone });

  return (
    <div className="space-y-4 py-4">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <p className="text-sm text-zinc-600">{t('explain')}</p>
      <Card className="space-y-2">
        <Link href="/ledger" className="block text-green-900 underline">
          {t('ledger')}
        </Link>
        <Link href="/settings/account" className="block text-green-900 underline">
          {t('settings')}
        </Link>
        <Link href="/install" className="block text-green-900 underline">
          {t('install')}
        </Link>
      </Card>
      {page.rows.length === 0 && <Card>{t('empty')}</Card>}
      {page.rows.length > 0 && (
        <Card>
          <ul className="divide-y divide-zinc-100 text-sm">
            {page.rows.map((row) => (
              <li key={row.id} className="py-2">
                <p>{t('row', { who: row.actorId === actor.userId ? 'me' : row.actorEmail, action: row.action.replaceAll('.', '_') })}</p>
                <p className="text-xs text-zinc-500">
                  {when.format(row.at)}
                  {row.lateEdit && ` · ${t('late')}`}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {page.nextBefore !== null && (
        <Link href={`/activity?before=${page.nextBefore}`} className="block text-center text-sm text-green-900 underline">
          {t('more')}
        </Link>
      )}
    </div>
  );
}

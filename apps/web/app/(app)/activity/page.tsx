import { ActivityQuery } from '@nestwise/api-contract';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { makeListActivityUseCase } from '@/composition/activity';
import { Icon, type FrameIcon } from '@/components/icon';
import { NavLink } from '@/components/nav-link';
import { PageLoading } from '@/components/page-loading';
import { TabHeader } from '@/components/screen-header';
import { pageContext } from '@/http/page-session';

type Search = Promise<{ before?: string }>;

export default function ActivityPage({ searchParams }: { searchParams: Search }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Activity searchParams={searchParams} />
    </Suspense>
  );
}

const ROUND = 'flex size-11 items-center justify-center rounded-full bg-white/15 transition-transform active:scale-[.97] motion-reduce:transform-none';

/** The activity history (PRD 6.9): every change and decision as a timeline: who, what happened, and when. */
async function Activity({ searchParams }: { searchParams: Search }) {
  const { actor, family } = await pageContext();
  const t = await getTranslations('activity');
  const query = ActivityQuery.safeParse(await searchParams);
  const page = await makeListActivityUseCase().execute({ actor, limit: 30, before: query.success ? query.data.before : undefined });
  const when = new Intl.DateTimeFormat(family.numberLocale, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: family.timeZone });
  const links: { href: string; label: string; icon: FrameIcon }[] = [
    { href: '/ledger', label: t('ledger'), icon: 'bills' },
    { href: '/install', label: t('install'), icon: 'bell' },
    { href: '/settings/account', label: t('settings'), icon: 'settings' },
  ];

  return (
    <>
      <TabHeader
        title={t('title')}
        action={links.map((l) => (
          <NavLink key={l.href} href={l.href} direction="forward" aria-label={l.label} className={ROUND}>
            <Icon name={l.icon} className="size-6" />
          </NavLink>
        ))}
      />
      <div className="mx-auto max-w-xl space-y-4">
        <p className="text-[14px] text-muted">{t('explain')}</p>
        {page.rows.length === 0 && <p className="rounded-card bg-white p-4 shadow-card">{t('empty')}</p>}
        {page.rows.length > 0 && (
          <section className="rounded-card bg-white p-4 shadow-card">
            <ul>
              {page.rows.map((row) => {
                const mine = row.actorId === actor.userId;
                return (
                  <li key={row.id} className="flex gap-3 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0">
                    <span
                      aria-hidden="true"
                      className={`grid size-10 shrink-0 place-items-center rounded-full font-display text-[16px] font-bold text-white ${mine ? 'bg-peacock' : 'bg-rani'}`}
                    >
                      {(row.actorEmail.trim()[0] ?? '?').toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="break-words text-[15px]">{t('row', { who: mine ? 'me' : row.actorEmail, action: row.action.replaceAll('.', '_') })}</p>
                      <p className="flex flex-wrap items-center gap-x-2 text-[13.5px] text-muted">
                        <span>{when.format(row.at)}</span>
                        {row.lateEdit && <span className="rounded-full bg-gold px-2 text-[13px] font-semibold text-ink">{t('late')}</span>}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
        {page.nextBefore !== null && (
          <NavLink href={`/activity?before=${page.nextBefore}`} direction="tab" className="flex min-h-11 items-center justify-center rounded-action bg-white font-semibold text-peacock shadow-card">
            {t('more')}
          </NavLink>
        )}
      </div>
    </>
  );
}

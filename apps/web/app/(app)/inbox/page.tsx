import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { formatDay, formatMoney } from '@/client/format';
import { makeListInboxUseCase } from '@/composition/duplicates';
import { DuplicateQuestion } from '@/components/duplicate-question';
import { Icon } from '@/components/icon';
import { NavLink } from '@/components/nav-link';
import { DetailHeader } from '@/components/screen-header';
import { PageLoading } from '@/components/page-loading';
import { Card } from '@/components/ui/card';
import { moneyOf, pageContext } from '@/http/page-session';

export default function InboxPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Inbox />
    </Suspense>
  );
}

/** Expenses waiting for an answer to "Same purchase?" (PRD §6.8). Nothing here counts until someone answers. */
async function Inbox() {
  const { actor, family } = await pageContext();
  const t = await getTranslations('inbox');
  const money = moneyOf(family);
  const exact = (minor: number) => formatMoney(minor, money.currency, money.minorUnit, money.locale);
  const { duplicates, captures } = await makeListInboxUseCase().execute({ actor });

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <DetailHeader title={t('title')} />
      <p className="text-[14px] text-muted">{t('explain')}</p>
      {duplicates.length === 0 && captures.length === 0 && <Card>{t('empty')}</Card>}

      {captures.map((note) => (
        <Card key={note.batchId} className="space-y-2">
          <p className="flex items-center gap-2 font-semibold"><Icon name="mic" className="size-5 shrink-0 text-rani" />{t('voiceWaiting', { count: note.entries.filter((e) => !e.dropped).length, mine: note.mine ? 'me' : 'family' })}</p>
          <p className="text-[14px] text-muted">“{note.transcript}”</p>
          {note.mine ? (
            <NavLink href={`/capture/${note.batchId}`} direction="forward" className="flex min-h-11 items-center justify-center rounded-action bg-peacock px-4 font-semibold text-white">
              {t('voiceCheck')}
            </NavLink>
          ) : (
            <p className="text-[13.5px] text-muted">{t('voiceTheirs')}</p>
          )}
        </Card>
      ))}

      {duplicates.map((entry) => (
        <Card key={entry.matchId} className="space-y-2">
          <p className="font-semibold">
            {t('waiting', { amount: exact(entry.pending.amountMinor), day: formatDay(entry.pending.txnDate, money.locale), mine: entry.pending.enteredBy === actor.userId ? 'me' : 'family' })}
          </p>
          {actor.role === 'viewer' ? null : (
            <DuplicateQuestion
              matchId={entry.matchId}
              amount={exact(entry.other.amountMinor)}
              shop={entry.other.merchant}
              day={formatDay(entry.other.txnDate, money.locale)}
              mine={entry.other.enteredBy === actor.userId}
            />
          )}
        </Card>
      ))}
    </div>
  );
}

import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { formatDay, formatMoney } from '@/client/format';
import { makeListInboxUseCase } from '@/composition/duplicates';
import { DuplicateQuestion } from '@/components/duplicate-question';
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
  const entries = await makeListInboxUseCase().execute({ actor });

  return (
    <div className="space-y-4 py-4">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <p className="text-sm text-zinc-600">{t('explain')}</p>
      {entries.length === 0 && <Card>{t('empty')}</Card>}
      {entries.map((entry) => (
        <Card key={entry.matchId} className="space-y-2">
          <p className="text-sm font-medium">
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

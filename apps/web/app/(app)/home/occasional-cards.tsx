import { addMonths, type Period } from '@nestwise/domain/shared';
import type { HomeCard } from '@nestwise/domain/forecast';
import { useTranslations } from 'next-intl';
import { formatPeriod, toYm } from '@/client/format';
import type { IconName } from '@/client/group-icon';
import { Icon, type FrameIcon } from '@/components/icon';
import { NavLink } from '@/components/nav-link';

function CardRow({ icon, text, href, action, tone = 'peacock' }: { icon: IconName | FrameIcon; text: string; href: string; action: string; tone?: 'peacock' | 'rani' | 'gold' }) {
  const tile = tone === 'rani' ? 'bg-rani/10 text-rani' : tone === 'gold' ? 'bg-gold/30 text-ink' : 'bg-peacock/10 text-peacock';
  return (
    <section className="rounded-card bg-white p-4 shadow-card">
      <div className="flex items-center gap-3">
        <span className={`grid size-[42px] shrink-0 place-items-center rounded-[14px] ${tile}`}>
          <Icon name={icon} className="size-6" />
        </span>
        <p className="min-w-0 flex-1 text-[15px]">{text}</p>
      </div>
      <NavLink href={href} direction="forward" className="mt-3 flex min-h-11 items-center justify-center rounded-action bg-peacock px-4 font-semibold text-white transition-transform active:scale-[.97] motion-reduce:transform-none">
        {action}
      </NavLink>
    </section>
  );
}

/** The cards that only appear sometimes: last month's review, next year's check, the year-end review and the Inbox count. */
export function OccasionalCards(props: { cards: readonly HomeCard[]; current: Period; locale: string; waitingCount: number }) {
  const t = useTranslations('home');
  const { cards, current } = props;
  const last = addMonths(current, -1);
  return (
    <>
      {cards.includes('next_year') && (
        <CardRow icon="calendar" tone="gold" text={t('nextYear', { year: current.year + 1 })} href={`/year/${current.year + 1}/review`} action={t('openNextYear')} />
      )}
      {cards.includes('year_end') && (
        <CardRow icon="alert" tone="rani" text={t('yearEnd', { year: current.year - 1 })} href={`/year/${current.year - 1}/year-end`} action={t('openYearEnd')} />
      )}
      {cards.includes('month_review') && (
        <CardRow icon="activity" text={t('monthReview', { month: formatPeriod(last, props.locale) })} href={`/month/${toYm(last)}/review`} action={t('openReview')} />
      )}
      {props.waitingCount > 0 && <CardRow icon="bell" tone="gold" text={t('inboxCount', { count: props.waitingCount })} href="/inbox" action={t('openInbox')} />}
    </>
  );
}

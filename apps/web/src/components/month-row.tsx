import type { HomeMonth } from '@nestwise/domain/forecast';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { billLine, monthCover } from '@/client/bill-status';
import { formatMoney, formatMoneyRounded, formatMonthShort } from '@/client/format';
import { iconFor } from '@/client/group-icon';
import type { Money } from '@/http/page-session';
import { Icon } from './icon';
import { mTag } from './num';
import { cn } from './ui/cn';

const LINE_STYLE = {
  dueThisMonth: { className: 'text-ink', icon: null },
  overdue: { className: 'text-rani', icon: 'alert' },
  partPaid: { className: 'w-fit rounded-full bg-gold px-2 text-ink', icon: null },
  paid: { className: 'text-leaf', icon: 'check' },
} as const;

/**
 * One month of yearly bills: a month badge (filled peacock for the current month), each bill with its icon, the amount
 * still owed and a status in words, then once per month whether the pot covers it. The shortfall belongs to the pot,
 * never to a single bill.
 */
export function MonthRow({ month, isCurrent, money, detail }: { month: HomeMonth; isCurrent: boolean; money: Money; detail?: ReactNode }) {
  const t = useTranslations('home');
  const exact = (minor: number) => formatMoney(minor, money.currency, money.minorUnit, money.locale);
  const rounded = (minor: number) => formatMoneyRounded(minor, money.currency, money.minorUnit, money.locale);
  const cover = monthCover(month.endMinor);
  return (
    <li className="grid grid-cols-[58px_1fr] gap-3 border-b border-line py-3 first:pt-1 last:border-b-0 last:pb-1" data-testid="month-row">
      <div className={cn('self-start rounded-chip py-1.5 text-center', isCurrent ? 'bg-peacock text-white' : 'bg-mist text-peacock')}>
        <b className="block font-display text-[19px] leading-tight">{formatMonthShort(month.period, money.locale)}</b>
        <span className={cn('text-[11.5px]', isCurrent ? 'text-white/85' : 'text-muted')}>{month.period.year}</span>
      </div>
      <div className="min-w-0 space-y-2">
        {month.lines.map((line, index) => {
          const key = billLine(line.status, isCurrent);
          const style = key ? LINE_STYLE[key] : null;
          return (
            <div key={line.yearLineId ?? `${line.name}-${index}`}>
              <p className="flex items-center gap-1.5 font-semibold">
                <Icon name={iconFor(line.name)} className="size-[18px] shrink-0 text-peacock" />
                <span className="min-w-0 flex-1 break-words">{line.name}</span>
                <span className="money shrink-0">{exact(line.remainingMinor)}</span>
              </p>
              {key && style ? (
                <p className={cn('flex items-center gap-1 text-[13.5px] font-semibold', style.className)}>
                  {style.icon ? <Icon name={style.icon} className="size-4" /> : null}
                  {t(`bill.${key}`)}
                </p>
              ) : null}
            </div>
          );
        })}
        {month.lines.length === 0 && cover.key === 'covers' ? (
          <p className="text-[14px] text-muted">{t.rich('cover.none', { m: mTag, amount: (rounded(month.endMinor)) })}</p>
        ) : cover.key === 'short' ? (
          <p className="flex items-center gap-1 text-[13.5px] font-semibold text-rani">
            <Icon name="alert" className="size-4 shrink-0" />
            <span>{t.rich('cover.short', { m: mTag, amount: (rounded(cover.shortfallMinor)) })}</span>
          </p>
        ) : (
          <p className="flex items-center gap-1 text-[13.5px] font-semibold text-leaf">
            <Icon name="check" className="size-4 shrink-0" />
            {t('cover.covers')}
          </p>
        )}
        {detail}
      </div>
    </li>
  );
}

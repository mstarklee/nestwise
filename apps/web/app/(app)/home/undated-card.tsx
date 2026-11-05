import type { UndatedSummary } from '@nestwise/domain/forecast';
import { useTranslations } from 'next-intl';
import { formatMoneyRounded } from '@/client/format';
import { Icon } from '@/components/icon';
import { NavLink } from '@/components/nav-link';
import { mTag } from '@/components/num';
import type { Money } from '@/http/page-session';

/** Bills with no month yet: how many, their total, the three largest by name, and a way to give them a month. */
export function UndatedCard({ undated, money }: { undated: UndatedSummary; money: Money }) {
  const t = useTranslations('home.undated');
  const biggest = [...undated.lines].sort((a, b) => b.remainingMinor - a.remainingMinor).slice(0, 3);
  const names = new Intl.ListFormat(money.locale, { type: 'conjunction' }).format(biggest.map((l) => l.name));
  const values = { m: mTag, amount: (formatMoneyRounded(undated.totalMinor, money.currency, money.minorUnit, money.locale)), names };
  return (
    <NavLink href={`/year/${undated.year}`} direction="forward" className="block rounded-card bg-white p-4 shadow-card transition-transform active:scale-[.98] motion-reduce:transform-none">
      <div className="flex items-center gap-3">
        <span className="grid size-[42px] shrink-0 place-items-center rounded-[14px] bg-rani/10 text-rani">
          <Icon name="calendar" className="size-6" />
        </span>
        <p className="min-w-0 text-[14px] text-muted">
          <b className="block text-[15px] font-semibold text-ink">{t('title', { count: undated.count })}</b>
          {undated.count > biggest.length ? t.rich('bodyMore', values) : t.rich('body', values)}
        </p>
      </div>
    </NavLink>
  );
}

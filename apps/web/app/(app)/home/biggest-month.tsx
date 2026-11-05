import type { BiggestMonth } from '@nestwise/domain/forecast';
import { useTranslations } from 'next-intl';
import { formatMoneyRounded, formatPeriod } from '@/client/format';
import { mTag } from '@/components/num';
import type { Money } from '@/http/page-session';

/** The dark card for the month, among months 4–12, whose bills total the most; the gold bar is how much the pot holds today. */
export function BiggestMonthCard({ biggest, potMinor, money }: { biggest: BiggestMonth; potMinor: number; money: Money }) {
  const t = useTranslations('home.biggest');
  const rounded = (minor: number) => formatMoneyRounded(minor, money.currency, money.minorUnit, money.locale);
  const names = new Intl.ListFormat(money.locale, { type: 'conjunction' }).format(biggest.lines.map((l) => l.name));
  const share = biggest.totalMinor > 0 ? Math.max(0, Math.min(1, potMinor / biggest.totalMinor)) : 1;
  return (
    <section aria-label={t('title', { month: formatPeriod(biggest.period, money.locale) })} className="rounded-card bg-peacock-deep p-4 text-white">
      <h2 className="text-[13.5px] font-normal opacity-80">{t('title', { month: formatPeriod(biggest.period, money.locale) })}</h2>
      <p className="money text-[26px] font-extrabold leading-tight">{rounded(biggest.totalMinor)}</p>
      <p className="text-[13.5px] opacity-85">{names}</p>
      <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
        <div className="h-full rounded-full bg-gold" style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
      <p className="mt-1.5 text-[13.5px] opacity-90">
        {biggest.shortOnTheWay
          ? t.rich('short', { m: mTag, amount: (rounded(biggest.shortOnTheWay.shortfallMinor)), month: (formatPeriod(biggest.shortOnTheWay.period, money.locale)) })
          : t.rich('onTrack', { m: mTag, amount: (rounded(biggest.openingMinor)) })}
      </p>
    </section>
  );
}

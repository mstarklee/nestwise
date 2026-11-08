import type { HomeSummary } from '@nestwise/domain/forecast';
import { useTranslations } from 'next-intl';
import { formatMoney, formatMoneyRounded, formatPeriod } from '@/client/format';
import { Icon } from '@/components/icon';
import { mTag } from '@/components/num';
import type { Money } from '@/http/page-session';

/** The yearly bills pot, first in "Coming up": its balance, whether every month is covered, and what goes in. */
export function PotCard({ pot, money }: { pot: HomeSummary['pot']; money: Money }) {
  const t = useTranslations('home');
  const rounded = (minor: number) => formatMoneyRounded(minor, money.currency, money.minorUnit, money.locale);
  return (
    <section aria-labelledby="pot-label" className="on-peacock rounded-card bg-peacock p-4 text-white">
      <h3 id="pot-label" className="text-[13.5px] font-normal opacity-85">
        {t('potLabel')}
      </h3>
      <p data-testid="pot-balance" className={`money text-[32px] font-extrabold leading-tight ${pot.balanceMinor < 0 ? 'text-gold' : ''}`}>
        {rounded(pot.balanceMinor)}
      </p>
      {pot.allCovered ? (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 py-1.5 pl-2 pr-3 text-[13.5px] font-semibold">
          <Icon name="check" className="size-4 shrink-0 text-gold" />
          {t('covered')}
        </p>
      ) : (
        <p className="mt-2 flex items-start gap-1.5 rounded-chip bg-rani py-2 pl-2.5 pr-3 text-[13.5px] font-semibold">
          <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
          <span>
            {pot.firstRed
              ? t.rich('shortBy', {
                  m: mTag,
                  amount: formatMoney(pot.firstRed.shortfallMinor, money.currency, money.minorUnit, money.locale),
                  month: formatPeriod(pot.firstRed.period, money.locale),
                })
              : null}{' '}
            {pot.fixPerMonthMinor !== null
              ? t.rich('fixPerMonth', { m: mTag, amount: rounded(pot.fixPerMonthMinor) })
              : pot.topUpNowMinor !== null
                ? t.rich('topUpNow', { m: mTag, amount: rounded(pot.topUpNowMinor) })
                : null}
          </span>
        </p>
      )}
      <p className="mt-2 text-[13px] opacity-80">{t.rich('setAside', { m: mTag, amount: rounded(pot.setAsideMinor) })}</p>
      <p className="text-[13px] opacity-80">{t.rich('safeToSpend', { m: mTag, amount: rounded(pot.safeToSpendNowMinor) })}</p>
    </section>
  );
}

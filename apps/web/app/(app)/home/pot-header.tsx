import type { HomeSummary } from '@nestwise/domain/forecast';
import { useTranslations } from 'next-intl';
import { formatMoney, formatMoneyRounded, formatPeriod } from '@/client/format';
import { Icon } from '@/components/icon';
import { NavLink } from '@/components/nav-link';
import { mTag } from '@/components/num';
import { TempleBorder } from '@/components/temple-border';
import type { Money } from '@/http/page-session';

/** Splits "₹1,10,750" into the currency sign and the digits, so the sign can be smaller. */
function splitSign(formatted: string): [string, string] {
  const match = /^([^\d-]*)(.*)$/.exec(formatted);
  return [match?.[1] ?? '', match?.[2] ?? formatted];
}

/** Home's peacock header: greeting, family, the pot as the hero amount, whether it is covered, then the temple border. */
export function PotHeader(props: {
  greeting: 'morning' | 'afternoon' | 'evening';
  familyName: string;
  initial: string;
  inboxWaiting: boolean;
  pot: HomeSummary['pot'];
  money: Money;
}) {
  const t = useTranslations('home');
  const { pot, money } = props;
  const rounded = (minor: number) => formatMoneyRounded(minor, money.currency, money.minorUnit, money.locale);
  const [sign, digits] = splitSign(rounded(pot.balanceMinor));
  const covered = pot.allCovered;
  return (
    <header className="on-peacock -mx-4 bg-peacock text-white md:mx-0 md:rounded-b-card md:overflow-hidden">
      <div className="px-5 pb-5 pt-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14px] opacity-80">{t(`greeting.${props.greeting}`)}</p>
            <h1 className="break-words font-display text-[22px] font-bold leading-tight">{props.familyName}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <NavLink href="/inbox" direction="forward" aria-label={t('inbox')} className="relative flex size-11 items-center justify-center rounded-chip bg-white/15">
              <Icon name="bell" className="size-6" />
              {props.inboxWaiting ? <span aria-hidden="true" className="absolute right-2.5 top-2.5 size-2 rounded-full bg-gold ring-2 ring-peacock" /> : null}
            </NavLink>
            <NavLink
              href="/settings/account"
              direction="forward"
              aria-label={t('settings')}
              className="flex size-11 items-center justify-center rounded-full bg-gold font-display text-[18px] font-bold text-ink"
            >
              {props.initial}
            </NavLink>
          </div>
        </div>

        <h2 className="mt-5 text-[14px] font-normal opacity-85">{t('potLabel')}</h2>
        <p data-testid="pot-balance" className={`money text-[46px] font-extrabold leading-[1.05] ${pot.balanceMinor < 0 ? 'text-gold' : ''}`}>
          <small className="mr-0.5 text-[26px] font-bold opacity-90">{sign}</small>
          {digits}
        </p>

        {covered ? (
          <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/15 py-1.5 pl-2 pr-3 text-[13.5px] font-semibold">
            <Icon name="check" className="size-4 shrink-0 text-gold" />
            {t('covered')}
          </p>
        ) : (
          <p className="mt-2.5 flex items-start gap-1.5 rounded-chip bg-rani py-2 pl-2.5 pr-3 text-[13.5px] font-semibold">
            <Icon name="alert" className="mt-0.5 size-4 shrink-0" />
            <span>
              {pot.firstRed
                ? t.rich('shortBy', { m: mTag, amount: (formatMoney(pot.firstRed.shortfallMinor, money.currency, money.minorUnit, money.locale)), month: (formatPeriod(pot.firstRed.period, money.locale)) })
                : null}{' '}
              {pot.fixPerMonthMinor !== null
                ? t.rich('fixPerMonth', { m: mTag, amount: (rounded(pot.fixPerMonthMinor)) })
                : pot.topUpNowMinor !== null
                  ? t.rich('topUpNow', { m: mTag, amount: (rounded(pot.topUpNowMinor)) })
                  : null}
            </span>
          </p>
        )}

        <p className="mt-2 text-[13.5px] opacity-80">{t.rich('setAside', { m: mTag, amount: (rounded(pot.setAsideMinor)) })}</p>
        <p className="text-[13.5px] opacity-80">{t.rich('safeToSpend', { m: mTag, amount: (rounded(pot.safeToSpendNowMinor)) })}</p>
      </div>
      <TempleBorder />
    </header>
  );
}

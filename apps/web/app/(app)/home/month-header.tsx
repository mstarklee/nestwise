import type { HomeSummary } from '@nestwise/domain/forecast';
import { useTranslations } from 'next-intl';
import { formatMoneyRounded } from '@/client/format';
import { Icon } from '@/components/icon';
import { NavLink } from '@/components/nav-link';
import { mTag } from '@/components/num';
import { TempleBorder } from '@/components/temple-border';
import type { Money } from '@/http/page-session';

/** Splits "₹39,750" into the currency sign and the digits, so the sign can be smaller. */
function splitSign(formatted: string): [string, string] {
  const match = /^([^\d-]*)(.*)$/.exec(formatted);
  return [match?.[1] ?? '', match?.[2] ?? formatted];
}

/**
 * Home's peacock header: greeting and family, then this month as the hero (paid so far of the whole month's plan,
 * with a gold bar) and one strip for the bills: how many are paid and what is still to pay.
 */
export function MonthHeader(props: {
  greeting: 'morning' | 'afternoon' | 'evening';
  familyName: string;
  initial: string;
  inboxWaiting: boolean;
  monthName: string;
  thisMonth: HomeSummary['thisMonth'];
  money: Money;
}) {
  const t = useTranslations('home');
  const { thisMonth, money } = props;
  const rounded = (minor: number) => formatMoneyRounded(minor, money.currency, money.minorUnit, money.locale);
  const [sign, digits] = splitSign(rounded(thisMonth.paidMinor));
  const share = thisMonth.plannedMinor > 0 ? Math.max(0, Math.min(1, thisMonth.paidMinor / thisMonth.plannedMinor)) : 0;
  const bills = thisMonth.bills;
  return (
    <header className="on-peacock -mx-4 bg-peacock text-white md:mx-0 md:overflow-hidden md:rounded-b-card">
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

        <h2 className="mt-5 text-[14px] font-normal opacity-85">{t('month.soFar', { month: props.monthName })}</h2>
        <p data-testid="month-paid" className="money text-[44px] font-extrabold leading-[1.05]">
          <small className="mr-0.5 text-[25px] font-bold opacity-90">{sign}</small>
          {digits}
        </p>
        <p data-testid="month-planned" className="text-[14.5px] opacity-90">
          {t.rich('month.ofPlanned', { m: mTag, amount: rounded(thisMonth.plannedMinor) })}
        </p>
        <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-white/20" aria-hidden="true">
          <div className="h-full rounded-full bg-gold" style={{ width: `${Math.round(share * 100)}%` }} />
        </div>

        {bills.count > 0 && (
          <div data-testid="bills-strip" className="mt-3 flex items-center justify-between gap-2 rounded-chip bg-white/15 px-3 py-2 text-[13.5px]">
            <p>{t.rich('month.billsPaid', { m: mTag, paid: bills.paidCount, count: bills.count })}</p>
            <p className="text-right">
              {bills.toPayMinor > 0 ? t.rich('month.stillToPay', { m: mTag, amount: rounded(bills.toPayMinor) }) : t('month.allPaid')}
            </p>
          </div>
        )}
      </div>
      <TempleBorder />
    </header>
  );
}

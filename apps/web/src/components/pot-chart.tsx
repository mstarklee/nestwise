import type { ForecastMonth } from '@nestwise/domain/forecast';
import { useTranslations } from 'next-intl';
import { formatMoneyRounded, formatMonthShort } from '@/client/format';
import type { Money } from '@/http/page-session';
import { Icon } from './icon';

const HEIGHT = 150;

/**
 * Twelve bars of month-end pot balance from a zero line. Leaf bars are at or above the line; a pink bar dipping below it
 * is a short month. The months under the bars are named, and the chart's own label reads the figures in words.
 */
export function PotChart({ months, money }: { months: readonly ForecastMonth[]; money: Money }) {
  const t = useTranslations('forecast');
  const rounded = (minor: number) => formatMoneyRounded(minor, money.currency, money.minorUnit, money.locale);
  const high = Math.max(0, ...months.map((m) => m.endMinor));
  const low = Math.min(0, ...months.map((m) => m.endMinor));
  const span = Math.max(1, high - low);
  const zeroY = (high / span) * HEIGHT;
  const label = t('chartLabel', {
    months: months.map((m) => t('chartMonth', { month: formatMonthShort(m.period, money.locale), amount: rounded(m.endMinor) })).join(', '),
  });
  return (
    <div role="img" aria-label={label}>
      <div className="relative" style={{ height: HEIGHT + 8 }}>
        <div aria-hidden="true" className="absolute inset-x-0 border-t border-dashed border-muted/50" style={{ top: zeroY }} />
        <ul aria-hidden="true" className="absolute inset-0 flex items-stretch gap-[3px]">
          {months.map((m) => {
            const h = Math.max(3, (Math.abs(m.endMinor) / span) * HEIGHT);
            const short = m.endMinor < 0;
            return (
              <li key={`${m.period.year}-${m.period.month}`} className="relative flex-1">
                <span
                  className={`absolute inset-x-0 rounded-[6px] ${short ? 'bg-rani' : 'bg-leaf'}`}
                  style={short ? { top: zeroY, height: h } : { top: zeroY - h, height: h }}
                />
                {short ? (
                  <span className="absolute left-1/2 -translate-x-1/2 text-rani" style={{ top: zeroY - 18 }}>
                    <Icon name="alert" className="size-3.5" />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
      <ul aria-hidden="true" className="mt-1 flex gap-[3px]">
        {months.map((m) => (
          <li key={`${m.period.year}-${m.period.month}`} className={`flex-1 text-center text-[11.5px] ${m.endMinor < 0 ? 'font-bold text-rani' : 'text-muted'}`}>
            {formatMonthShort(m.period, money.locale)}
          </li>
        ))}
      </ul>
    </div>
  );
}

import { useTranslations } from 'next-intl';
import { formatMoneyRounded } from '@/client/format';
import { byMostUsed, ringOf, type Ring, type RingTone } from '@/client/ring';
import type { Money } from '@/http/page-session';
import { Icon } from './icon';
import { mTag } from './num';

const TONE_COLOR: Record<RingTone, string> = {
  fine: 'var(--color-peacock)',
  near: 'var(--color-gold)',
  over: 'var(--color-rani)',
};

/** One ring: the share used in the middle (an icon when the plan is zero), coloured by how close the group is to its plan. */
export function RingDial({ ring, size = 70 }: { ring: Ring; size?: number }) {
  const t = useTranslations('home.spending');
  const fill = Math.min(100, ring.percent ?? 100);
  const inner = size - 16;
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full"
      style={{ width: size, height: size, background: `conic-gradient(${TONE_COLOR[ring.tone]} ${fill}%, var(--color-line) 0)` }}
    >
      <span className="money grid place-items-center rounded-full bg-white font-extrabold" style={{ width: inner, height: inner, fontSize: size > 60 ? 16 : 13 }}>
        {ring.percent === null ? <Icon name={ring.tone === 'over' ? 'alert' : 'check'} className="size-5" /> : t('percentUsed', { percent: ring.percent })}
      </span>
    </div>
  );
}

export interface RingGroup {
  readonly groupName: string;
  readonly plannedMinor: number;
  readonly actualMinor: number;
}

/**
 * One ring per spending group, most used first, in a row that scrolls sideways. The colour (peacock, gold, pink) follows
 * the family's alert levels, and the words under the ring say "over" so colour is never the only signal.
 */
export function SpendingRings({ groups, alertThresholds, money }: { groups: readonly RingGroup[]; alertThresholds: readonly number[]; money: Money }) {
  const t = useTranslations('home.spending');
  const rounded = (minor: number) => formatMoneyRounded(minor, money.currency, money.minorUnit, money.locale);
  return (
    <ul tabIndex={0} aria-label={t('groupsLabel')} className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
      {byMostUsed(groups).map((group) => {
        const ring = ringOf(group.actualMinor, group.plannedMinor, alertThresholds);
        return (
          <li key={group.groupName} className="w-[88px] shrink-0 snap-start text-center" data-tone={ring.tone}>
            <div className="mx-auto mb-1.5 w-fit">
              <RingDial ring={ring} />
            </div>
            <p className="line-clamp-2 break-words text-[13px] font-semibold leading-tight">{group.groupName}</p>
            {ring.tone === 'over' ? (
              <p className="money text-[12px] font-semibold text-rani">{t.rich('over', { m: mTag, amount: (rounded(ring.overMinor)) })}</p>
            ) : ring.percent === null ? (
              <p className="text-[12px] text-muted">{t('noPlan')}</p>
            ) : (
              <p className="money text-[12px] text-muted">{rounded(group.actualMinor)}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

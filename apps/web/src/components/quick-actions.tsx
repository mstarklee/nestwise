import { useTranslations } from 'next-intl';
import { Icon } from './icon';
import { NavLink } from './nav-link';
import { ScanSoon } from './scan-soon';

const BIG = 'grid justify-items-center gap-1.5 rounded-action px-1.5 pb-3 pt-3.5 text-[14px] font-bold transition-transform active:scale-[.97] motion-reduce:transform-none md:hover:brightness-95';

/** Speak, Scan and (on Home) Type: three equal big buttons. Speak is pink, Scan is gold, Type is white. */
export function QuickActions({ withType }: { withType: boolean }) {
  const t = useTranslations('home');
  return (
    <div className={withType ? 'grid grid-cols-3 gap-2.5' : 'grid grid-cols-2 gap-2.5'}>
      <NavLink href="/capture" direction="forward" data-testid="home-voice" className={`${BIG} bg-rani text-white`}>
        <span className="grid size-11 place-items-center rounded-full bg-white/20">
          <Icon name="mic" className="size-6" />
        </span>
        {t('speak')}
      </NavLink>
      <ScanSoon className={`${BIG} bg-gold text-ink`} />
      {withType ? (
        <NavLink href="/add" direction="forward" className={`${BIG} bg-white text-peacock shadow-card`}>
          <span className="grid size-11 place-items-center rounded-full bg-mist">
            <Icon name="type" className="size-6" />
          </span>
          {t('type')}
        </NavLink>
      ) : null}
    </div>
  );
}

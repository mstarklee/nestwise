'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import type { Actor } from '@nestwise/domain/shared';
import { activeTab, tabsFor, type TabKey } from '@/client/nav';
import { Icon } from './icon';
import { NavLink } from './nav-link';
import { cn } from './ui/cn';

/** The bar with the current tab marked. */
export function BottomNav({ role }: { role: Actor['role'] }) {
  return <NavBar role={role} pathname={usePathname()} />;
}

/**
 * Under 1,024 px: the floating peacock-deep bar. From 1,024 px: a left side rail with the names shown.
 * With pathname null (the address is not known yet) no tab is marked.
 */
export function NavBar({ role, pathname }: { role: Actor['role']; pathname: string | null }) {
  const t = useTranslations('nav');
  const tabs = tabsFor(role);
  const current: TabKey | null = pathname === null ? null : activeTab(pathname, tabs);
  return (
    <nav
      aria-label={t('label')}
      className={cn(
        'on-peacock fixed z-40 bg-peacock-deep text-white',
        // phone and tablet: floating bar, 10 px in from the sides, 16 px above the safe area
        'inset-x-[10px] bottom-[calc(16px+env(safe-area-inset-bottom))] rounded-[26px] shadow-card',
        // desktop: side rail
        'lg:inset-x-auto lg:inset-y-0 lg:bottom-0 lg:left-0 lg:w-56 lg:rounded-none lg:px-3 lg:pt-8',
      )}
    >
      <ul className="mx-auto flex max-w-xl items-center justify-between px-1 lg:max-w-none lg:flex-col lg:items-stretch lg:gap-2 lg:px-0">
        {tabs.map((tab) => {
          const active = current === tab.key;
          const isAdd = tab.key === 'add';
          return (
            <li key={tab.key} className={cn('flex-1 lg:flex-none', isAdd && 'lg:order-first lg:mb-4')}>
              <NavLink
                href={tab.href}
                direction="tab"
                aria-label={t(tab.key)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-14 items-center justify-center transition-transform active:scale-[.97] motion-reduce:transform-none lg:min-h-12 lg:justify-start lg:gap-3 lg:rounded-action lg:px-4 lg:hover:bg-white/10',
                  active ? 'text-white lg:bg-white/10' : 'text-white/60',
                )}
              >
                {isAdd ? (
                  <span className="flex size-12 items-center justify-center rounded-chip bg-gold text-ink lg:size-auto lg:w-full lg:justify-start lg:gap-3 lg:bg-transparent lg:text-gold">
                    <Icon name="add" className="size-6" />
                    <span className="hidden text-[15px] font-semibold lg:inline">{t(tab.key)}</span>
                  </span>
                ) : (
                  <>
                    <Icon name={tab.key} className="size-6" />
                    <span className="hidden text-[15px] font-semibold lg:inline">{t(tab.key)}</span>
                    {active ? <span aria-hidden="true" className="absolute bottom-1.5 size-1.5 rounded-full bg-gold lg:hidden" /> : null}
                  </>
                )}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

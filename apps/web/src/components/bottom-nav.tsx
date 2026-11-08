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
 * Under 1,024 px: the peacock-deep bar flat on the bottom edge, full width, names under the icons (design
 * 2026-11-08 §5). From 1,024 px: a left side rail with the names beside the icons.
 * With pathname null (the address is not known yet) no tab is marked.
 */
export function NavBar({ role, pathname }: { role: Actor['role']; pathname: string | null }) {
  const t = useTranslations('nav');
  const tabs = tabsFor(role);
  const current: TabKey | null = pathname === null ? null : activeTab(pathname, tabs);
  return (
    <nav
      aria-label={t('label')}
      data-testid="bottom-nav"
      className={cn(
        'on-peacock fixed z-40 bg-peacock-deep text-white',
        // phone and tablet: docked to the bottom edge, with room for the iPhone home indicator
        'pb-safe inset-x-0 bottom-0 shadow-[0_-8px_20px_-14px_rgba(0,63,82,.7)]',
        // desktop: side rail
        'lg:inset-x-auto lg:inset-y-0 lg:left-0 lg:w-56 lg:px-3 lg:pt-8 lg:shadow-none',
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
                  'flex min-h-16 flex-col items-center justify-center gap-0.5 transition-transform active:scale-[.97] motion-reduce:transform-none lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:rounded-action lg:px-4 lg:hover:bg-white/10',
                  active ? 'text-white lg:bg-white/10' : 'text-white/60',
                )}
              >
                {isAdd ? (
                  <span className="flex size-12 items-center justify-center rounded-[18px] bg-gold text-ink lg:size-auto lg:w-full lg:justify-start lg:gap-3 lg:rounded-none lg:bg-transparent lg:text-gold">
                    <Icon name="add" className="size-6" />
                    <span className="hidden text-[15px] font-semibold lg:inline">{t(tab.key)}</span>
                  </span>
                ) : (
                  <>
                    <Icon name={tab.key} className={cn('size-6', active && 'text-gold lg:text-white')} />
                    <span className="text-[11px] font-semibold leading-none lg:text-[15px] lg:leading-normal">{t(tab.key)}</span>
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

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from './ui/cn';

const TABS = [
  { href: '/home', key: 'home', match: ['/home'] },
  { href: '/budgets', key: 'budgets', match: ['/budgets', '/month', '/year', '/templates', '/forecast'] },
  { href: '/add', key: 'add', match: ['/add'] },
  { href: '/activity', key: 'activity', match: ['/activity', '/settings', '/install'] },
] as const;

/** The bar with the current tab marked. */
export function BottomNav() {
  return <NavBar pathname={usePathname()} />;
}

/** The bar itself; with pathname null (while the address is not known yet) no tab is marked. */
export function NavBar({ pathname }: { pathname: string | null }) {
  const t = useTranslations('nav');
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white" aria-label={t('label')}>
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((tab) => {
          const active = pathname !== null && tab.match.some((m) => pathname.startsWith(m));
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={cn('block py-3 text-center text-sm', active ? 'font-semibold text-green-900' : 'text-zinc-600')}
                aria-current={active ? 'page' : undefined}
              >
                {t(tab.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

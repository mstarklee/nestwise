import type { Actor } from '@nestwise/domain/shared';

export type TabKey = 'home' | 'budgets' | 'add' | 'bills' | 'activity';
export interface Tab {
  readonly key: TabKey;
  readonly href: string;
  readonly match: readonly string[];
}

const ALL: readonly Tab[] = [
  { key: 'home', href: '/home', match: ['/home'] },
  { key: 'budgets', href: '/budgets', match: ['/budgets', '/month', '/templates'] },
  { key: 'add', href: '/add', match: ['/add', '/capture'] },
  { key: 'bills', href: '/forecast', match: ['/forecast', '/year'] },
  { key: 'activity', href: '/activity', match: ['/activity', '/ledger', '/inbox', '/settings', '/install'] },
];

/** Viewers cannot add, so they get four buttons. */
export function tabsFor(role: Actor['role']): readonly Tab[] {
  return role === 'viewer' ? ALL.filter((t) => t.key !== 'add') : ALL;
}

const covers = (path: string, prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

export function activeTab(pathname: string, tabs: readonly Tab[]): TabKey | null {
  return tabs.find((t) => t.match.some((m) => covers(pathname, m)))?.key ?? null;
}

/** Where Back goes when the app has no earlier screen of its own: the screen's tab root, else Home. */
export function backTarget(pathname: string): string {
  return ALL.find((t) => t.match.some((m) => covers(pathname, m)))?.href ?? '/home';
}

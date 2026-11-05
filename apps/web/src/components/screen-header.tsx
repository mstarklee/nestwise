import type { ReactNode } from 'react';
import { BackButton } from './back-button';
import { TempleBorder } from './temple-border';

/** Compact peacock header for a tab root (Budgets, Bills, Activity): the title, an optional action, then the temple border. */
export function TabHeader({ title, action, children, border = true }: { title: ReactNode; action?: ReactNode; children?: ReactNode; border?: boolean }) {
  return (
    <header className="on-peacock -mx-4 mb-4 bg-peacock text-white md:mx-0 md:rounded-b-card md:overflow-hidden">
      <div className="flex min-h-14 items-center justify-between gap-3 px-4 pb-3 pt-2">
        <h1 className="min-w-0 truncate text-[26px] font-bold leading-tight">{title}</h1>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </div>
      {children ? <div className="px-4 pb-3">{children}</div> : null}
      {border ? <TempleBorder /> : null}
    </header>
  );
}

/** Compact peacock header for a deeper screen: a round Back button on the left, the title, any action on the right. */
export function DetailHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <header className="on-peacock -mx-4 mb-4 flex min-h-16 items-center gap-3 bg-peacock px-4 pb-3 pt-2 text-white md:mx-0 md:rounded-b-card">
      <BackButton />
      <h1 className="min-w-0 flex-1 truncate text-[22px] font-bold leading-tight">{title}</h1>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </header>
  );
}

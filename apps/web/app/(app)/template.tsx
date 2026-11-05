'use client';

import { useLayoutEffect, useState, type ReactNode } from 'react';
import { DIRECTION_KEY } from '@/components/nav-link';

const CLASS = { forward: 'nw-enter-forward', back: 'nw-enter-back', tab: 'nw-enter-tab' } as const;

/**
 * Page motion without view transitions (they crashed the WebKit used for the browser test): the screen that has just
 * opened slides in from the right when the person went deeper, from the left on Back, and fades in for a tab. The link
 * that was tapped leaves its direction in sessionStorage; this reads and clears it. No motion on a first load or when
 * the phone's Reduce Motion is on (globals.css).
 */
export default function Template({ children }: { children: ReactNode }) {
  const [direction, setDirection] = useState<keyof typeof CLASS | null>(null);
  useLayoutEffect(() => {
    try {
      const d = sessionStorage.getItem(DIRECTION_KEY);
      sessionStorage.removeItem(DIRECTION_KEY);
      if (d === 'forward' || d === 'back' || d === 'tab') setDirection(d);
    } catch {
      /* no storage: the screen simply appears */
    }
  }, []);
  return <div className={direction ? CLASS[direction] : undefined}>{children}</div>;
}

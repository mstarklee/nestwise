'use client';

import { ViewTransition, type ReactNode } from 'react';

/**
 * Each screen enters and leaves with the motion its link asked for: deeper slides in, Back slides out, tabs fade.
 *
 * OFF by default: in the Playwright WebKit used for the browser test, this wrapper made the page crash when leaving the
 * voice review for Home. It has not been proven safe on a real iPhone yet, so screens just change. Set
 * NEXT_PUBLIC_PAGE_SLIDES=on (Vercel env) after checking on the phone to turn the slides on.
 */
export default function Template({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_PAGE_SLIDES !== 'on') return <>{children}</>;
  return (
    <ViewTransition
      default="none"
      enter={{ forward: 'nw-slide-in', back: 'nw-back-in', tab: 'nw-fade-in', default: 'none' }}
      exit={{ forward: 'nw-slide-out', back: 'nw-back-out', tab: 'nw-fade-out', default: 'none' }}
    >
      {children}
    </ViewTransition>
  );
}

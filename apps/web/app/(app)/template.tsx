'use client';

import { ViewTransition, type ReactNode } from 'react';

/** Each screen enters and leaves with the motion its link asked for: deeper slides in, Back slides out, tabs fade. */
export default function Template({ children }: { children: ReactNode }) {
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

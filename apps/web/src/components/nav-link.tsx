'use client';

import Link from 'next/link';
import type { ComponentProps, MouseEvent } from 'react';

export const DEPTH_KEY = 'nw-depth';

/** How many screens deep the app's own history is. Back uses it to tell "go back" from "no earlier screen of ours". */
export function readDepth(): number {
  try {
    return Number(sessionStorage.getItem(DEPTH_KEY) ?? '0') || 0;
  } catch {
    return 0;
  }
}

type Direction = 'forward' | 'back' | 'tab';

/** A link that tells the page slide (forward / back) or fade (tab) how to move, and keeps the in-app history count. */
export function NavLink({ direction, onClick, ...props }: ComponentProps<typeof Link> & { direction: Direction }) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    // Tapping the screen you are already on does nothing (it would only start a pointless transition).
    if (typeof props.href === 'string' && props.href === window.location.pathname) {
      e.preventDefault();
      return;
    }
  };
  return <Link {...props} transitionTypes={[direction]} onClick={handle} />;
}

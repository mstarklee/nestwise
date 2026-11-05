'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { tabsFor } from '@/client/nav';
import { DEPTH_KEY, readDepth } from './nav-link';

const TAB_ROOTS: readonly string[] = tabsFor('admin').map((t) => t.href);

/**
 * Keeps the count of screens deep the app's own history is, from every kind of navigation (links, router.push, the
 * iPhone swipe-back): a browser Back (popstate) subtracts one, a tab root resets to zero, anything else adds one.
 * Back uses it to tell "go back" from "no earlier screen of ours".
 */
export function DepthTracker() {
  const pathname = usePathname();
  const popped = useRef(false);
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const onPop = () => {
      popped.current = true;
      // If the address path does not change (query or hash only), do not let the flag linger.
      requestAnimationFrame(() => setTimeout(() => (popped.current = false), 300));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (previous.current === null) {
      // A screen opened cold (a reminder, a reload) has no earlier screen of ours, whatever an old count says.
      previous.current = pathname;
      try {
        sessionStorage.setItem(DEPTH_KEY, '0');
      } catch {
        /* no storage */
      }
      return;
    }
    if (previous.current === pathname) return;
    previous.current = pathname;
    let depth = readDepth();
    if (popped.current) depth -= 1;
    else if (TAB_ROOTS.includes(pathname)) depth = 0;
    else depth += 1;
    popped.current = false;
    try {
      sessionStorage.setItem(DEPTH_KEY, String(Math.max(0, depth)));
    } catch {
      /* no storage: Back falls back to the tab root */
    }
  }, [pathname]);

  return null;
}

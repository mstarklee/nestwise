import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { BottomNav } from '@/components/bottom-nav';
import { DepthTracker } from '@/components/depth-tracker';
import { OfflineNotice } from '@/components/offline-notice';
import { OutboxSync } from '@/components/outbox-sync';
import { pageContext, pageUser } from '@/http/page-session';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* The peacock strip behind the iPhone status bar: the clock and battery are white (design spec §5.2). */}
      <div aria-hidden="true" className="pt-safe fixed inset-x-0 top-0 z-40 bg-peacock" />
      <Suspense fallback={null}>
        <RenderedOfflineNotice />
      </Suspense>
      <main className="pt-safe mx-auto w-full max-w-xl px-4 pb-[calc(88px+env(safe-area-inset-bottom))] md:max-w-[1100px] lg:pb-10 lg:pl-60 lg:pr-8">
        <Suspense fallback={null}>
          <SignedInOutboxSync />
        </Suspense>
        {children}
      </main>
      {/* The bar needs the signed-in role (a Viewer has no Add), so it appears once that is known. */}
      <Suspense fallback={null}>
        <DepthTracker />
        <SignedInNav />
      </Suspense>
    </>
  );
}

/** The bar shows the Add button only to people who can add. */
async function SignedInNav() {
  const { actor } = await pageContext();
  return <BottomNav role={actor.role} />;
}

/** The outbox belongs to the signed-in person, so it needs to know who that is. */
async function SignedInOutboxSync() {
  const user = await pageUser();
  return <OutboxSync userId={user.userId} />;
}

/** Stamps the page with when it was made, so a copy shown with no signal can say how old its figures are. */
async function RenderedOfflineNotice() {
  await connection();
  return <OfflineNotice asOf={new Date().toISOString()} />;
}

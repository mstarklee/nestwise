import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { BottomNav, NavBar } from '@/components/bottom-nav';
import { OfflineNotice } from '@/components/offline-notice';
import { OutboxSync } from '@/components/outbox-sync';
import { pageUser } from '@/http/page-session';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <RenderedOfflineNotice />
      </Suspense>
      <main className="pt-safe mx-auto w-full max-w-xl px-4 pb-24">
        <Suspense fallback={null}>
          <SignedInOutboxSync />
        </Suspense>
        {children}
      </main>
      {/* The bar reads the current address to mark the active tab; until then it shows with no tab marked. */}
      <Suspense fallback={<NavBar pathname={null} />}>
        <BottomNav />
      </Suspense>
    </>
  );
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

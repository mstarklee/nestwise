import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { BottomNav, NavBar } from '@/components/bottom-nav';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <main className="pt-safe mx-auto w-full max-w-xl px-4 pb-24">{children}</main>
      {/* The bar reads the current address to mark the active tab; until then it shows with no tab marked. */}
      <Suspense fallback={<NavBar pathname={null} />}>
        <BottomNav />
      </Suspense>
    </>
  );
}

import { Suspense } from 'react';
import { PageLoading } from '@/components/page-loading';
import { pageActorOrNone, pageUser } from '@/http/page-session';
import { JoinButton } from './join-button';

type Params = Promise<{ token: string }>;

export default function JoinPage({ params }: { params: Params }) {
  return (
    <main className="pt-safe mx-auto w-full max-w-sm px-4 py-10">
      <Suspense fallback={<PageLoading />}>
        <Join params={params} />
      </Suspense>
    </main>
  );
}

/** The invite link: sign in (or create an account) first, then join the family. */
async function Join({ params }: { params: Params }) {
  const { token } = await params;
  const user = await pageUser(`/join/${token}`); // not signed in → sign in, then back here
  const already = await pageActorOrNone(user);
  return <JoinButton token={token} alreadyInFamily={already !== undefined} />;
}

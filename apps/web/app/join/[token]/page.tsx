import { Suspense } from 'react';
import { AuthFrame } from '@/components/auth-frame';
import { PageLoading } from '@/components/page-loading';
import { pageActorOrNone, pageUser } from '@/http/page-session';
import { JoinButton } from './join-button';

type Params = Promise<{ token: string }>;

export default function JoinPage({ params }: { params: Params }) {
  return (
    <AuthFrame>
      <div className="rounded-card bg-white p-5 shadow-card">
        <Suspense fallback={<PageLoading />}>
          <Join params={params} />
        </Suspense>
      </div>
    </AuthFrame>
  );
}

/** The invite link: sign in (or create an account) first, then join the family. */
async function Join({ params }: { params: Params }) {
  const { token } = await params;
  const user = await pageUser(`/join/${token}`); // not signed in → sign in, then back here
  const already = await pageActorOrNone(user);
  return <JoinButton token={token} alreadyInFamily={already !== undefined} />;
}

import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { Icon, type FrameIcon } from '@/components/icon';
import { NavLink } from '@/components/nav-link';
import { PageLoading } from '@/components/page-loading';
import { DetailHeader } from '@/components/screen-header';
import { pageUser } from '@/http/page-session';
import { SignOutButton } from './sign-out-button';

export default function AccountPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Account />
    </Suspense>
  );
}

function Row({ href, icon, children }: { href: string; icon: FrameIcon; children: string }) {
  return (
    <li>
      <NavLink href={href} direction="forward" className="flex min-h-14 items-center gap-3 px-4 transition-colors active:bg-mist">
        <span className="grid size-9 shrink-0 place-items-center rounded-[12px] bg-peacock/10 text-peacock">
          <Icon name={icon} className="size-5" />
        </span>
        <span className="min-w-0 flex-1 font-semibold">{children}</span>
        <Icon name="next" className="size-5 shrink-0 text-muted" />
      </NavLink>
    </li>
  );
}

async function Account() {
  const user = await pageUser();
  const t = await getTranslations('settings');
  const initial = (user.email.trim()[0] ?? '?').toUpperCase();
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <DetailHeader title={t('accountTitle')} />
      <section className="flex items-center gap-3 rounded-card bg-white p-4 shadow-card">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-gold font-display text-[20px] font-bold text-ink">{initial}</span>
        <div className="min-w-0">
          <p className="text-[13.5px] text-muted">{t('signedInAs')}</p>
          <p className="break-all font-semibold">{user.email}</p>
        </div>
      </section>
      <ul className="divide-y divide-line overflow-hidden rounded-card bg-white shadow-card">
        <Row href="/settings/family" icon="settings">
          {t('familyTitle')}
        </Row>
        <Row href="/install" icon="bell">
          {t('install')}
        </Row>
      </ul>
      <SignOutButton />
    </div>
  );
}

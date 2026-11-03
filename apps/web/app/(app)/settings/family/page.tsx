import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { PageLoading } from '@/components/page-loading';
import { Card, CardTitle } from '@/components/ui/card';
import { pageContext } from '@/http/page-session';
import { FamilySettingsForm } from './family-settings-form';
import { InviteForm } from './invite-form';

export default function FamilySettingsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <FamilySettings />
    </Suspense>
  );
}

async function FamilySettings() {
  const { actor, family } = await pageContext();
  const t = await getTranslations('settings');
  const currencyName = new Intl.DisplayNames(['en'], { type: 'currency' }).of(family.currencyCode);
  return (
    <div className="space-y-4 py-4">
      <h1 className="text-xl font-semibold">{t('familyTitle')}</h1>
      <Card>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-zinc-500">{t('name')}</dt>
          <dd>{family.name}</dd>
          <dt className="text-zinc-500">{t('currency')}</dt>
          <dd>
            {family.currencyCode} · {currencyName} <span className="text-zinc-500">({t('locked')})</span>
          </dd>
          <dt className="text-zinc-500">{t('timeZone')}</dt>
          <dd>{family.timeZone}</dd>
          <dt className="text-zinc-500">{t('yourRole')}</dt>
          <dd>{t(`roles.${actor.role}`)}</dd>
        </dl>
      </Card>
      {actor.role === 'admin' && (
        <Card>
          <CardTitle>{t('changeTitle')}</CardTitle>
          <FamilySettingsForm name={family.name} alertThresholds={family.alertThresholds} />
        </Card>
      )}
      {actor.role === 'admin' && (
        <Card>
          <CardTitle>{t('inviteTitle')}</CardTitle>
          <p className="mb-2 text-sm text-zinc-600">{t('inviteIntro')}</p>
          <InviteForm />
        </Card>
      )}
    </div>
  );
}

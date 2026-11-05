import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { makeGetVoiceUsageUseCase } from '@/composition/capture';
import { PageLoading } from '@/components/page-loading';
import { DetailHeader } from '@/components/screen-header';
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
  const voice = await makeGetVoiceUsageUseCase(family.id).execute({ actor });
  const facts: [string, React.ReactNode][] = [
    [t('name'), family.name],
    [
      t('currency'),
      <>
        {family.currencyCode}, {currencyName} <span className="text-muted">({t('locked')})</span>
      </>,
    ],
    [t('timeZone'), family.timeZone],
    [t('yourRole'), t(`roles.${actor.role}`)],
  ];
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <DetailHeader title={t('familyTitle')} />
      <ul className="divide-y divide-line overflow-hidden rounded-card bg-white shadow-card">
        {facts.map(([label, value]) => (
          <li key={label} className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
            <span className="text-muted">{label}</span>
            <span className="min-w-0 break-words text-right font-semibold">{value}</span>
          </li>
        ))}
      </ul>
      <Card>
        <CardTitle>{t('voiceTitle')}</CardTitle>
        <p className="money">{voice.capPerMonth === null ? t('voiceUsedNoLimit', { used: voice.used }) : t('voiceUsed', { used: voice.used, cap: voice.capPerMonth })}</p>
        <p className="mt-1 text-[13.5px] text-muted">{t('voiceExplain')}</p>
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
          <p className="mb-3 text-[14px] text-muted">{t('inviteIntro')}</p>
          <InviteForm />
        </Card>
      )}
    </div>
  );
}

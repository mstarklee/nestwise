import { useTranslations } from 'next-intl';
import { DetailHeader } from '@/components/screen-header';
import { Card, CardTitle } from '@/components/ui/card';
import { RemindersButton } from './reminders-button';

/** How to put NestWise on the iPhone Home Screen, then turn on reminders (they only work in the installed app). */
export default function InstallPage() {
  const t = useTranslations('install');
  return (
    <div className="mx-auto max-w-xl space-y-4">
      <DetailHeader title={t('title')} />
      <Card>
        <CardTitle>{t('stepsTitle')}</CardTitle>
        <ol className="list-decimal space-y-2 pl-5 text-[15px]">
          <li>{t('step1')}</li>
          <li>{t('step2')}</li>
          <li>{t('step3')}</li>
          <li>{t('step4')}</li>
        </ol>
      </Card>
      <Card>
        <CardTitle>{t('remindersTitle')}</CardTitle>
        <p className="mb-3 text-[14px] text-muted">{t('remindersIntro')}</p>
        <RemindersButton />
      </Card>
    </div>
  );
}

import { useTranslations } from 'next-intl';
import { Card, CardTitle } from '@/components/ui/card';
import { RemindersButton } from './reminders-button';

/** How to put NestWise on the iPhone Home Screen, then turn on reminders (they only work in the installed app). */
export default function InstallPage() {
  const t = useTranslations('install');
  return (
    <div className="space-y-4 py-4">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <Card>
        <CardTitle>{t('stepsTitle')}</CardTitle>
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>{t('step1')}</li>
          <li>{t('step2')}</li>
          <li>{t('step3')}</li>
          <li>{t('step4')}</li>
        </ol>
      </Card>
      <Card>
        <CardTitle>{t('remindersTitle')}</CardTitle>
        <p className="mb-2 text-sm text-zinc-600">{t('remindersIntro')}</p>
        <RemindersButton />
      </Card>
    </div>
  );
}

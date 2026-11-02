import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';

/** The activity screen comes in Stage 1b; every change is already recorded. */
export default function ActivityPage() {
  const t = useTranslations('activity');
  return (
    <div className="space-y-4 py-4">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <Card>{t('comingLater')}</Card>
      <Card className="space-y-2">
        <Link href="/settings/account" className="block text-green-900 underline">
          {t('settings')}
        </Link>
        <Link href="/install" className="block text-green-900 underline">
          {t('install')}
        </Link>
      </Card>
    </div>
  );
}

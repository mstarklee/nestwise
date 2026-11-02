'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

/** "Turn on reminders": wired to web push in plan Task 14. */
export function RemindersButton() {
  const t = useTranslations('install');
  return (
    <Button disabled className="w-full">
      {t('turnOnReminders')}
    </Button>
  );
}

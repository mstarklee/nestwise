'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { type ReminderOutcome, turnOnReminders } from '@/client/push';
import { Button } from '@/components/ui/button';
import { useErrorText } from '@/components/use-error-text';

const OUTCOME_TEXT: Record<ReminderOutcome, string> = {
  on: 'remindersOn',
  not_installed: 'remindersNotInstalled',
  denied: 'remindersDenied',
  unsupported: 'remindersUnsupported',
};

/** "Turn on reminders": asks for permission from this tap (iPhone only allows it then) and subscribes this phone. */
export function RemindersButton() {
  const t = useTranslations('install');
  const errorText = useErrorText();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function tap() {
    setBusy(true);
    try {
      setMessage(t(OUTCOME_TEXT[await turnOnReminders()]));
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button className="w-full" onClick={tap} disabled={busy}>
        {t('turnOnReminders')}
      </Button>
      {message && (
        <p role="status" className="text-sm text-zinc-700">
          {message}
        </p>
      )}
    </div>
  );
}

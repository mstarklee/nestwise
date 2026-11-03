'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { api } from '@/client/api-client';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { useErrorText } from '@/components/use-error-text';

/** Rename the family and choose the spending-alert levels (Admin). The currency stays locked. */
export function FamilySettingsForm({ name, alertThresholds }: { name: string; alertThresholds: readonly number[] }) {
  const t = useTranslations('settings');
  const errorText = useErrorText();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const levels = String(form.get('levels'))
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(Number);
    if (levels.some((l) => !Number.isInteger(l))) {
      setError(t('badLevels'));
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api('PATCH', '/api/v1/families/current', { name: String(form.get('familyName')), alertThresholds: levels });
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div>
        <Label htmlFor="familyName">{t('name')}</Label>
        <Input id="familyName" name="familyName" defaultValue={name} maxLength={80} required />
      </div>
      <div>
        <Label htmlFor="levels">{t('alertLevels')}</Label>
        <Input id="levels" name="levels" inputMode="numeric" defaultValue={alertThresholds.join(', ')} />
        <p className="mt-1 text-xs text-zinc-500">{t('alertLevelsHint')}</p>
      </div>
      <Button type="submit" size="sm" disabled={busy}>
        {t('save')}
      </Button>
      {saved && (
        <p role="status" className="text-sm text-green-900">
          {t('saved')}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </form>
  );
}

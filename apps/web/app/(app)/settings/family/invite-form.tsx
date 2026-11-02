'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/client/api-client';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { useErrorText } from '@/components/use-error-text';

/** Makes a one-time invite link (7 days) to send to the spouse. The link is shown once. */
export function InviteForm() {
  const t = useTranslations('settings');
  const errorText = useErrorText();
  const [role, setRole] = useState('admin');
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    try {
      const invite = await api<{ joinPath: string }>('POST', '/api/v1/invites', { role });
      setLink(`${window.location.origin}${invite.joinPath}`);
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label={t('inviteRole')} className="w-40">
          {(['admin', 'member', 'viewer'] as const).map((r) => (
            <option key={r} value={r}>
              {t(`roles.${r}`)}
            </option>
          ))}
        </Select>
        <Button onClick={create}>{t('createInvite')}</Button>
      </div>
      {link && (
        <div>
          <Input readOnly value={link} aria-label={t('inviteLink')} onFocus={(e) => e.currentTarget.select()} />
          <p className="mt-1 text-sm text-zinc-500">{t('inviteOnce')}</p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

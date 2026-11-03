'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/client/api-client';
import { Button } from '@/components/ui/button';
import { useErrorText } from '@/components/use-error-text';

export type DuplicateQuestionProps = {
  matchId: string;
  /** The other expense, already formatted for the family. */
  amount: string;
  shop: string | null;
  day: string;
  /** True when the other expense was entered by the person looking. */
  mine: boolean;
  /** Shows "Decide later" (the Add screen); the Inbox has no need for it. */
  canPostpone?: boolean;
  onDone?: () => void;
};

/** "Your family logged ₹945 at the grocery shop on 7 Oct. Same purchase?" with Same / Different (PRD §6.7). */
export function DuplicateQuestion({ matchId, amount, shop, day, mine, canPostpone = false, onDone }: DuplicateQuestionProps) {
  const t = useTranslations('duplicates');
  const errorText = useErrorText();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function answer(value: 'same' | 'different') {
    setBusy(true);
    setError(null);
    try {
      await api('POST', `/api/v1/duplicates/${matchId}/resolve`, { answer: value });
      onDone?.();
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2" data-testid="duplicate-question">
      <p className="text-sm">{t('question', { who: mine ? 'me' : 'family', amount, shop: shop || '__none__', day })}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={busy} onClick={() => answer('same')}>
          {t('same')}
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => answer('different')}>
          {t('different')}
        </Button>
        {canPostpone && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={onDone}>
            {t('later')}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

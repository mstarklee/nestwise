'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { api } from '@/client/api-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useErrorText } from '@/components/use-error-text';

/** Step 2: start from the family's own plan (listed emails only), or from an empty plan. */
export function PlanStep({ canImport }: { canImport: boolean }) {
  const t = useTranslations('setup');
  const errorText = useErrorText();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function importPlan() {
    setBusy(true);
    setError(null);
    try {
      await api('POST', '/api/v1/plan/import');
      router.refresh();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-[24px] font-bold">{t('planTitle')}</h1>
      <Card className="space-y-3">
        {canImport && (
          <>
            <p>{t('importIntro')}</p>
            <Button onClick={importPlan} disabled={busy} className="w-full">
              {t('importPlan')}
            </Button>
          </>
        )}
        <p className="text-muted">{t('emptyIntro')}</p>
        {/* A button, not a link: a link would be loaded ahead of time. */}
        <Button variant="outline" className="w-full" disabled={busy} onClick={() => router.push('/setup?plan=empty')}>
          {t('emptyPlan')}
        </Button>
      </Card>
      {error && (
        <p role="alert" className="text-[13.5px] font-semibold text-rani">
          {error}
        </p>
      )}
    </div>
  );
}

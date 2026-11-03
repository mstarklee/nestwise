'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/client/api-client';
import { Button } from '@/components/ui/button';
import { useErrorText } from '@/components/use-error-text';

function useAction() {
  const router = useRouter();
  const errorText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      router.refresh();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const alert = error && (
    <p role="alert" className="text-sm text-red-700">
      {error}
    </p>
  );
  return { busy, run, alert };
}

/** "Close October": marks the month reviewed (late changes are still accepted). */
export function CloseMonthButton({ ym, label }: { ym: string; label: string }) {
  const { busy, run, alert } = useAction();
  return (
    <div className="space-y-2">
      <Button className="w-full" disabled={busy} onClick={() => run(() => api('POST', `/api/v1/months/${ym}/close`))}>
        {label}
      </Button>
      {alert}
    </div>
  );
}

/** "Raise November to ₹X": changes only that month's line, never the template. */
export function RaiseButton({ ym, itemId, plannedMinor, label }: { ym: string; itemId: string; plannedMinor: number; label: string }) {
  const { busy, run, alert } = useAction();
  const [done, setDone] = useState(false);
  if (done) return null;
  return (
    <div className="space-y-1">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => {
        await api('PUT', `/api/v1/months/${ym}/lines/${itemId}`, { plannedMinor });
        setDone(true);
      })}>
        {label}
      </Button>
      {alert}
    </div>
  );
}

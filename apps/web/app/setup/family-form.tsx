'use client';

import { minorUnitOf, parseMinor } from '@nestwise/domain/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useMemo, useState } from 'react';
import { api } from '@/client/api-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { useErrorText } from '@/components/use-error-text';

/** Step 1: the family. The currency is locked once the family exists. */
export function FamilyForm({ currencies }: { currencies: readonly string[] }) {
  const t = useTranslations('setup');
  const errorText = useErrorText();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const names = useMemo(() => new Intl.DisplayNames(['en'], { type: 'currency' }), []);
  const zones = useMemo(() => (typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []), []);
  const suggestedZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currencyCode = String(form.get('currency')).trim().toUpperCase();
    const opening = String(form.get('opening')).trim();
    const unit = minorUnitOf(currencyCode);
    setError(null);
    if (unit === undefined) {
      setError(t('badCurrency'));
      return;
    }
    let openingPotMinor = 0;
    try {
      if (opening !== '' && opening !== '0') openingPotMinor = parseMinor(opening, unit);
    } catch {
      setError(t('badAmount'));
      return;
    }
    setBusy(true);
    try {
      await api('POST', '/api/v1/families', {
        name: String(form.get('name')),
        currencyCode,
        timeZone: String(form.get('timeZone')).trim(),
        countryCode: String(form.get('country')).trim().toUpperCase() || null,
        openingPotMinor,
      });
      router.refresh();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 py-6">
      <h1 className="text-2xl font-semibold">{t('familyTitle')}</h1>
      <p className="text-zinc-600">{t('familyIntro')}</p>
      <Card className="space-y-4">
        <div>
          <Label htmlFor="name">{t('name')}</Label>
          <Input id="name" name="name" required maxLength={80} />
        </div>
        <div>
          <Label htmlFor="currency">{t('currency')}</Label>
          <Input id="currency" name="currency" list="currencies" defaultValue="INR" required autoCapitalize="characters" />
          <datalist id="currencies">
            {currencies.map((code) => (
              <option key={code} value={code}>
                {names.of(code)}
              </option>
            ))}
          </datalist>
          <p className="mt-1 text-sm text-zinc-500">{t('currencyLocked')}</p>
        </div>
        <div>
          <Label htmlFor="timeZone">{t('timeZone')}</Label>
          <Input id="timeZone" name="timeZone" list="zones" defaultValue={suggestedZone} required />
          <datalist id="zones">
            {zones.map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
        </div>
        <div>
          <Label htmlFor="country">{t('country')}</Label>
          <Input id="country" name="country" maxLength={2} placeholder="IN" autoCapitalize="characters" />
        </div>
        <div>
          <Label htmlFor="opening">{t('opening')}</Label>
          <Input id="opening" name="opening" inputMode="decimal" defaultValue="0" />
          <p className="mt-1 text-sm text-zinc-500">{t('openingHint')}</p>
        </div>
      </Card>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {t('createFamily')}
      </Button>
    </form>
  );
}

import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import messages from '../../messages/en.json';
import { SpendingRings } from '@/components/spending-rings';

const money = { currency: 'INR', minorUnit: 2, locale: 'en-IN' };
const render = (groups: { groupName: string; plannedMinor: number; actualMinor: number }[]) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="Asia/Kolkata">
      <SpendingRings groups={groups} alertThresholds={[80, 100]} money={money} />
    </NextIntlClientProvider>,
  );

test('an over-plan group says how much it is over, in words', () => {
  const html = render([{ groupName: 'Food & Dining', plannedMinor: 2_400_000, actualMinor: 2_630_000 }]);
  expect(html).toContain('data-tone="over"');
  expect(html).toContain('over');
  expect(html).toContain('110%');
});

test('a group with a plan of zero and some spending never shows NaN or Infinity', () => {
  const html = render([{ groupName: 'Odd', plannedMinor: 0, actualMinor: 500_000 }]);
  expect(html).not.toMatch(/NaN|Infinity/);
  expect(html).toContain('data-tone="over"');
});

test('the most used group comes first', () => {
  const html = render([
    { groupName: 'Quiet', plannedMinor: 1_000_000, actualMinor: 100_000 },
    { groupName: 'Busy', plannedMinor: 1_000_000, actualMinor: 900_000 },
  ]);
  expect(html.indexOf('Busy')).toBeLessThan(html.indexOf('Quiet'));
});

import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { toYm } from '@/client/format';
import { PageLoading } from '@/components/page-loading';
import { Card } from '@/components/ui/card';
import { pageContext } from '@/http/page-session';

export default function BudgetsPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Budgets />
    </Suspense>
  );
}

/** The Budgets tab: this month, this year's yearly bills, the forecast and the templates. */
async function Budgets() {
  const { current } = await pageContext();
  const t = await getTranslations('budgets');
  const links = [
    { href: `/month/${toYm(current)}`, label: t('thisMonth') },
    { href: `/year/${current.year}`, label: t('thisYear', { year: current.year }) },
    { href: '/forecast', label: t('forecast') },
    { href: '/templates', label: t('templates') },
  ];
  return (
    <div className="space-y-3 py-4">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      {links.map((link) => (
        <Link key={link.href} href={link.href} className="block">
          <Card className="hover:bg-zinc-50">{link.label}</Card>
        </Link>
      ))}
    </div>
  );
}

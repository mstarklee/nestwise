import { useTranslations } from 'next-intl';

/** A skeleton shaped like a header and three cards: plain Line-coloured blocks, no shimmer (nothing moves). */
export function PageLoading() {
  const t = useTranslations('common');
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">
        {t('loading')}
      </span>
      <div aria-hidden="true" className="-mx-4 mb-4 h-20 bg-peacock" />
      <div aria-hidden="true" className="space-y-3">
        <div className="h-32 rounded-card bg-line" />
        <div className="h-24 rounded-card bg-line" />
        <div className="h-24 rounded-card bg-line" />
      </div>
    </div>
  );
}

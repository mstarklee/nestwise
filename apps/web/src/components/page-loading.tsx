import { useTranslations } from 'next-intl';

export function PageLoading() {
  const t = useTranslations('common');
  return <p className="p-4 text-zinc-500">{t('loading')}</p>;
}

'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { backTarget } from '@/client/nav';
import { Icon } from './icon';
import { readDepth } from './nav-link';

/**
 * Round Back button. When the app's own history has an earlier screen it goes back there; otherwise (a reminder opened
 * this screen directly) it goes to the screen's tab root, never out of the app. It is always a link named "Back".
 */
export function BackButton() {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const router = useRouter();
  const target = backTarget(pathname);
  return (
    <Link
      href={target}
      transitionTypes={['back']}
      aria-label={t('back')}
      className="on-peacock flex size-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-transform active:scale-[.97] motion-reduce:transform-none"
      onClick={(e) => {
        if (readDepth() > 0) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      <Icon name="back" className="size-6" />
    </Link>
  );
}

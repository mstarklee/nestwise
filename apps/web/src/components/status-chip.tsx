import type { YearLineStatus } from '@nestwise/domain/year-plan';
import { useTranslations } from 'next-intl';
import { Icon, type FrameIcon } from './icon';

const STYLE: Record<YearLineStatus, { className: string; icon: FrameIcon | null }> = {
  planned: { className: 'bg-mist text-muted', icon: null },
  due_soon: { className: 'bg-gold text-ink', icon: null },
  part_paid: { className: 'bg-gold text-ink', icon: null },
  paid: { className: 'bg-leaf/10 text-leaf', icon: 'check' },
  overdue: { className: 'bg-rani/10 text-rani', icon: 'alert' },
  cancelled: { className: 'bg-mist text-muted', icon: null },
  before_nestwise: { className: 'bg-mist text-muted', icon: null },
};

/** A bill's status as a word (never colour alone), with a tick or warning icon where it helps. */
export function StatusChip({ status }: { status: YearLineStatus }) {
  const t = useTranslations('status');
  const style = STYLE[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${style.className}`}>
      {style.icon ? <Icon name={style.icon} className="size-3.5" /> : null}
      {t(status)}
    </span>
  );
}

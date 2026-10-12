import { Check, Circle, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
export function StatusIcon({
  status,
  className,
}: {
  status: 'pending' | 'done' | 'flag';
  className?: string;
}) {
  return status === 'done' ? (
    <Check className={cn('status-icon status-done', className)} aria-label="Reviewed" />
  ) : status === 'flag' ? (
    <Flag className={cn('status-icon status-flag', className)} aria-label="Flagged" />
  ) : (
    <Circle className={cn('status-icon status-pending', className)} aria-label="Not reviewed" />
  );
}

/**
 * Status and Confidence Badges for Explorer Agent
 */

import { Badge } from '@/components/ui/badge';
import type { TaskStatus } from '@/schemas/explorer';

interface ExplorationStatusBadgeProps {
  status: TaskStatus | string;
  className?: string;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' | null; className?: string }> = {
  pending: { label: 'Waiting', variant: 'secondary' },
  exploring: { label: 'Exploring', variant: 'default', className: 'animate-pulse' },
  complete: { label: 'Complete', variant: 'default' },
  failed: { label: 'Failed', variant: 'destructive' },
};

export function ExplorationStatusBadge({ status, className }: ExplorationStatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, variant: 'secondary' as const };
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}

interface ConfidenceBadgeProps {
  confidence: number | null | undefined; // 0-1 range
  className?: string;
}

export function ConfidenceBadge({ confidence, className }: ConfidenceBadgeProps) {
  if (confidence === null || confidence === undefined) {
    return <span className={className}>—</span>;
  }

  const percentage = Math.round(confidence * 100);
  let variant: 'default' | 'secondary' | 'outline' | 'destructive' | null = 'secondary';

  if (percentage >= 80) {
    variant = 'default'; // green
  } else if (percentage >= 60) {
    variant = 'secondary'; // yellow/orange-ish
  } else {
    variant = 'destructive'; // red
  }

  return (
    <Badge variant={variant} className={className}>
      {percentage}%
    </Badge>
  );
}
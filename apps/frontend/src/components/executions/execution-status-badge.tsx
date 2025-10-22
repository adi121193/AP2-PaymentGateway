/**
 * Execution Status Badge Component
 *
 * Displays execution status with appropriate color coding
 */

import { Badge } from '@/components/ui/badge';
import { Clock, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { STATUS_LABELS } from '@/lib/constants';
import type { ExecutionStatus } from '@/lib/types';

interface ExecutionStatusBadgeProps {
  status: ExecutionStatus;
  className?: string;
}

const STATUS_ICONS = {
  pending: Clock,
  running: Loader2,
  succeeded: CheckCircle2,
  failed: XCircle,
};

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  running: 'bg-blue-100 text-blue-800 border-blue-300',
  succeeded: 'bg-green-100 text-green-800 border-green-300',
  failed: 'bg-red-100 text-red-800 border-red-300',
};

export function ExecutionStatusBadge({ status, className }: ExecutionStatusBadgeProps) {
  const Icon = STATUS_ICONS[status];

  return (
    <Badge
      variant="outline"
      className={`${STATUS_COLORS[status]} ${className}`}
    >
      <Icon
        className={`h-3 w-3 mr-1 ${status === 'running' ? 'animate-spin' : ''}`}
      />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

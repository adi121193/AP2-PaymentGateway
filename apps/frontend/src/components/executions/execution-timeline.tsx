/**
 * Execution Timeline Component
 *
 * Displays execution timeline with created, started, and completed timestamps
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import type { AgentExecution } from '@/lib/types';

interface ExecutionTimelineProps {
  execution: AgentExecution;
}

export function ExecutionTimeline({ execution }: ExecutionTimelineProps) {
  // Calculate duration if both started_at and completed_at exist
  const calculateDuration = () => {
    if (!execution.started_at || !execution.completed_at) return null;

    const start = new Date(execution.started_at);
    const end = new Date(execution.completed_at);
    const durationMs = end.getTime() - start.getTime();

    if (durationMs < 1000) {
      return `${durationMs}ms`;
    } else if (durationMs < 60000) {
      return `${(durationMs / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(durationMs / 60000);
      const seconds = ((durationMs % 60000) / 1000).toFixed(0);
      return `${minutes}m ${seconds}s`;
    }
  };

  const duration = calculateDuration();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          {/* Created At */}
          <div className="flex justify-between items-start">
            <dt className="text-sm font-medium text-gray-500">Created</dt>
            <dd className="text-sm text-gray-900">
              {new Date(execution.created_at).toLocaleString()}
            </dd>
          </div>

          {/* Started At */}
          {execution.started_at && (
            <div className="flex justify-between items-start">
              <dt className="text-sm font-medium text-gray-500">Started</dt>
              <dd className="text-sm text-gray-900">
                {new Date(execution.started_at).toLocaleString()}
              </dd>
            </div>
          )}

          {/* Completed At */}
          {execution.completed_at && (
            <div className="flex justify-between items-start">
              <dt className="text-sm font-medium text-gray-500">Completed</dt>
              <dd className="text-sm text-gray-900">
                {new Date(execution.completed_at).toLocaleString()}
              </dd>
            </div>
          )}

          {/* Duration */}
          {duration && (
            <div className="flex justify-between items-start pt-2 border-t">
              <dt className="text-sm font-medium text-gray-900">Duration</dt>
              <dd className="text-sm font-semibold text-gray-900">{duration}</dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

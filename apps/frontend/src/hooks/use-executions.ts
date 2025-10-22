/**
 * React Query hooks for Execution-related API calls
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// Query Keys
// ============================================================================

export const executionKeys = {
  all: ['executions'] as const,
  details: () => [...executionKeys.all, 'detail'] as const,
  detail: (id: string) => [...executionKeys.details(), id] as const,
};

// ============================================================================
// Queries
// ============================================================================

/**
 * Hook to fetch execution status and result
 * Polls every 2 seconds if status is pending or running
 */
export function useExecution(executionId: string) {
  return useQuery({
    queryKey: executionKeys.detail(executionId),
    queryFn: () => apiClient.getExecution(executionId),
    enabled: !!executionId,
    refetchInterval: (query) => {
      // Poll every 2 seconds if execution is in progress
      const data = query.state.data;
      if (data?.status === 'pending' || data?.status === 'running') {
        return 2000;
      }
      return false;
    },
  });
}

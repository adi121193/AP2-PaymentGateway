/**
 * React Query hooks for Agent-related API calls
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type {
  AgentDefinition,
  AgentManifest,
  ListAgentsParams,
  ExecuteAgentRequest,
} from '@/lib/types';
import { toast } from 'sonner';

// ============================================================================
// Query Keys
// ============================================================================

export const agentKeys = {
  all: ['agents'] as const,
  lists: () => [...agentKeys.all, 'list'] as const,
  list: (params: ListAgentsParams) => [...agentKeys.lists(), params] as const,
  details: () => [...agentKeys.all, 'detail'] as const,
  detail: (id: string) => [...agentKeys.details(), id] as const,
  myAgents: () => [...agentKeys.all, 'my-agents'] as const,
};

// ============================================================================
// Queries
// ============================================================================

/**
 * Hook to fetch a paginated list of agents
 */
export function useAgents(params?: ListAgentsParams) {
  return useQuery({
    queryKey: agentKeys.list(params || {}),
    queryFn: () => apiClient.listAgents(params),
    select: (data) => {
      const agents = data.data?.agents || [];
      return {
        items: agents.map((agent: any) => ({
          id: agent.id,
          manifest: {
            name: agent.name,
            version: agent.version,
            description: agent.description,
            category: agent.category,
            tags: agent.tags || [],
            pricing: {
              model: agent.pricing?.model || 'per_execution',
              amount: agent.pricing?.amount || agent.pricing?.price_per_execution || 0,
              currency: agent.pricing?.currency || 'USD',
            },
            runtime: agent.runtime || { language: 'nodejs' },
            icon_url: agent.icon_url,
          },
          author: agent.author,
          downloads: agent.downloads || 0,
          rating: agent.rating || 0,
          status: agent.status,
          created_at: agent.created_at,
          updated_at: agent.updated_at,
        })),
        total: data.data?.total || 0,
        limit: data.data?.limit || 20,
        offset: data.data?.offset || 0,
      };
    },
  });
}

/**
 * Hook to fetch a single agent by ID
 */
export function useAgent(agentId: string) {
  return useQuery({
    queryKey: agentKeys.detail(agentId),
    queryFn: () => apiClient.getAgent(agentId),
    enabled: !!agentId,
  });
}

/**
 * Hook to fetch agents owned by current developer
 */
export function useMyAgents() {
  return useQuery({
    queryKey: agentKeys.myAgents(),
    queryFn: () => apiClient.getMyAgents(),
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Hook to register a new agent
 */
export function useRegisterAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ manifest, code }: { manifest: AgentManifest; code: File }) =>
      apiClient.registerAgent(manifest, code),
    onSuccess: () => {
      // Invalidate and refetch agents list
      queryClient.invalidateQueries({ queryKey: agentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: agentKeys.myAgents() });
      toast.success('Agent registered successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to register agent');
    },
  });
}

/**
 * Hook to execute an agent
 */
export function useExecuteAgent(agentId: string) {
  return useMutation({
    mutationFn: (request: ExecuteAgentRequest) => apiClient.executeAgent(agentId, request),
    onSuccess: () => {
      toast.success('Agent execution started!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to execute agent');
    },
  });
}

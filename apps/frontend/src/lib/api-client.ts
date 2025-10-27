/**
 * API Client for FrameOS Backend
 *
 * Provides typed methods for all backend endpoints:
 * - POST /agents/register
 * - GET /agents
 * - GET /agents/:id
 * - POST /agents/:id/execute
 * - GET /executions/:id
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  AgentDefinition,
  AgentExecution,
  ApiResponse,
  PaginatedResponse,
  ListAgentsParams,
  ExecuteAgentRequest,
  AgentManifest,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ============================================================================
// Axios Instance
// ============================================================================

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - add auth token if available
    this.client.interceptors.request.use(
      (config) => {
        if (typeof window !== 'undefined') {
          const apiKey = localStorage.getItem('apiKey');
          if (apiKey && config.headers) {
            config.headers['X-API-Key'] = apiKey;
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - standardize error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // Handle network errors
        if (!error.response) {
          throw new Error('Network error - please check your connection');
        }

        // Handle API errors
        const apiError = error.response.data as ApiResponse<never>;
        throw new Error(apiError.error?.message || 'An unexpected error occurred');
      }
    );
  }

  // ==========================================================================
  // Generic HTTP Methods
  // ==========================================================================

  async get<T = any>(url: string, config?: any) {
    return this.client.get<T>(url, config);
  }

  async post<T = any>(url: string, data?: any, config?: any) {
    return this.client.post<T>(url, data, config);
  }

  async patch<T = any>(url: string, data?: any, config?: any) {
    return this.client.patch<T>(url, data, config);
  }

  async delete<T = any>(url: string, config?: any) {
    return this.client.delete<T>(url, config);
  }

  async put<T = any>(url: string, data?: any, config?: any) {
    return this.client.put<T>(url, data, config);
  }

  // ==========================================================================
  // Agent Endpoints
  // ==========================================================================

  /**
   * Register a new agent (multipart/form-data)
   * POST /agents/register
   */
  async registerAgent(manifest: AgentManifest, codeFile: File): Promise<AgentDefinition> {
    const formData = new FormData();
    formData.append('manifest', JSON.stringify(manifest));
    formData.append('code', codeFile);

    const response = await this.client.post<ApiResponse<AgentDefinition>>(
      '/agents/register',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to register agent');
    }

    return response.data.data;
  }

  /**
   * List agents with optional filters
   * GET /agents
   */
  async listAgents(params?: ListAgentsParams): Promise<PaginatedResponse<AgentDefinition>> {
    const response = await this.client.get<PaginatedResponse<AgentDefinition>>('/agents', {
      params: {
        category: params?.category,
        search: params?.search,
        sort: params?.sort,
        limit: params?.limit || 20,
        offset: params?.offset || 0,
        status: params?.status || 'approved',
      },
    });

    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to fetch agents');
    }

    return response.data;
  }

  /**
   * Get agent details by ID
   * GET /agents/:id
   */
  async getAgent(agentId: string): Promise<AgentDefinition> {
    const response = await this.client.get<ApiResponse<AgentDefinition>>(`/agents/${agentId}`);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to fetch agent');
    }

    return response.data.data;
  }

  /**
   * Execute an agent with inputs
   * POST /agents/:id/execute
   */
  async executeAgent(agentId: string, request: ExecuteAgentRequest): Promise<AgentExecution> {
    const response = await this.client.post<ApiResponse<AgentExecution>>(
      `/agents/${agentId}/execute`,
      request
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to execute agent');
    }

    return response.data.data;
  }

  /**
   * Get execution status and result
   * GET /executions/:id
   */
  async getExecution(executionId: string): Promise<AgentExecution> {
    const response = await this.client.get<ApiResponse<AgentExecution>>(
      `/executions/${executionId}`
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error?.message || 'Failed to fetch execution');
    }

    return response.data.data;
  }

  // ==========================================================================
  // Developer Endpoints (for future implementation)
  // ==========================================================================

  /**
   * Get agents owned by current developer
   * Note: Backend endpoint doesn't exist yet, returns filtered list
   */
  async getMyAgents(): Promise<AgentDefinition[]> {
    if (typeof window === 'undefined') return [];

    const developer = localStorage.getItem('developer');
    if (!developer) return [];

    const { id: developerId } = JSON.parse(developer);

    // Use existing list endpoint with client-side filtering
    const response = await this.listAgents({ limit: 100, status: undefined });
    return response.data.items.filter((agent) => agent.developer_id === developerId);
  }

  /**
   * Get executions for a specific agent
   * Note: Backend endpoint doesn't exist yet, mock implementation
   */
  async getAgentExecutions(agentId: string): Promise<AgentExecution[]> {
    // TODO: Replace with real endpoint when backend supports it
    // For now, return empty array
    return [];
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const apiClient = new ApiClient();

// ============================================================================
// Export class for testing
// ============================================================================

export default ApiClient;

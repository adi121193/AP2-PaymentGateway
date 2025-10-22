/**
 * TypeScript type definitions for FrameOS API
 * These types match the backend Prisma schema and API contracts
 */

// ============================================================================
// Agent Manifest Types
// ============================================================================

export type AgentCategory =
  | 'automation'
  | 'data_enrichment'
  | 'outreach'
  | 'analytics'
  | 'content_generation'
  | 'research'
  | 'monitoring'
  | 'integration'
  | 'other';

export type PricingModel = 'per_execution' | 'pay_per_use' | 'subscription' | 'free';

export type InputType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'url' | 'email';

export type RuntimeLanguage = 'nodejs' | 'python' | 'go' | 'rust';

export type AgentCapability =
  | 'http_request'
  | 'browser_automation'
  | 'file_read'
  | 'file_write'
  | 'database_access';

export type AgentStatus = 'pending_review' | 'active' | 'inactive';

export type ExecutionStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface InputValidation {
  min?: number;
  max?: number;
  pattern?: string;
  enum?: string[];
}

export interface AgentInput {
  name: string;
  type: InputType;
  required: boolean;
  description: string;
  default?: unknown;
  validation?: InputValidation;
}

export interface AgentOutput {
  name: string;
  type: string;
  description: string;
}

export interface AgentPricing {
  model: PricingModel;
  amount: number;
  currency: string;
}

export interface AgentRuntime {
  language: RuntimeLanguage;
  version: string;
  entrypoint: string;
  timeout_ms: number;
  memory_mb: number;
  cpu_cores: number;
}

export interface AgentAuthor {
  developer_id: string;
  name: string;
  email: string;
}

export interface AgentManifest {
  id?: string;
  name: string;
  slug: string;
  version: string;
  description: string;
  long_description?: string;
  category: AgentCategory;
  tags: string[];
  pricing: AgentPricing;
  inputs: AgentInput[];
  outputs: AgentOutput[];
  runtime: AgentRuntime;
  capabilities: AgentCapability[];
  icon_url?: string;
  screenshots?: string[];
  author?: AgentAuthor;
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// Agent Definition
// ============================================================================

export interface AgentDefinition {
  id: string;
  developer_id: string;
  manifest: AgentManifest;
  code_url: string;
  status: AgentStatus;
  downloads: number;
  rating?: number;
  created_at: string;
  updated_at: string;
  developer?: Developer;
}

// ============================================================================
// Agent Execution
// ============================================================================

export interface AgentExecution {
  id: string;
  agent_id: string;
  deployment_id: string;
  inputs: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  status: ExecutionStatus;
  error?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

// ============================================================================
// Developer
// ============================================================================

export interface Developer {
  id: string;
  email: string;
  name: string;
  verified: boolean;
  api_key_hash?: string;
  created_at: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: PaginatedData<T>;
  error?: ApiError;
}

// ============================================================================
// API Request Types
// ============================================================================

export interface RegisterAgentRequest {
  manifest: AgentManifest;
  code: File;
}

export interface ExecuteAgentRequest {
  inputs: Record<string, unknown>;
}

export interface ListAgentsParams {
  category?: AgentCategory;
  search?: string;
  sort?: 'popular' | 'recent' | 'rating';
  limit?: number;
  offset?: number;
  status?: AgentStatus;
}

// ============================================================================
// Client-Side State Types
// ============================================================================

export interface AuthState {
  isAuthenticated: boolean;
  developer: Developer | null;
  apiKey: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  initialize: () => void;
}

export interface ExecutionFormData {
  inputs: Record<string, unknown>;
}

export interface AgentFormData {
  name: string;
  slug: string;
  version: string;
  description: string;
  long_description: string;
  category: AgentCategory;
  tags: string[];
  pricing_model: PricingModel;
  pricing_amount: number;
  pricing_currency: string;
  runtime_language: RuntimeLanguage;
  runtime_version: string;
  runtime_entrypoint: string;
  runtime_timeout_ms: number;
  runtime_memory_mb: number;
  runtime_cpu_cores: number;
  capabilities: AgentCapability[];
  inputs: AgentInput[];
  outputs: AgentOutput[];
  code_file: File | null;
}

// ============================================================================
// UI Types
// ============================================================================

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface FilterOption {
  label: string;
  value: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type SortOption = 'popular' | 'recent' | 'rating';

export interface CategoryInfo {
  value: AgentCategory;
  label: string;
  description: string;
  icon: string;
}

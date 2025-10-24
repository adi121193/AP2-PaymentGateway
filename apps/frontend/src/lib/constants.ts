/**
 * Application-wide constants and configuration
 */

import type { AgentCategory, CategoryInfo } from './types';

// ============================================================================
// Category Information
// ============================================================================

export const CATEGORY_INFO: Record<AgentCategory, CategoryInfo> = {
  automation: {
    value: 'automation',
    label: 'Automation',
    description: 'Automate repetitive tasks and workflows',
    icon: '⚙️',
  },
  data_enrichment: {
    value: 'data_enrichment',
    label: 'Data Enrichment',
    description: 'Enhance and enrich your data',
    icon: '📊',
  },
  outreach: {
    value: 'outreach',
    label: 'Outreach',
    description: 'Connect and engage with your audience',
    icon: '📧',
  },
  analytics: {
    value: 'analytics',
    label: 'Analytics',
    description: 'Analyze and visualize data insights',
    icon: '📈',
  },
  content_generation: {
    value: 'content_generation',
    label: 'Content Generation',
    description: 'Generate high-quality content',
    icon: '✍️',
  },
  research: {
    value: 'research',
    label: 'Research',
    description: 'Research and gather information',
    icon: '🔍',
  },
  monitoring: {
    value: 'monitoring',
    label: 'Monitoring',
    description: 'Monitor systems and processes',
    icon: '👁️',
  },
  integration: {
    value: 'integration',
    label: 'Integration',
    description: 'Connect different services and tools',
    icon: '🔗',
  },
  other: {
    value: 'other',
    label: 'Other',
    description: 'Miscellaneous agents',
    icon: '📦',
  },
};

// Export as array for forms/dropdowns
export const CATEGORIES = Object.values(CATEGORY_INFO);

// ============================================================================
// Sort Options
// ============================================================================

export const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'recent', label: 'Recently Added' },
  { value: 'rating', label: 'Highest Rated' },
] as const;

// ============================================================================
// Pricing Models
// ============================================================================

export const PRICING_MODEL_LABELS = {
  per_execution: 'Per Execution',
  pay_per_use: 'Pay Per Use',
  subscription: 'Subscription',
  free: 'Free',
} as const;

// ============================================================================
// Runtime Languages
// ============================================================================

export const RUNTIME_LANGUAGE_INFO = {
  nodejs: { label: 'Node.js', icon: '🟢' },
  python: { label: 'Python', icon: '🐍' },
  go: { label: 'Go', icon: '🔵' },
  rust: { label: 'Rust', icon: '🦀' },
} as const;

// ============================================================================
// Status Labels
// ============================================================================

export const STATUS_LABELS = {
  pending_review: 'Pending Review',
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
  running: 'Running',
  succeeded: 'Succeeded',
  failed: 'Failed',
} as const;

// ============================================================================
// Capabilities
// ============================================================================

export const CAPABILITY_LABELS = {
  http_request: 'HTTP Requests',
  browser_automation: 'Browser Automation',
  file_read: 'File Read',
  file_write: 'File Write',
  database_access: 'Database Access',
} as const;

// ============================================================================
// Default Values
// ============================================================================

export const DEFAULTS = {
  AGENTS_PER_PAGE: 20,
  MAX_UPLOAD_SIZE_MB: 10,
  MAX_DESCRIPTION_LENGTH: 160,
  MAX_LONG_DESCRIPTION_LENGTH: 2000,
} as const;

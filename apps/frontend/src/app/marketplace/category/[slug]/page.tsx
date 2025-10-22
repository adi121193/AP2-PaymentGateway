/**
 * Category Browse Page
 *
 * Dynamic route for browsing agents by category
 * Displays filtered agent grid with category-specific hero section
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AgentCard } from '@/components/marketplace/agent-card';
import { apiClient } from '@/lib/api-client';
import { CATEGORY_INFO } from '@/lib/constants';
import { AlertCircle, Package } from 'lucide-react';
import type { AgentCategory } from '@/lib/types';

// Category icon mapping using lucide-react
import { Bot, Database, Mail, BarChart, FileText, Search, Activity, Plug } from 'lucide-react';

const CATEGORY_ICONS = {
  automation: Bot,
  data_enrichment: Database,
  outreach: Mail,
  analytics: BarChart,
  content_generation: FileText,
  research: Search,
  monitoring: Activity,
  integration: Plug,
  other: Package,
} as const;

export default function CategoryBrowsePage() {
  const params = useParams();
  const categorySlug = params.slug as AgentCategory;

  // Validate category exists
  const categoryInfo = CATEGORY_INFO[categorySlug];

  // Fetch agents for this category
  const {
    data: agentsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['agents', { category: categorySlug }],
    queryFn: () => apiClient.listAgents({ category: categorySlug, limit: 100 }),
    enabled: !!categoryInfo,
  });

  // Invalid category
  if (!categoryInfo) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Invalid Category</AlertTitle>
          <AlertDescription>
            The category "{categorySlug}" does not exist.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const CategoryIcon = CATEGORY_ICONS[categorySlug];
  const agents = agentsData?.data?.items || [];

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Marketplace', href: '/marketplace' },
    { label: categoryInfo.label },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Breadcrumbs */}
      <Breadcrumb items={breadcrumbItems} className="mb-6" />

      {/* Hero Section */}
      <div className="mb-12 text-center">
        <div className="flex justify-center mb-6">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <CategoryIcon className="h-10 w-10 text-white" />
          </div>
        </div>

        <h1 className="text-4xl font-bold mb-4">{categoryInfo.label}</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          {categoryInfo.description}
        </p>

        {!isLoading && (
          <p className="text-sm text-gray-500 mt-4">
            {agents.length} {agents.length === 1 ? 'agent' : 'agents'} available
          </p>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-80 w-full" />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Failed to load agents'}
          </AlertDescription>
        </Alert>
      )}

      {/* Agent Grid */}
      {!isLoading && !error && agents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && agents.length === 0 && (
        <div className="text-center py-16">
          <CategoryIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            No agents in this category yet
          </h3>
          <p className="text-gray-500">
            Check back later for new {categoryInfo.label.toLowerCase()} agents
          </p>
        </div>
      )}
    </div>
  );
}

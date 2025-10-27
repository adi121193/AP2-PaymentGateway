/**
 * Agent Detail Page
 *
 * Dynamic route for displaying individual agent details
 * Includes tabs for overview, pricing, versions, and reviews
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { AgentHeader } from '@/components/marketplace/agent-header';
import { AgentTabs } from '@/components/marketplace/agent-tabs';
import { AgentSidebar } from '@/components/marketplace/agent-sidebar';
import { apiClient } from '@/lib/api-client';
import { CATEGORY_INFO } from '@/lib/constants';
import { AlertCircle } from 'lucide-react';

export default function AgentDetailPage() {
  const params = useParams();
  const agentId = params.id as string;

  // Fetch agent data
  const {
    data: agent,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['agent', agentId],
    queryFn: () => apiClient.getAgent(agentId),
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Skeleton className="h-6 w-64 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !agent) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Agent not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Breadcrumb items
  const categoryInfo = agent.manifest?.category 
    ? CATEGORY_INFO[agent.manifest.category] || CATEGORY_INFO.other
    : CATEGORY_INFO.other;
  const breadcrumbItems = [
    { label: 'Marketplace', href: '/marketplace' },
    { label: categoryInfo.label, href: `/marketplace/category/${agent.manifest?.category || 'other'}` },
    { label: agent.manifest?.name || 'Unknown Agent' },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Breadcrumbs */}
      <Breadcrumb items={breadcrumbItems} className="mb-6" />

      {/* Agent Header */}
      <AgentHeader agent={agent} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Tabs */}
        <div className="lg:col-span-2">
          <AgentTabs agent={agent} />
        </div>

        {/* Right Column - Sidebar */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-8">
            <AgentSidebar agent={agent} />
          </div>
        </div>
      </div>
    </div>
  );
}

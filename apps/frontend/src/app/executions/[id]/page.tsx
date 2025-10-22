/**
 * Execution Status Page
 *
 * Dynamic route for tracking agent execution status
 * Auto-refreshes while execution is pending or running
 */

'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { ExecutionStatusBadge } from '@/components/executions/execution-status-badge';
import { ExecutionTimeline } from '@/components/executions/execution-timeline';
import { ExecutionOutput } from '@/components/executions/execution-output';
import { apiClient } from '@/lib/api-client';
import { AlertCircle, ArrowLeft, Loader2, CheckCircle2, XCircle } from 'lucide-react';

export default function ExecutionStatusPage() {
  const params = useParams();
  const router = useRouter();
  const executionId = params.id as string;

  // Fetch execution with conditional auto-refresh
  const {
    data: execution,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['execution', executionId],
    queryFn: () => apiClient.getExecution(executionId),
    refetchInterval: (query) => {
      const data = query.state.data;
      // Auto-refresh every 2 seconds if pending or running
      if (data && (data.status === 'pending' || data.status === 'running')) {
        return 2000;
      }
      return false;
    },
  });

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Skeleton className="h-6 w-64 mb-6" />
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !execution) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" onClick={() => router.back()} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Execution not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Marketplace', href: '/marketplace' },
    { label: 'Execution', href: '/executions' },
    { label: executionId },
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      {/* Breadcrumbs */}
      <Breadcrumb items={breadcrumbItems} className="mb-6" />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">Execution Status</h1>
            <p className="text-gray-600 font-mono text-sm">{executionId}</p>
          </div>
          <ExecutionStatusBadge status={execution.status} className="text-base px-4 py-2" />
        </div>

        {/* Agent Link */}
        <div className="text-sm text-gray-600">
          Agent:{' '}
          <Link
            href={`/marketplace/agents/${execution.agent_id}`}
            className="text-blue-600 hover:underline font-medium"
          >
            {execution.agent_id}
          </Link>
        </div>
      </div>

      {/* Progress Section */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            {execution.status === 'pending' && (
              <div className="text-center">
                <Loader2 className="h-12 w-12 text-yellow-500 animate-spin mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-700">Waiting in queue...</p>
                <p className="text-sm text-gray-500 mt-1">
                  Your execution will start shortly
                </p>
              </div>
            )}

            {execution.status === 'running' && (
              <div className="text-center">
                <Loader2 className="h-12 w-12 text-blue-500 animate-spin mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-700">Executing...</p>
                <p className="text-sm text-gray-500 mt-1">
                  Agent is processing your request
                </p>
              </div>
            )}

            {execution.status === 'succeeded' && (
              <div className="text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-700">
                  Execution completed successfully
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Results are available below
                </p>
              </div>
            )}

            {execution.status === 'failed' && (
              <div className="text-center">
                <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-gray-700">Execution failed</p>
                {execution.error && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 max-w-md">
                    <p className="text-sm text-red-800">{execution.error}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <div className="mb-6">
        <ExecutionTimeline execution={execution} />
      </div>

      {/* Input Parameters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Input Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 rounded-lg p-4 overflow-x-auto">
            <pre className="text-sm font-mono">
              {JSON.stringify(execution.inputs, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>

      {/* Output */}
      <ExecutionOutput execution={execution} />
    </div>
  );
}

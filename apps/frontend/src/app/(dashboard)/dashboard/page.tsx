'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Bot,
  TrendingUp,
  DollarSign,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { apiClient } from '@/lib/api-client';
import type { AgentDefinition, AgentExecution } from '@/lib/types';

interface DashboardStats {
  total_agents: number;
  total_executions: number;
  total_revenue: number;
  executions_change: number;
  revenue_change: number;
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await apiClient.get<DashboardStats>(
        '/developers/me/stats'
      );
      return response.data;
    },
  });

  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ['my-agents'],
    queryFn: async () => {
      const response = await apiClient.get<AgentDefinition[]>(
        '/developers/me/agents'
      );
      return response.data;
    },
  });

  const { data: executionsData, isLoading: executionsLoading } = useQuery({
    queryKey: ['recent-executions'],
    queryFn: async () => {
      const response = await apiClient.get<AgentExecution[]>(
        '/developers/me/executions?limit=5'
      );
      return response.data;
    },
  });

  const statCards = [
    {
      title: 'Total Agents',
      value: stats?.total_agents ?? 0,
      icon: Bot,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Total Executions',
      value: stats?.total_executions ?? 0,
      change: stats?.executions_change,
      icon: Activity,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Total Revenue',
      value: `$${((stats?.total_revenue ?? 0) / 100).toFixed(2)}`,
      change: stats?.revenue_change,
      icon: DollarSign,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      title: 'Avg. Rating',
      value: '4.8',
      icon: TrendingUp,
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your agents and performance
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const hasChange = stat.change !== undefined;
          const isPositive = (stat.change ?? 0) > 0;

          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                {hasChange && (
                  <div className="flex items-center text-xs text-muted-foreground">
                    {isPositive ? (
                      <ArrowUpRight className="mr-1 h-3 w-3 text-green-500" />
                    ) : (
                      <ArrowDownRight className="mr-1 h-3 w-3 text-red-500" />
                    )}
                    <span className={isPositive ? 'text-green-500' : 'text-red-500'}>
                      {Math.abs(stat.change!)}%
                    </span>
                    <span className="ml-1">from last month</span>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* My Agents */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>My Agents</CardTitle>
            <Button asChild size="sm">
              <Link href="/dashboard/agents">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {agentsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : agentsData && agentsData.length > 0 ? (
              <div className="space-y-3">
                {agentsData.slice(0, 3).map((agent) => (
                  <Link
                    key={agent.id}
                    href={`/dashboard/agents/${agent.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{agent.manifest.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {agent.downloads} downloads
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium capitalize">{agent.status}</p>
                      <p className="text-xs text-muted-foreground">
                        v{agent.manifest.version}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bot className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No agents yet
                </p>
                <Button asChild size="sm" className="mt-4">
                  <Link href="/dashboard/agents/register">Register Your First Agent</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Executions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Executions</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/revenue">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {executionsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : executionsData && executionsData.length > 0 ? (
              <div className="space-y-3">
                {executionsData.map((execution) => (
                  <Link
                    key={execution.id}
                    href={`/executions/${execution.id}`}
                    className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-accent"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        Execution #{execution.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(execution.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        execution.status === 'succeeded'
                          ? 'bg-green-500/10 text-green-500'
                          : execution.status === 'failed'
                          ? 'bg-red-500/10 text-red-500'
                          : execution.status === 'running'
                          ? 'bg-blue-500/10 text-blue-500'
                          : 'bg-gray-500/10 text-gray-500'
                      }`}
                    >
                      {execution.status}
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Activity className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No executions yet
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

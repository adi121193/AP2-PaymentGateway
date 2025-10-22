'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Download,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';

interface RevenueStats {
  total_revenue: number;
  this_month_revenue: number;
  last_month_revenue: number;
  total_executions: number;
  average_per_execution: number;
  change_percentage: number;
}

interface RevenueTransaction {
  id: string;
  agent_id: string;
  agent_name: string;
  execution_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

interface AgentRevenue {
  agent_id: string;
  agent_name: string;
  total_revenue: number;
  execution_count: number;
  average_per_execution: number;
}

export default function RevenuePage() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['revenue-stats', period],
    queryFn: async () => {
      const response = await apiClient.get<RevenueStats>(
        `/developers/me/revenue/stats?period=${period}`
      );
      return response.data;
    },
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['revenue-transactions', period],
    queryFn: async () => {
      const response = await apiClient.get<RevenueTransaction[]>(
        `/developers/me/revenue/transactions?period=${period}`
      );
      return response.data;
    },
  });

  const { data: agentRevenue, isLoading: agentRevenueLoading } = useQuery({
    queryKey: ['agent-revenue', period],
    queryFn: async () => {
      const response = await apiClient.get<AgentRevenue[]>(
        `/developers/me/revenue/by-agent?period=${period}`
      );
      return response.data;
    },
  });

  const handleExportCSV = () => {
    window.open(`/api/developers/me/revenue/export?period=${period}&format=csv`, '_blank');
  };

  const isPositiveChange = (stats?.change_percentage ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Revenue</h1>
          <p className="text-muted-foreground">
            Track your earnings and agent performance
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <SelectTrigger className="w-32">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${((stats?.total_revenue ?? 0) / 100).toFixed(2)}
            </div>
            <div className="flex items-center text-xs text-muted-foreground">
              {isPositiveChange ? (
                <ArrowUpRight className="mr-1 h-3 w-3 text-green-500" />
              ) : (
                <ArrowDownRight className="mr-1 h-3 w-3 text-red-500" />
              )}
              <span className={isPositiveChange ? 'text-green-500' : 'text-red-500'}>
                {Math.abs(stats?.change_percentage ?? 0)}%
              </span>
              <span className="ml-1">from last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${((stats?.this_month_revenue ?? 0) / 100).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Last month: ${((stats?.last_month_revenue ?? 0) / 100).toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Executions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_executions ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Total paid executions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Per Exec</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${((stats?.average_per_execution ?? 0) / 100).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Average revenue
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Revenue by Agent */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Agent</CardTitle>
            <CardDescription>Top performing agents in selected period</CardDescription>
          </CardHeader>
          <CardContent>
            {agentRevenueLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : agentRevenue && agentRevenue.length > 0 ? (
              <div className="space-y-3">
                {agentRevenue.map((agent) => (
                  <div
                    key={agent.agent_id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="font-medium">{agent.agent_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {agent.execution_count} executions • $
                        {(agent.average_per_execution / 100).toFixed(2)} avg
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">
                        ${(agent.total_revenue / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <DollarSign className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No revenue data for this period
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest revenue transactions</CardDescription>
          </CardHeader>
          <CardContent>
            {transactionsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : transactions && transactions.length > 0 ? (
              <div className="space-y-3">
                {transactions.slice(0, 10).map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{txn.agent_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(txn.created_at).toLocaleDateString()} •{' '}
                        {txn.execution_id.slice(0, 8)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          txn.status === 'completed'
                            ? 'default'
                            : txn.status === 'pending'
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {txn.status}
                      </Badge>
                      <p className="text-sm font-semibold">
                        ${(txn.amount / 100).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <TrendingUp className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No transactions for this period
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

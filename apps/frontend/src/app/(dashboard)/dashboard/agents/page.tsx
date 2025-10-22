'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Bot,
  Plus,
  Search,
  Filter,
  TrendingUp,
  Eye,
  Edit,
  Trash2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import type { AgentDefinition, AgentStatus } from '@/lib/types';

export default function MyAgentsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AgentStatus | 'all'>('all');

  const { data: agents, isLoading } = useQuery({
    queryKey: ['my-agents', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      const response = await apiClient.get<AgentDefinition[]>(
        `/developers/me/agents?${params}`
      );
      return response.data;
    },
  });

  const filteredAgents = agents?.filter((agent) =>
    agent.manifest.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Agents</h1>
          <p className="text-muted-foreground">
            Manage and monitor your published agents
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/agents/register">
            <Plus className="mr-2 h-4 w-4" />
            Register Agent
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search agents..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as AgentStatus | 'all')}
            >
              <SelectTrigger className="w-full md:w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending_review">Pending Review</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Agents Grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="h-64 animate-pulse bg-muted" />
          ))}
        </div>
      ) : filteredAgents && filteredAgents.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => (
            <Card key={agent.id} className="group overflow-hidden">
              <CardContent className="p-6">
                {/* Status Badge */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  <Badge
                    variant={
                      agent.status === 'active'
                        ? 'default'
                        : agent.status === 'pending_review'
                        ? 'secondary'
                        : 'outline'
                    }
                  >
                    {agent.status === 'pending_review'
                      ? 'Pending'
                      : agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                  </Badge>
                </div>

                {/* Agent Info */}
                <h3 className="mb-2 line-clamp-1 text-lg font-semibold">
                  {agent.manifest.name}
                </h3>
                <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                  {agent.manifest.description}
                </p>

                {/* Stats */}
                <div className="mb-4 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold">{agent.downloads}</p>
                    <p className="text-xs text-muted-foreground">Downloads</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">
                      {agent.rating?.toFixed(1) ?? 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">Rating</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">v{agent.manifest.version}</p>
                    <p className="text-xs text-muted-foreground">Version</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/marketplace/agents/${agent.id}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="flex-1">
                    <Link href={`/dashboard/agents/${agent.id}/edit`}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bot className="mb-4 h-16 w-16 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-semibold">No agents found</h3>
            <p className="mb-6 text-center text-sm text-muted-foreground">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Get started by registering your first agent'}
            </p>
            {!search && statusFilter === 'all' && (
              <Button asChild>
                <Link href="/dashboard/agents/register">
                  <Plus className="mr-2 h-4 w-4" />
                  Register Your First Agent
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Agent Sidebar Component
 *
 * Displays pricing card, execute button, stats, and developer info
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Download, Star, Play } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { ExecuteAgentDialog } from './execute-agent-dialog';
import type { AgentDefinition } from '@/lib/types';

interface AgentSidebarProps {
  agent: AgentDefinition;
}

export function AgentSidebar({ agent }: AgentSidebarProps) {
  const { manifest } = agent;
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Pricing Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {manifest.pricing.model === 'free' ? (
              <span className="text-green-600">FREE</span>
            ) : (
              formatCurrency(manifest.pricing.amount, manifest.pricing.currency)
            )}
          </CardTitle>
          <CardDescription>
            {manifest.pricing.model === 'free'
              ? 'No charges applied'
              : `per ${manifest.pricing.model === 'per_execution' ? 'execution' : 'use'}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            size="lg"
            className="w-full"
            onClick={() => setExecuteDialogOpen(true)}
          >
            <Play className="h-4 w-4 mr-2" />
            Execute Agent
          </Button>
        </CardContent>
      </Card>

      {/* Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Statistics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Download className="h-4 w-4" />
              <span>Executions</span>
            </div>
            <span className="font-semibold">{agent.downloads.toLocaleString()}</span>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Star className="h-4 w-4" />
              <span>Rating</span>
            </div>
            <span className="font-semibold">
              {agent.rating ? `${agent.rating.toFixed(1)} / 5.0` : 'No ratings yet'}
            </span>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Success Rate</span>
            <span className="font-semibold">N/A</span>
          </div>
        </CardContent>
      </Card>

      {/* Developer Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Developer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <p className="font-medium">{manifest.author?.name || 'Developer'}</p>
              {manifest.author?.email && (
                <p className="text-sm text-gray-500">{manifest.author.email}</p>
              )}
            </div>

            <Separator />

            <div className="text-sm text-gray-600">
              <p>Published {new Date(agent.created_at).toLocaleDateString()}</p>
              <p className="mt-1">
                Updated {new Date(agent.updated_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Execute Agent Dialog */}
      <ExecuteAgentDialog
        agent={agent}
        open={executeDialogOpen}
        onOpenChange={setExecuteDialogOpen}
      />
    </div>
  );
}

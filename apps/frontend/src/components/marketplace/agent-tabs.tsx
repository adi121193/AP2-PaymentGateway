/**
 * Agent Tabs Component
 *
 * Displays tabbed content for agent details:
 * - Overview: Description, screenshots, capabilities, runtime
 * - Pricing: Pricing model and details
 * - Versions: Version history (placeholder)
 * - Reviews: Reviews (placeholder)
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CAPABILITY_LABELS, PRICING_MODEL_LABELS, RUNTIME_LANGUAGE_INFO } from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';
import type { AgentDefinition } from '@/lib/types';

interface AgentTabsProps {
  agent: AgentDefinition;
}

export function AgentTabs({ agent }: AgentTabsProps) {
  const { manifest } = agent;
  const runtimeInfo = manifest.runtime?.language 
    ? RUNTIME_LANGUAGE_INFO[manifest.runtime.language] 
    : { label: 'Node.js', icon: '📦', value: 'nodejs' };
  const pricingLabel = PRICING_MODEL_LABELS[manifest.pricing?.model || 'per_execution'];

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="pricing">Pricing</TabsTrigger>
        <TabsTrigger value="versions">Versions</TabsTrigger>
        <TabsTrigger value="reviews">Reviews</TabsTrigger>
      </TabsList>

      {/* Overview Tab */}
      <TabsContent value="overview" className="space-y-6 mt-6">
        {/* Description */}
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700 mb-4">{manifest.description}</p>
            {manifest.long_description && (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {manifest.long_description}
                </ReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Screenshots */}
        {manifest.screenshots && manifest.screenshots.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Screenshots</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {manifest.screenshots.map((screenshot, index) => (
                  <img
                    key={index}
                    src={screenshot}
                    alt={`Screenshot ${index + 1}`}
                    className="rounded-lg border w-full"
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Required Capabilities */}
        <Card>
          <CardHeader>
            <CardTitle>Required Capabilities</CardTitle>
            <CardDescription>
              Permissions this agent requires to function
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {manifest.capabilities.map((capability) => (
                <Badge key={capability} variant="secondary">
                  {CAPABILITY_LABELS[capability]}
                </Badge>
              ))}
              {manifest.capabilities.length === 0 && (
                <p className="text-sm text-gray-500">No special capabilities required</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Runtime Information */}
        {manifest.runtime && (
          <Card>
            <CardHeader>
              <CardTitle>Runtime Information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Language</dt>
                  <dd className="text-base mt-1">
                    {runtimeInfo.icon} {runtimeInfo.label} {manifest.runtime.version || 'Latest'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Entrypoint</dt>
                  <dd className="text-base mt-1 font-mono text-sm">
                    {manifest.runtime.entrypoint || 'index.js'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Memory</dt>
                  <dd className="text-base mt-1">{manifest.runtime.memory_mb || 512} MB</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Timeout</dt>
                  <dd className="text-base mt-1">
                    {(manifest.runtime.timeout_ms || 30000) / 1000} seconds
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">CPU Cores</dt>
                  <dd className="text-base mt-1">{manifest.runtime.cpu_cores || 1}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Tags */}
        {manifest.tags && manifest.tags.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {manifest.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </TabsContent>

      {/* Pricing Tab */}
      <TabsContent value="pricing" className="space-y-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Pricing Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-gray-500 mb-1">Pricing Model</dt>
                <dd>
                  <Badge variant="secondary" className="text-base">
                    {pricingLabel}
                  </Badge>
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-gray-500 mb-1">Price</dt>
                <dd className="text-2xl font-bold">
                  {manifest.pricing.model === 'free' ? (
                    <span className="text-green-600">FREE</span>
                  ) : (
                    <>
                      {formatCurrency(manifest.pricing.amount, manifest.pricing.currency)}
                      <span className="text-base font-normal text-gray-500 ml-2">
                        per {manifest.pricing.model === 'per_execution' ? 'execution' : 'use'}
                      </span>
                    </>
                  )}
                </dd>
              </div>

              {manifest.pricing.model === 'free' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800">
                    This agent is completely free to use. No charges will be applied for executions.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Versions Tab */}
      <TabsContent value="versions" className="space-y-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Version History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4 pb-4 border-b last:border-b-0">
                <Badge variant="default">v{manifest.version}</Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">Current Version</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Released {new Date(agent.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-500 italic">
                Full version history coming soon
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Reviews Tab */}
      <TabsContent value="reviews" className="space-y-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Reviews & Ratings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <p className="text-gray-500 mb-2">Reviews coming soon</p>
              <p className="text-sm text-gray-400">
                We're working on adding a review system to help you make better decisions
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

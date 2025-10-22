/**
 * Agent Card Component
 *
 * Displays agent information in a card format for marketplace listings
 */

import Link from 'next/link';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Star } from 'lucide-react';
import { formatCurrency, truncate } from '@/lib/utils';
import { CATEGORY_INFO, PRICING_MODEL_LABELS, RUNTIME_LANGUAGE_INFO } from '@/lib/constants';
import type { AgentDefinition } from '@/lib/types';

interface AgentCardProps {
  agent: AgentDefinition;
}

export function AgentCard({ agent }: AgentCardProps) {
  const { manifest } = agent;
  const categoryInfo = CATEGORY_INFO[manifest.category];
  const runtimeInfo = RUNTIME_LANGUAGE_INFO[manifest.runtime.language];
  const pricingLabel = PRICING_MODEL_LABELS[manifest.pricing.model];

  return (
    <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {manifest.icon_url ? (
              <img
                src={manifest.icon_url}
                alt={manifest.name}
                className="h-10 w-10 rounded-lg object-cover"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                {manifest.name[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-lg truncate">{manifest.name}</h3>
              <p className="text-xs text-gray-500">v{manifest.version}</p>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-600 line-clamp-2 min-h-[2.5rem]">
          {manifest.description}
        </p>
      </CardHeader>

      <CardContent className="flex-1">
        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          <Badge variant="secondary" className="text-xs">
            <span className="mr-1">{categoryInfo.icon}</span>
            {categoryInfo.label}
          </Badge>
          <Badge variant="outline" className="text-xs">
            <span className="mr-1">{runtimeInfo.icon}</span>
            {runtimeInfo.label}
          </Badge>
        </div>

        {/* Pricing */}
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700">
            {manifest.pricing.model === 'free' ? (
              <span className="text-green-600">Free</span>
            ) : (
              <>
                {formatCurrency(manifest.pricing.amount, manifest.pricing.currency)}
                <span className="text-gray-500 font-normal ml-1">
                  / {pricingLabel.toLowerCase()}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            {agent.downloads.toLocaleString()}
          </div>
          {agent.rating && (
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {agent.rating.toFixed(1)}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-4 border-t">
        <Button asChild className="w-full">
          <Link href={`/marketplace/agents/${agent.id}`}>
            View Details
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

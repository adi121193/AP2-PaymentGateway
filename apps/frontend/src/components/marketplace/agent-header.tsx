/**
 * Agent Header Component
 *
 * Displays agent header with icon, name, developer, category, and status
 */

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { CATEGORY_INFO, STATUS_LABELS } from '@/lib/constants';
import type { AgentDefinition } from '@/lib/types';

interface AgentHeaderProps {
  agent: AgentDefinition;
}

export function AgentHeader({ agent }: AgentHeaderProps) {
  const { manifest, status } = agent;
  const categoryInfo = CATEGORY_INFO[manifest.category];

  return (
    <div className="border-b pb-6 mb-6">
      <div className="flex items-start gap-4">
        {/* Agent Icon */}
        {manifest.icon_url ? (
          <img
            src={manifest.icon_url}
            alt={manifest.name}
            className="h-20 w-20 rounded-xl object-cover flex-shrink-0"
          />
        ) : (
          <div className="h-20 w-20 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl flex-shrink-0">
            {manifest.name[0].toUpperCase()}
          </div>
        )}

        {/* Agent Info */}
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold mb-2">{manifest.name}</h1>

          {/* Developer Link - Placeholder for future implementation */}
          <p className="text-gray-600 mb-3">
            by{' '}
            <Link
              href={`/developers/${agent.developer_id}`}
              className="text-blue-600 hover:underline"
            >
              {manifest.author?.name || 'Developer'}
            </Link>
          </p>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="text-sm">
              <span className="mr-1">{categoryInfo.icon}</span>
              {categoryInfo.label}
            </Badge>

            <Badge
              variant={status === 'active' ? 'default' : 'outline'}
              className={status === 'active' ? 'bg-green-600' : ''}
            >
              {STATUS_LABELS[status]}
            </Badge>

            <Badge variant="outline" className="text-sm">
              v{manifest.version}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

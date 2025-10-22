/**
 * Marketplace Landing Page
 *
 * Browse and search agents with:
 * - Category filters
 * - Search functionality
 * - Sort options (popular, recent, rating)
 * - Pagination
 */

import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { MarketplaceContent } from '@/components/marketplace/marketplace-content';

function MarketplaceSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Skeleton className="h-12 w-64 mb-2" />
        <Skeleton className="h-6 w-96" />
      </div>
      <div className="mb-6">
        <Skeleton className="h-12 w-full max-w-2xl" />
      </div>
      <div className="flex flex-col lg:flex-row gap-8">
        <aside className="lg:w-64">
          <Skeleton className="h-96 w-full" />
        </aside>
        <main className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-80 rounded-lg" />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Agent Marketplace</h1>
        <p className="text-gray-600 text-lg">
          Discover and execute AI agents built by the community
        </p>
      </div>

      <Suspense fallback={<MarketplaceSkeleton />}>
        <MarketplaceContent />
      </Suspense>
    </div>
  );
}

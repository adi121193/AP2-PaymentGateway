/**
 * Marketplace Content Component
 *
 * Main marketplace content that uses useSearchParams
 * Extracted to be wrapped in Suspense boundary
 */

'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAgents } from '@/hooks/use-agents';
import { AgentCard } from './agent-card';
import { MarketplaceFilters } from './marketplace-filters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { DEFAULTS } from '@/lib/constants';
import type { AgentCategory, SortOption } from '@/lib/types';

export function MarketplaceContent() {
  const searchParams = useSearchParams();

  // Initialize state
  const [category, setCategory] = useState<AgentCategory | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<SortOption>('popular');
  const [page, setPage] = useState(0);

  // Update state from URL params after mount
  useEffect(() => {
    if (searchParams) {
      const urlCategory = searchParams.get('category') as AgentCategory;
      const urlSearch = searchParams.get('search');
      const urlSort = searchParams.get('sort') as SortOption;

      if (urlCategory) setCategory(urlCategory);
      if (urlSearch) setSearchQuery(urlSearch);
      if (urlSort) setSort(urlSort);
    }
  }, [searchParams]);

  // Fetch agents with filters
  const { data, isLoading, error } = useAgents({
    category,
    search: searchQuery || undefined,
    sort,
    limit: DEFAULTS.AGENTS_PER_PAGE,
    offset: page * DEFAULTS.AGENTS_PER_PAGE,
  });

  const agents = data?.items || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / DEFAULTS.AGENTS_PER_PAGE);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPage(0);
  };

  const handleCategoryChange = (newCategory: AgentCategory | undefined) => {
    setCategory(newCategory);
    setPage(0);
  };

  const handleSortChange = (newSort: SortOption) => {
    setSort(newSort);
    setPage(0);
  };

  return (
    <>
      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-2xl">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            type="text"
            placeholder="Search agents by name, description, or tags..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-10 h-12"
          />
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Filters Sidebar */}
        <aside className="lg:w-64 flex-shrink-0">
          <MarketplaceFilters
            selectedCategory={category}
            selectedSort={sort}
            onCategoryChange={handleCategoryChange}
            onSortChange={handleSortChange}
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          {/* Results Header */}
          <div className="mb-6 flex items-center justify-between">
            <p className="text-gray-600">
              {total} {total === 1 ? 'agent' : 'agents'} found
            </p>
          </div>

          {/* Error State */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                Failed to load agents. Please try again.
              </AlertDescription>
            </Alert>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-lg" />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && !error && agents.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">🔍</div>
              <h3 className="text-xl font-semibold mb-2">No agents found</h3>
              <p className="text-gray-600 mb-6">
                Try adjusting your filters or search query
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setCategory(undefined);
                  setSearchQuery('');
                  setPage(0);
                }}
              >
                Clear Filters
              </Button>
            </div>
          )}

          {/* Agents Grid */}
          {!isLoading && !error && agents.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
                {agents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages - 1}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </>
  );
}

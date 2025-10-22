/**
 * Marketplace Filters Component
 *
 * Sidebar with category and sort filters
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CATEGORY_INFO, SORT_OPTIONS } from '@/lib/constants';
import type { AgentCategory, SortOption } from '@/lib/types';

interface MarketplaceFiltersProps {
  selectedCategory?: AgentCategory;
  selectedSort: SortOption;
  onCategoryChange: (category: AgentCategory | undefined) => void;
  onSortChange: (sort: SortOption) => void;
}

export function MarketplaceFilters({
  selectedCategory,
  selectedSort,
  onCategoryChange,
  onSortChange,
}: MarketplaceFiltersProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Categories */}
        <div>
          <h3 className="font-semibold mb-3">Category</h3>
          <div className="space-y-2">
            <Button
              variant={!selectedCategory ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => onCategoryChange(undefined)}
            >
              All Categories
            </Button>
            {Object.values(CATEGORY_INFO).map((category) => (
              <Button
                key={category.value}
                variant={selectedCategory === category.value ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => onCategoryChange(category.value)}
              >
                <span className="mr-2">{category.icon}</span>
                {category.label}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Sort Options */}
        <div>
          <h3 className="font-semibold mb-3">Sort By</h3>
          <div className="space-y-2">
            {SORT_OPTIONS.map((option) => (
              <Button
                key={option.value}
                variant={selectedSort === option.value ? 'default' : 'ghost'}
                className="w-full justify-start"
                onClick={() => onSortChange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

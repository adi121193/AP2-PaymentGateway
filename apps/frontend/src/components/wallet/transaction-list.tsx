/**
 * Transaction List Component
 * Displays wallet transaction history
 */

'use client';

import { useState } from 'react';
import { useTransactions } from '@/hooks/use-wallet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, ArrowDownRight, RefreshCw, DollarSign, ChevronLeft, ChevronRight } from 'lucide-react';
import type { OwnerType, TransactionType } from '@/lib/api/wallet';

interface TransactionListProps {
  ownerType: OwnerType;
  ownerId: string;
}

export function TransactionList({ ownerType, ownerId }: TransactionListProps) {
  const [page, setPage] = useState(0);
  const limit = 10;

  const { data, isLoading, error } = useTransactions(ownerType, ownerId, {
    limit,
    offset: page * limit,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionIcon = (type: TransactionType, direction: string) => {
    if (direction === 'CREDIT') {
      return <ArrowDownRight className="h-4 w-4 text-green-600" />;
    }
    return <ArrowUpRight className="h-4 w-4 text-red-600" />;
  };

  const getTransactionLabel = (type: TransactionType) => {
    const labels: Record<TransactionType, string> = {
      EXECUTION_EARNING: 'Execution Earning',
      EXECUTION_CHARGE: 'Execution Charge',
      WALLET_TOPUP: 'Wallet Top-up',
      WITHDRAWAL: 'Withdrawal',
      REFUND: 'Refund',
      ADJUSTMENT: 'Adjustment',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive'> = {
      COMPLETED: 'default',
      PENDING: 'secondary',
      FAILED: 'destructive',
      REVERSED: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'secondary'}>
        {status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load transactions. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  const transactions = data?.transactions || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 text-6xl mb-4">
          <DollarSign className="h-16 w-16 mx-auto" />
        </div>
        <h3 className="text-xl font-semibold mb-2">No transactions yet</h3>
        <p className="text-gray-600">
          Your transaction history will appear here
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Transaction List */}
      <div className="space-y-2">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-4">
              {/* Icon */}
              <div className="p-2 bg-gray-100 rounded-full">
                {getTransactionIcon(tx.type, tx.direction)}
              </div>

              {/* Details */}
              <div>
                <div className="font-medium">{getTransactionLabel(tx.type)}</div>
                <div className="text-sm text-gray-600">{formatDate(tx.created_at)}</div>
              </div>
            </div>

            {/* Amount and Status */}
            <div className="text-right">
              <div className={`font-semibold ${
                tx.direction === 'CREDIT' ? 'text-green-600' : 'text-gray-900'
              }`}>
                {tx.direction === 'CREDIT' ? '+' : '-'} {formatCurrency(tx.amount)}
              </div>
              <div className="mt-1">
                {getStatusBadge(tx.status)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
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
    </div>
  );
}

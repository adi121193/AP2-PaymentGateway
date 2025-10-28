/**
 * Wallet Card Component
 * Displays wallet balance and status
 */

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWallet } from '@/hooks/use-wallet';
import { Wallet, DollarSign, Clock } from 'lucide-react';
import type { OwnerType } from '@/lib/api/wallet';

interface WalletCardProps {
  ownerType: OwnerType;
  ownerId: string;
}

export function WalletCard({ ownerType, ownerId }: WalletCardProps) {
  const { data: wallet, isLoading, error } = useWallet(ownerType, ownerId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load wallet. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: wallet?.currency || 'USD',
    }).format(amount / 100);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Wallet Balance
        </CardTitle>
        <CardDescription>
          {ownerType === 'USER' ? 'Your available funds for agent executions' : 'Your earnings from agent sales'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Available Balance */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <DollarSign className="h-4 w-4" />
              Available Balance
            </div>
            <div className="text-3xl font-bold">
              {formatCurrency(wallet?.availableBalance || 0)}
            </div>
          </div>

          {/* Pending Balance */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="h-4 w-4" />
              Pending
            </div>
            <div className="text-3xl font-bold text-gray-400">
              {formatCurrency(wallet?.pendingBalance || 0)}
            </div>
          </div>

          {/* Total Balance */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Wallet className="h-4 w-4" />
              Total Balance
            </div>
            <div className="text-3xl font-bold text-blue-600">
              {formatCurrency(wallet?.totalBalance || 0)}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="mt-6">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            wallet?.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {wallet?.status || 'UNKNOWN'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

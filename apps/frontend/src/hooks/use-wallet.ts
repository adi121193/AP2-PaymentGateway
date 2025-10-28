/**
 * React Query hooks for Wallet operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWallet, getTransactions, topupWallet, requestWithdrawal } from '@/lib/api/wallet';
import type { OwnerType, TransactionType, TransactionStatus } from '@/lib/api/wallet';
import { toast } from 'sonner';

// ============================================================================
// Query Keys
// ============================================================================

export const walletKeys = {
  all: ['wallet'] as const,
  wallet: (ownerType: OwnerType, ownerId: string) => [...walletKeys.all, ownerType, ownerId] as const,
  transactions: (ownerType: OwnerType, ownerId: string, filters?: any) =>
    [...walletKeys.all, 'transactions', ownerType, ownerId, filters] as const,
};

// ============================================================================
// Queries
// ============================================================================

/**
 * Hook to fetch wallet balance and info
 */
export function useWallet(ownerType: OwnerType, ownerId: string) {
  return useQuery({
    queryKey: walletKeys.wallet(ownerType, ownerId),
    queryFn: () => getWallet(ownerType, ownerId),
    enabled: !!ownerId,
  });
}

/**
 * Hook to fetch wallet transactions
 */
export function useTransactions(
  ownerType: OwnerType,
  ownerId: string,
  params?: {
    type?: TransactionType;
    status?: TransactionStatus;
    limit?: number;
    offset?: number;
  }
) {
  return useQuery({
    queryKey: walletKeys.transactions(ownerType, ownerId, params),
    queryFn: () => getTransactions(ownerType, ownerId, params),
    enabled: !!ownerId,
  });
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Hook to top up wallet
 */
export function useTopupWallet(ownerType: OwnerType, ownerId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (amount: number) => topupWallet(ownerType, ownerId, amount),
    onSuccess: () => {
      // Invalidate wallet and transactions
      queryClient.invalidateQueries({ queryKey: walletKeys.wallet(ownerType, ownerId) });
      queryClient.invalidateQueries({ queryKey: walletKeys.transactions(ownerType, ownerId) });
      toast.success('Wallet topped up successfully!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to top up wallet');
    },
  });
}

/**
 * Hook to request withdrawal
 */
export function useRequestWithdrawal() {
  return useMutation({
    mutationFn: (amount: number) => requestWithdrawal(amount),
    onSuccess: () => {
      toast.success('Withdrawal request submitted!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error?.message || 'Failed to request withdrawal');
    },
  });
}

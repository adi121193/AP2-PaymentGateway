/**
 * Wallet API Client
 * Functions for interacting with wallet endpoints
 */

import { apiClient } from '../api-client';

export type OwnerType = 'USER' | 'DEVELOPER';
export type TransactionType = 'EXECUTION_EARNING' | 'EXECUTION_CHARGE' | 'WALLET_TOPUP' | 'WITHDRAWAL' | 'REFUND' | 'ADJUSTMENT';
export type TransactionStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'REVERSED';

export interface Wallet {
  id: string;
  owner_type: OwnerType;
  owner_id: string;
  availableBalance: number;
  pendingBalance: number;
  totalBalance: number;
  currency: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  type: TransactionType;
  direction: string;
  method: string;
  amount: number;
  fee_amount: number;
  currency: string;
  status: TransactionStatus;
  balance_after: number | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ListTransactionsResponse {
  transactions: WalletTransaction[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Get wallet for owner
 */
export async function getWallet(ownerType: OwnerType, ownerId: string): Promise<Wallet> {
  const response = await apiClient.get(`/wallet`, {
    params: {
      owner_type: ownerType,
      owner_id: ownerId,
    },
  });
  
  return response.data.data;
}

/**
 * Get wallet transactions
 */
export async function getTransactions(
  ownerType: OwnerType,
  ownerId: string,
  params?: {
    type?: TransactionType;
    status?: TransactionStatus;
    limit?: number;
    offset?: number;
  }
): Promise<ListTransactionsResponse> {
  const response = await apiClient.get(`/wallet/transactions`, {
    params: {
      owner_type: ownerType,
      owner_id: ownerId,
      ...params,
    },
  });
  
  return response.data.data;
}

/**
 * Top up wallet
 */
export async function topupWallet(
  ownerType: OwnerType,
  ownerId: string,
  amount: number
): Promise<WalletTransaction> {
  const response = await apiClient.post(`/wallet/topup`, {
    owner_type: ownerType,
    owner_id: ownerId,
    amount,
  });
  
  return response.data.data;
}

/**
 * Request withdrawal (developer only)
 */
export async function requestWithdrawal(amount: number): Promise<any> {
  const response = await apiClient.post(`/wallet/withdraw`, {
    amount,
  });
  
  return response.data.data;
}

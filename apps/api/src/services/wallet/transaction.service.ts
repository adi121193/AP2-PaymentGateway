/**
 * Transaction Service
 * Handles wallet transaction operations: creating, updating, querying
 */

import {
  PrismaClient,
  WalletTransaction,
  TransactionType,
  TransactionDirection,
  PaymentMethod,
  TransactionStatus,
  OwnerType,
} from '@ap2/database';
import { logger } from '../../logger.js';
import { WalletService } from './wallet.service.js';

// Custom error classes
class NotFoundError extends Error {
  statusCode = 404;
  code = 'NOT_FOUND';
}

class BadRequestError extends Error {
  statusCode = 400;
  code = 'BAD_REQUEST';
}

const prisma = new PrismaClient();

export interface CreateTransactionInput {
  walletId: string;
  type: TransactionType;
  direction: TransactionDirection;
  method: PaymentMethod;
  amount: number;
  feeAmount?: number;
  currency?: string;
  executionId?: string;
  paymentId?: string;
  counterpartyWalletId?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
}

export interface ListTransactionsInput {
  walletId: string;
  type?: TransactionType;
  status?: TransactionStatus;
  limit?: number;
  offset?: number;
}

export class TransactionService {
  /**
   * Create a new transaction
   */
  static async createTransaction(input: CreateTransactionInput): Promise<WalletTransaction> {
    logger.info({ input }, 'Creating transaction');

    // Check for duplicate using idempotency key
    if (input.idempotencyKey) {
      const existing = await prisma.walletTransaction.findUnique({
        where: { idempotency_key: input.idempotencyKey },
      });

      if (existing) {
        logger.info({ transactionId: existing.id }, 'Returning existing transaction (idempotent)');
        return existing;
      }
    }

    const transaction = await prisma.walletTransaction.create({
      data: {
        wallet_id: input.walletId,
        counterparty_wallet_id: input.counterpartyWalletId,
        execution_id: input.executionId,
        payment_id: input.paymentId,
        type: input.type,
        direction: input.direction,
        method: input.method,
        amount: input.amount,
        fee_amount: input.feeAmount || 0,
        currency: input.currency || 'USD',
        status: 'PENDING',
        metadata: input.metadata || {},
        idempotency_key: input.idempotencyKey,
      },
    });

    logger.info({ transactionId: transaction.id }, 'Transaction created');
    return transaction;
  }

  /**
   * Complete a pending transaction
   * Updates transaction status and wallet balances
   */
  static async completeTransaction(transactionId: string): Promise<WalletTransaction> {
    const transaction = await prisma.walletTransaction.findUnique({
      where: { id: transactionId },
      include: { wallet: true },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    if (transaction.status !== 'PENDING') {
      throw new BadRequestError(`Transaction is already ${transaction.status.toLowerCase()}`);
    }

    // Update wallet balance based on transaction direction
    let updatedWallet;
    if (transaction.direction === 'DEBIT') {
      // Complete the debit (remove from pending)
      updatedWallet = await WalletService.completeDebit(transaction.wallet_id, transaction.amount);
    } else {
      // Credit wallet (add to available balance)
      updatedWallet = await WalletService.creditWallet(transaction.wallet_id, transaction.amount);
    }

    // Update transaction with final balance
    const updatedTransaction = await prisma.walletTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'COMPLETED',
        balance_after: updatedWallet.available_balance + updatedWallet.pending_balance,
      },
    });

    logger.info({ transactionId }, 'Transaction completed');
    return updatedTransaction;
  }

  /**
   * Fail a pending transaction
   * Releases reserved funds if applicable
   */
  static async failTransaction(transactionId: string, reason?: string): Promise<WalletTransaction> {
    const transaction = await prisma.walletTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    if (transaction.status !== 'PENDING') {
      throw new BadRequestError(`Transaction is already ${transaction.status.toLowerCase()}`);
    }

    // If it was a debit, release the reserved funds
    if (transaction.direction === 'DEBIT') {
      await WalletService.releaseFunds(transaction.wallet_id, transaction.amount);
    }

    const updatedTransaction = await prisma.walletTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'FAILED',
        metadata: {
          ...(transaction.metadata as Record<string, any>),
          failureReason: reason,
        },
      },
    });

    logger.info({ transactionId, reason }, 'Transaction failed');
    return updatedTransaction;
  }

  /**
   * Process a wallet top-up
   * Creates a CREDIT transaction and updates wallet balance
   */
  static async processTopup(
    ownerType: OwnerType,
    ownerId: string,
    amount: number,
    paymentId?: string,
    metadata?: Record<string, any>
  ): Promise<WalletTransaction> {
    // Get or create wallet
    const wallet = await WalletService.getOrCreateWallet(ownerType, ownerId);

    // Create transaction
    const transaction = await this.createTransaction({
      walletId: wallet.id,
      type: 'WALLET_TOPUP',
      direction: 'CREDIT',
      method: paymentId ? 'CASHFREE' : 'MANUAL',
      amount,
      paymentId,
      metadata,
      idempotencyKey: paymentId ? `topup_${paymentId}` : undefined,
    });

    // Complete immediately for manual topups
    if (!paymentId) {
      return this.completeTransaction(transaction.id);
    }

    return transaction;
  }

  /**
   * Process an execution charge
   * Reserves funds from user wallet for agent execution
   */
  static async processExecutionCharge(
    userId: string,
    executionId: string,
    amount: number,
    metadata?: Record<string, any>
  ): Promise<WalletTransaction> {
    // Get user wallet
    const wallet = await WalletService.getWalletByOwner('USER', userId);

    // Check sufficient balance
    if (wallet.available_balance < amount) {
      throw new BadRequestError('Insufficient wallet balance');
    }

    // Reserve funds
    await WalletService.reserveFunds(wallet.id, amount);

    // Create pending transaction
    const transaction = await this.createTransaction({
      walletId: wallet.id,
      type: 'EXECUTION_CHARGE',
      direction: 'DEBIT',
      method: 'WALLET',
      amount,
      executionId,
      metadata,
      idempotencyKey: `execution_charge_${executionId}`,
    });

    logger.info({ executionId, amount }, 'Execution charge reserved');
    return transaction;
  }

  /**
   * Process an execution earning
   * Credits developer wallet when execution completes
   */
  static async processExecutionEarning(
    developerId: string,
    executionId: string,
    amount: number,
    feeAmount: number,
    metadata?: Record<string, any>
  ): Promise<WalletTransaction> {
    // Get or create developer wallet
    const wallet = await WalletService.getOrCreateWallet('DEVELOPER', developerId);

    // Create transaction
    const transaction = await this.createTransaction({
      walletId: wallet.id,
      type: 'EXECUTION_EARNING',
      direction: 'CREDIT',
      method: 'WALLET',
      amount: amount - feeAmount,
      feeAmount,
      executionId,
      metadata,
      idempotencyKey: `execution_earning_${executionId}`,
    });

    // Complete immediately
    return this.completeTransaction(transaction.id);
  }

  /**
   * List transactions for a wallet
   */
  static async listTransactions(input: ListTransactionsInput): Promise<{
    transactions: WalletTransaction[];
    total: number;
  }> {
    const where: any = {
      wallet_id: input.walletId,
    };

    if (input.type) {
      where.type = input.type;
    }

    if (input.status) {
      where.status = input.status;
    }

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: input.limit || 20,
        skip: input.offset || 0,
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    return { transactions, total };
  }

  /**
   * Get transaction by ID
   */
  static async getTransaction(transactionId: string): Promise<WalletTransaction> {
    const transaction = await prisma.walletTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundError('Transaction not found');
    }

    return transaction;
  }
}

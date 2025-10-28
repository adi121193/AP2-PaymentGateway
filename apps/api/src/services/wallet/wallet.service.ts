/**
 * Wallet Service
 * Handles wallet operations: creation, balance queries, and updates
 */

import { PrismaClient, Wallet, OwnerType, WalletStatus } from '@ap2/database';
import { logger } from '../../logger.js';

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

export interface CreateWalletInput {
  ownerType: OwnerType;
  ownerId: string;
  currency?: string;
}

export interface WalletBalance {
  availableBalance: number;
  pendingBalance: number;
  totalBalance: number;
  currency: string;
  status: WalletStatus;
}

export class WalletService {
  /**
   * Create a new wallet for a user or developer
   */
  static async createWallet(input: CreateWalletInput): Promise<Wallet> {
    logger.info({ input }, 'Creating wallet');

    // Check if wallet already exists
    const existing = await prisma.wallet.findUnique({
      where: {
        owner_type_owner_id: {
          owner_type: input.ownerType,
          owner_id: input.ownerId,
        },
      },
    });

    if (existing) {
      throw new BadRequestError('Wallet already exists for this owner');
    }

    // Verify owner exists
    if (input.ownerType === 'USER') {
      const user = await prisma.user.findUnique({ where: { id: input.ownerId } });
      if (!user) {
        throw new NotFoundError('User not found');
      }
    } else {
      const developer = await prisma.developer.findUnique({ where: { id: input.ownerId } });
      if (!developer) {
        throw new NotFoundError('Developer not found');
      }
    }

    const wallet = await prisma.wallet.create({
      data: {
        owner_type: input.ownerType,
        owner_id: input.ownerId,
        currency: input.currency || 'USD',
        available_balance: 0,
        pending_balance: 0,
        status: 'ACTIVE',
      },
    });

    logger.info({ walletId: wallet.id, ownerId: input.ownerId }, 'Wallet created');
    return wallet;
  }

  /**
   * Get or create wallet for an owner
   */
  static async getOrCreateWallet(ownerType: OwnerType, ownerId: string): Promise<Wallet> {
    const existing = await prisma.wallet.findUnique({
      where: {
        owner_type_owner_id: {
          owner_type: ownerType,
          owner_id: ownerId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.createWallet({ ownerType, ownerId });
  }

  /**
   * Get wallet by owner
   */
  static async getWalletByOwner(ownerType: OwnerType, ownerId: string): Promise<Wallet> {
    const wallet = await prisma.wallet.findUnique({
      where: {
        owner_type_owner_id: {
          owner_type: ownerType,
          owner_id: ownerId,
        },
      },
    });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    if (wallet.status !== 'ACTIVE') {
      throw new BadRequestError(`Wallet is ${wallet.status.toLowerCase()}`);
    }

    return wallet;
  }

  /**
   * Get wallet balance
   */
  static async getBalance(ownerType: OwnerType, ownerId: string): Promise<WalletBalance> {
    const wallet = await this.getWalletByOwner(ownerType, ownerId);

    return {
      availableBalance: wallet.available_balance,
      pendingBalance: wallet.pending_balance,
      totalBalance: wallet.available_balance + wallet.pending_balance,
      currency: wallet.currency,
      status: wallet.status,
    };
  }

  /**
   * Check if wallet has sufficient balance
   */
  static async hasSufficientBalance(
    ownerType: OwnerType,
    ownerId: string,
    amount: number
  ): Promise<boolean> {
    const wallet = await this.getWalletByOwner(ownerType, ownerId);
    return wallet.available_balance >= amount;
  }

  /**
   * Reserve funds (move from available to pending)
   * Used when starting a transaction
   */
  static async reserveFunds(walletId: string, amount: number): Promise<Wallet> {
    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    if (wallet.available_balance < amount) {
      throw new BadRequestError('Insufficient balance');
    }

    return prisma.wallet.update({
      where: { id: walletId },
      data: {
        available_balance: wallet.available_balance - amount,
        pending_balance: wallet.pending_balance + amount,
      },
    });
  }

  /**
   * Release reserved funds (move from pending back to available)
   * Used when canceling a transaction
   */
  static async releaseFunds(walletId: string, amount: number): Promise<Wallet> {
    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    if (wallet.pending_balance < amount) {
      throw new BadRequestError('Insufficient pending balance');
    }

    return prisma.wallet.update({
      where: { id: walletId },
      data: {
        available_balance: wallet.available_balance + amount,
        pending_balance: wallet.pending_balance - amount,
      },
    });
  }

  /**
   * Complete debit (remove from pending)
   * Used when finalizing a payment
   */
  static async completeDebit(walletId: string, amount: number): Promise<Wallet> {
    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });

    if (!wallet) {
      throw new NotFoundError('Wallet not found');
    }

    if (wallet.pending_balance < amount) {
      throw new BadRequestError('Insufficient pending balance');
    }

    return prisma.wallet.update({
      where: { id: walletId },
      data: {
        pending_balance: wallet.pending_balance - amount,
      },
    });
  }

  /**
   * Credit wallet (add to available balance)
   * Used for top-ups and earnings
   */
  static async creditWallet(walletId: string, amount: number): Promise<Wallet> {
    return prisma.wallet.update({
      where: { id: walletId },
      data: {
        available_balance: {
          increment: amount,
        },
      },
    });
  }
}

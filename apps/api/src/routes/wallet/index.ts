/**
 * Wallet Routes
 * Endpoints for wallet and transaction management
 */

import { Router, Request, Response } from 'express';
import { WalletService, TransactionService } from '../../services/wallet/index.js';
import { authenticateDeveloper } from '../../middleware/developer-auth.js';
import { OwnerType, TransactionType, TransactionStatus } from '@ap2/database';
import { logger } from '../../logger.js';

const router = Router();

/**
 * GET /wallet
 * Get wallet balance and info for authenticated owner
 * Query params: owner_type (USER|DEVELOPER), owner_id
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { owner_type, owner_id } = req.query;

    if (!owner_type || !owner_id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'owner_type and owner_id are required',
        },
      });
    }

    const ownerType = owner_type as OwnerType;
    const ownerId = owner_id as string;

    // Get or create wallet
    const wallet = await WalletService.getOrCreateWallet(ownerType, ownerId);
    const balance = await WalletService.getBalance(ownerType, ownerId);

    res.json({
      success: true,
      data: {
        id: wallet.id,
        owner_type: wallet.owner_type,
        owner_id: wallet.owner_id,
        ...balance,
        created_at: wallet.created_at,
        updated_at: wallet.updated_at,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error fetching wallet');
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      },
    });
  }
});

/**
 * GET /wallet/transactions
 * List transactions for a wallet
 * Query params: owner_type, owner_id, type?, status?, limit?, offset?
 */
router.get('/transactions', async (req: Request, res: Response): Promise<void> => {
  try {
    const { owner_type, owner_id, type, status, limit, offset } = req.query;

    if (!owner_type || !owner_id) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'owner_type and owner_id are required',
        },
      });
    }

    const ownerType = owner_type as OwnerType;
    const ownerId = owner_id as string;

    // Get wallet
    const wallet = await WalletService.getWalletByOwner(ownerType, ownerId);

    // List transactions
    const { transactions, total } = await TransactionService.listTransactions({
      walletId: wallet.id,
      type: type as TransactionType | undefined,
      status: status as TransactionStatus | undefined,
      limit: limit ? parseInt(limit as string) : 20,
      offset: offset ? parseInt(offset as string) : 0,
    });

    res.json({
      success: true,
      data: {
        transactions,
        total,
        limit: limit ? parseInt(limit as string) : 20,
        offset: offset ? parseInt(offset as string) : 0,
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error fetching transactions');
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      },
    });
  }
});

/**
 * POST /wallet/topup
 * Create a wallet top-up transaction
 * For now, manually credits the wallet (TODO: integrate with Cashfree)
 */
router.post('/topup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { owner_type, owner_id, amount } = req.body;

    if (!owner_type || !owner_id || !amount) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'owner_type, owner_id, and amount are required',
        },
      });
    }

    if (amount <= 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_AMOUNT',
          message: 'Amount must be greater than 0',
        },
      });
    }

    const transaction = await TransactionService.processTopup(
      owner_type as OwnerType,
      owner_id,
      amount,
      undefined,
      { source: 'manual_topup' }
    );

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error: any) {
    logger.error({ error }, 'Error processing top-up');
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      },
    });
  }
});

/**
 * POST /wallet/withdraw
 * Request a withdrawal (developer only)
 * TODO: Implement withdrawal approval workflow
 */
router.post('/withdraw', authenticateDeveloper, async (req: Request, res: Response): Promise<void> => {
  try {
    const developer = (req as any).developer;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_AMOUNT',
          message: 'Amount must be greater than 0',
        },
      });
    }

    // Get developer wallet
    const wallet = await WalletService.getWalletByOwner('DEVELOPER', developer.id);

    // Check sufficient balance
    if (wallet.available_balance < amount) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_BALANCE',
          message: 'Insufficient wallet balance',
        },
      });
    }

    // TODO: Implement proper withdrawal request workflow
    // For now, just return a pending status
    res.json({
      success: true,
      data: {
        status: 'PENDING_APPROVAL',
        amount,
        message: 'Withdrawal request submitted. Pending admin approval.',
      },
    });
  } catch (error: any) {
    logger.error({ error }, 'Error processing withdrawal');
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      },
    });
  }
});

export default router;

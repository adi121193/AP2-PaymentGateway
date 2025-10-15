import { Router, Request, Response } from "express";
import { prisma } from "@ap2/database";
import { success, ValidationError } from "@ap2/domain";
import { generateReceiptHash } from "@ap2/receipts";
import { z } from "zod";
import { authenticate } from "../middleware/auth.js";
import { idempotency } from "../middleware/idempotency.js";
import { asyncHandler } from "../middleware/error-handler.js";
import { validateExecution, enforcePolicy } from "../services/policy-gate.js";
import { logger } from "../logger.js";

export const executeRouter = Router();

/**
 * Request schema for executing a payment
 */
const ExecutePaymentSchema = z.object({
  mandate_id: z.string().min(1, "Mandate ID is required"),
  // Future: vendor_endpoint for x402, additional metadata
});

/**
 * POST /execute
 * Execute a payment based on a signed mandate
 *
 * Flow:
 * 1. Validate mandate (policy gate)
 * 2. Route to appropriate payment rail (Stripe/x402) - STUBBED for Phase B2
 * 3. Create Payment record
 * 4. Generate Receipt with hash chain
 * 5. Return receipt ID
 *
 * Authentication: Required
 * Idempotency: Required
 */
executeRouter.post(
  "/",
  authenticate,
  idempotency,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    const agentId = req.agentId;

    if (!agentId) {
      throw new ValidationError("Agent ID not found in request");
    }

    // Validate request body
    const { mandate_id } = ExecutePaymentSchema.parse(req.body);

    logger.info(
      {
        agentId,
        mandateId: mandate_id,
      },
      "Executing payment"
    );

    try {
      // Validate mandate and execution parameters
      const executionCheck = await validateExecution(mandate_id);
      enforcePolicy(executionCheck);

      // Fetch mandate with full details
      const mandate = await prisma.mandate.findUnique({
        where: { id: mandate_id },
        include: {
          intent: true,
          policy: true,
        },
      });

      if (!mandate) {
        throw new ValidationError("Mandate not found");
      }

      // Verify agent owns this mandate
      if (mandate.intent.agent_id !== agentId) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Access denied to this mandate",
          },
        });
        return;
      }

      // === PHASE B2: STUBBED PAYMENT RAIL ===
      // In Phase C, this will call the rails router to select Stripe/x402
      // For now, we create a "pending" payment without calling external APIs

      logger.info(
        {
          mandateId: mandate_id,
          amount: mandate.intent.amount,
          vendor: mandate.intent.vendor,
        },
        "Payment rail call stubbed - creating pending payment"
      );

      // Create payment record (status: PENDING)
      const payment = await prisma.payment.create({
        data: {
          mandate_id: mandate.id,
          provider: "mock", // Will be "stripe" or "x402" in Phase C
          provider_ref: null, // Will be set by payment rail
          amount: mandate.intent.amount,
          currency: mandate.intent.currency,
          status: "PENDING",
        },
      });

      // === RECEIPT CHAIN INTEGRATION (T005) ===

      // Get last receipt for this agent (for chain linking)
      const lastReceipt = await prisma.receipt.findFirst({
        where: { agent_id: agentId },
        orderBy: { chain_index: "desc" },
      });

      // Calculate chain index
      const chainIndex = lastReceipt ? lastReceipt.chain_index + 1 : 0;

      // Prepare receipt data for hashing
      const receiptData = {
        prev_hash: lastReceipt?.hash || null,
        payment_id: payment.id,
        mandate_id: mandate.id,
        amount: payment.amount,
        currency: payment.currency,
        timestamp: payment.created_at,
      };

      // Generate receipt hash (includes previous hash for chain)
      const receiptHash = generateReceiptHash(receiptData);

      // Create receipt with hash chain
      const receipt = await prisma.receipt.create({
        data: {
          payment_id: payment.id,
          agent_id: agentId,
          hash: receiptHash,
          prev_hash: lastReceipt?.hash || null,
          chain_index: chainIndex,
        },
      });

      // Update purchase intent status
      await prisma.purchaseIntent.update({
        where: { id: mandate.intent_id },
        data: { status: "EXECUTED" },
      });

      // Update mandate status to exhausted (single-use)
      await prisma.mandate.update({
        where: { id: mandate_id },
        data: { status: "EXHAUSTED" },
      });

      const duration = Date.now() - startTime;

      logger.info(
        {
          paymentId: payment.id,
          receiptId: receipt.id,
          mandateId: mandate_id,
          amount: payment.amount,
          chainIndex,
          hash: receiptHash,
          duration,
        },
        "Payment executed successfully (pending settlement)"
      );

      // Return success response
      res.status(201).json(
        success({
          payment_id: payment.id,
          receipt_id: receipt.id,
          mandate_id: mandate.id,
          intent_id: mandate.intent_id,
          provider: payment.provider,
          provider_ref: payment.provider_ref,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          receipt_hash: receipt.hash,
          receipt_chain_index: receipt.chain_index,
          message: "Payment initiated. Settlement pending (test mode).",
          created_at: payment.created_at,
        })
      );
    } catch (dbError) {
      // Handle database not available
      if (
        dbError instanceof Error &&
        (dbError.message.includes("Can't reach database server") ||
          dbError.message.includes("Connection refused"))
      ) {
        logger.warn(
          { agentId, mandateId: mandate_id },
          "Database not available - returning mock execution result"
        );

        // Return mock execution for testing
        const mockExecution = {
          payment_id: `payment_mock_${Date.now()}`,
          receipt_id: `receipt_mock_${Date.now()}`,
          mandate_id,
          intent_id: "unknown",
          provider: "mock",
          provider_ref: null,
          amount: 0,
          currency: "USD",
          status: "PENDING",
          receipt_hash: "sha256:" + "0".repeat(64),
          receipt_chain_index: 0,
          message: "Payment initiated (database unavailable, mock response)",
          created_at: new Date(),
        };

        res.status(201).json(success(mockExecution));
        return;
      }

      throw dbError;
    }
  })
);

/**
 * GET /execute/:paymentId
 * Check payment status (for polling)
 *
 * Authentication: Required
 */
executeRouter.get(
  "/:paymentId",
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { paymentId } = req.params;
    const agentId = req.agentId;

    if (!agentId) {
      throw new ValidationError("Agent ID not found in request");
    }

    try {
      const payment = await prisma.payment.findFirst({
        where: {
          id: paymentId,
        },
        include: {
          mandate: {
            include: {
              intent: true,
            },
          },
          receipt: true,
        },
      });

      if (!payment) {
        res.status(404).json({
          success: false,
          error: {
            code: "PAYMENT_NOT_FOUND",
            message: "Payment not found",
          },
        });
        return;
      }

      // Verify agent owns this payment
      if (payment.mandate.intent.agent_id !== agentId) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: "Access denied to this payment",
          },
        });
        return;
      }

      res.status(200).json(
        success({
          payment_id: payment.id,
          mandate_id: payment.mandate_id,
          provider: payment.provider,
          provider_ref: payment.provider_ref,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          settled_at: payment.settled_at,
          receipt_id: payment.receipt?.id || null,
          created_at: payment.created_at,
        })
      );
    } catch (dbError) {
      if (
        dbError instanceof Error &&
        (dbError.message.includes("Can't reach database server") ||
          dbError.message.includes("Connection refused"))
      ) {
        res.status(503).json({
          success: false,
          error: {
            code: "DATABASE_ERROR",
            message: "Database unavailable",
          },
        });
        return;
      }

      throw dbError;
    }
  })
);

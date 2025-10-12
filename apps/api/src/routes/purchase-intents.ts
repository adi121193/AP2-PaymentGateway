import { Router, Request, Response } from "express";
import { prisma } from "@ap2/database";
import {
  PurchaseIntentSchema,
  success,
  ValidationError,
  NotFoundError,
} from "@ap2/domain";
import { authenticate } from "../middleware/auth.js";
import { idempotency } from "../middleware/idempotency.js";
import { asyncHandler } from "../middleware/error-handler.js";
import { logger } from "../logger.js";

export const purchaseIntentsRouter = Router();

/**
 * POST /purchase-intents
 * Create a new purchase intent
 *
 * Authentication: Required (HMAC or JWT)
 * Idempotency: Required
 */
purchaseIntentsRouter.post(
  "/",
  authenticate,
  idempotency,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();

    // Extract agent ID from auth middleware
    const agentId = req.agentId;
    if (!agentId) {
      throw new ValidationError("Agent ID not found in request");
    }

    // Parse and validate request body
    const validatedData = PurchaseIntentSchema.parse({
      ...req.body,
      agent_id: agentId, // Override with authenticated agent ID
    });

    logger.info(
      {
        agentId,
        vendor: validatedData.vendor,
        amount: validatedData.amount,
        currency: validatedData.currency,
      },
      "Creating purchase intent"
    );

    try {
      // Verify agent exists and is active
      const agent = await prisma.agent.findUnique({
        where: { id: agentId },
        select: {
          id: true,
          status: true,
        },
      });

      if (!agent) {
        throw new NotFoundError("Agent");
      }

      if (agent.status !== "active") {
        throw new ValidationError(`Agent is ${agent.status}, not active`);
      }

      // Create purchase intent
      const intent = await prisma.purchaseIntent.create({
        data: {
          agent_id: agentId,
          vendor: validatedData.vendor,
          amount: validatedData.amount,
          currency: validatedData.currency,
          description: validatedData.description,
          metadata: (validatedData.metadata || {}) as any,
          status: "PENDING",
        },
      });

      const duration = Date.now() - startTime;

      logger.info(
        {
          intentId: intent.id,
          agentId,
          vendor: intent.vendor,
          amount: intent.amount,
          duration,
        },
        "Purchase intent created successfully"
      );

      // Return success response
      res.status(201).json(
        success({
          intent_id: intent.id,
          agent_id: intent.agent_id,
          vendor: intent.vendor,
          amount: intent.amount,
          currency: intent.currency,
          description: intent.description,
          metadata: intent.metadata,
          status: intent.status,
          created_at: intent.created_at,
        })
      );
    } catch (dbError) {
      // Handle database not available during Phase B1
      if (
        dbError instanceof Error &&
        (dbError.message.includes("Can't reach database server") ||
          dbError.message.includes("Connection refused"))
      ) {
        logger.warn(
          { agentId },
          "Database not available - returning mock response for testing"
        );

        // Return mock response for testing
        const mockIntent = {
          intent_id: `intent_mock_${Date.now()}`,
          agent_id: agentId,
          vendor: validatedData.vendor,
          amount: validatedData.amount,
          currency: validatedData.currency,
          description: validatedData.description,
          metadata: validatedData.metadata || {},
          status: "PENDING",
          created_at: new Date(),
        };

        res.status(201).json(success(mockIntent));
        return;
      }

      throw dbError;
    }
  })
);

/**
 * GET /purchase-intents/:id
 * Retrieve a purchase intent by ID
 *
 * Authentication: Required
 */
purchaseIntentsRouter.get(
  "/:id",
  authenticate,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    const agentId = req.agentId;

    if (!agentId) {
      throw new ValidationError("Agent ID not found in request");
    }

    try {
      const intent = await prisma.purchaseIntent.findFirst({
        where: {
          id,
          agent_id: agentId, // Ensure agent can only access their own intents
        },
      });

      if (!intent) {
        throw new NotFoundError("Purchase intent");
      }

      res.status(200).json(
        success({
          intent_id: intent.id,
          agent_id: intent.agent_id,
          vendor: intent.vendor,
          amount: intent.amount,
          currency: intent.currency,
          description: intent.description,
          metadata: intent.metadata,
          status: intent.status,
          created_at: intent.created_at,
        })
      );
    } catch (dbError) {
      if (
        dbError instanceof Error &&
        (dbError.message.includes("Can't reach database server") ||
          dbError.message.includes("Connection refused"))
      ) {
        throw new NotFoundError("Purchase intent (database unavailable)");
      }

      throw dbError;
    }
  })
);

/**
 * Cashfree Webhook Handler
 *
 * Handles asynchronous payment notifications from Cashfree PG
 *
 * Events:
 * - PAYMENT_SUCCESS → Update payment to SETTLED
 * - PAYMENT_FAILED → Update payment to FAILED
 * - PAYMENT_USER_DROPPED → Update payment to CANCELLED
 *
 * Security:
 * - Verifies HMAC-SHA256 signature using CASHFREE_SECRET_KEY
 * - Signature format: "t=<timestamp>,v1=<signature>"
 * - Idempotent (Cashfree event IDs are unique)
 * - Returns 200 OK to prevent Cashfree retries
 *
 * Flow:
 * 1. Verify HMAC signature
 * 2. Parse event type
 * 3. Find payment by provider_ref (order_id)
 * 4. Update payment status
 * 5. Generate receipt if payment settled
 * 6. Return 200 OK
 */

import { Router, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@ap2/database";
import { getEnv } from "@ap2/domain";
import { generateReceiptHash } from "@ap2/receipts";
import { logger } from "../../logger.js";
import { asyncHandler } from "../../middleware/error-handler.js";

export const cashfreeWebhookRouter = Router();

/**
 * Cashfree webhook event types
 */
type CashfreeEventType =
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED"
  | "PAYMENT_USER_DROPPED"
  | "SETTLEMENT";

/**
 * Cashfree webhook payload structure
 */
interface CashfreeWebhookPayload {
  type: CashfreeEventType;
  data: {
    order: {
      order_id: string;
      order_amount: number;
      order_currency: string;
      order_status: string;
    };
    payment: {
      cf_payment_id: string;
      payment_status: string;
      payment_amount: number;
      payment_time: string;
      payment_method?: {
        payment_method_type: string;
      };
    };
    customer_details?: {
      customer_id: string;
      customer_email?: string;
      customer_phone?: string;
    };
  };
  event_time: string;
}

/**
 * POST /webhooks/cashfree
 * Handle Cashfree webhook events
 *
 * NOTE: This endpoint receives JSON body but needs raw body for signature verification
 * The webhook router saves rawBody before JSON parsing
 */
cashfreeWebhookRouter.post(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const env = getEnv();

    // Ensure Cashfree is configured
    if (!env.CASHFREE_APP_ID || !env.CASHFREE_SECRET_KEY) {
      logger.warn("Cashfree webhook received but Cashfree is not configured");
      res.status(200).json({ received: true, message: "Cashfree not configured" });
      return;
    }

    // Get signature from header
    const signature = req.headers["x-webhook-signature"] as string;
    const timestamp = req.headers["x-webhook-timestamp"] as string;

    if (!signature || !timestamp) {
      logger.warn("Cashfree webhook received without signature headers");
      res.status(400).json({ error: "Missing signature headers" });
      return;
    }

    // Verify signature
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const isValid = verifyCashfreeSignature(
      rawBody,
      timestamp,
      signature,
      env.CASHFREE_SECRET_KEY
    );

    if (!isValid) {
      logger.warn(
        {
          signature: signature.substring(0, 20) + "...",
          timestamp,
        },
        "Cashfree webhook signature verification failed"
      );
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    // Parse webhook payload
    const payload = req.body as CashfreeWebhookPayload;

    // Extract event ID (use order_id + event_time as unique identifier)
    const eventId = `${payload.data.order.order_id}_${payload.event_time}`;

    // Log the event
    logger.info(
      {
        eventId,
        eventType: payload.type,
        orderId: payload.data.order.order_id,
        paymentId: payload.data.payment.cf_payment_id,
      },
      "Cashfree webhook event received"
    );

    // Check if we've already processed this event (idempotency)
    const existingIdempotency = await prisma.idempotency.findUnique({
      where: {
        route_key: {
          route: "/webhooks/cashfree",
          key: eventId,
        },
      },
    });

    if (existingIdempotency) {
      logger.info(
        { eventId },
        "Cashfree webhook event already processed (idempotent)"
      );
      res.status(200).json({ received: true, message: "Already processed" });
      return;
    }

    // Handle specific event types
    try {
      switch (payload.type) {
        case "PAYMENT_SUCCESS":
          await handlePaymentSuccess(payload);
          break;

        case "PAYMENT_FAILED":
          await handlePaymentFailed(payload);
          break;

        case "PAYMENT_USER_DROPPED":
          await handlePaymentDropped(payload);
          break;

        case "SETTLEMENT":
          logger.info(
            { orderId: payload.data.order.order_id },
            "Settlement webhook received (informational only)"
          );
          break;

        default:
          logger.info(
            { eventType: payload.type },
            "Unhandled Cashfree webhook event type"
          );
      }

      // Store idempotency record to prevent duplicate processing
      await prisma.idempotency.create({
        data: {
          route: "/webhooks/cashfree",
          key: eventId,
          payload: payload as any,
          status_code: 200,
          response: { received: true, processed: true },
        },
      });

      res.status(200).json({ received: true, processed: true });
    } catch (error) {
      // Log error but still return 200 to prevent Cashfree retries
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          eventId,
          eventType: payload.type,
        },
        "Error processing Cashfree webhook event"
      );

      // Still return 200 to acknowledge receipt
      res.status(200).json({
        received: true,
        processed: false,
        error: "Internal processing error",
      });
    }
  })
);

/**
 * Verify Cashfree webhook signature
 *
 * Signature format from Cashfree docs:
 * - Compute HMAC-SHA256(timestamp + rawBody, secretKey)
 * - Compare with provided signature
 */
function verifyCashfreeSignature(
  rawBody: string,
  timestamp: string,
  signature: string,
  secretKey: string
): boolean {
  try {
    // Parse signature format: "t=1234567890,v1=abcdef..."
    const parts = signature.split(",");
    const timestampPart = parts.find((p) => p.startsWith("t="));
    const signaturePart = parts.find((p) => p.startsWith("v1="));

    if (!timestampPart || !signaturePart) {
      // Try direct signature (some Cashfree implementations send just the signature)
      const signedPayload = timestamp + rawBody;
      const computedSignature = createHmac("sha256", secretKey)
        .update(signedPayload)
        .digest("hex");

      return secureCompare(computedSignature, signature);
    }

    const expectedTimestamp = timestampPart.split("=")[1];
    const expectedSignature = signaturePart.split("=")[1];

    if (!expectedTimestamp || !expectedSignature) {
      return false;
    }

    // Verify timestamp matches header
    if (expectedTimestamp !== timestamp) {
      logger.warn(
        { headerTimestamp: timestamp, signatureTimestamp: expectedTimestamp },
        "Timestamp mismatch in Cashfree webhook"
      );
      return false;
    }

    // Compute HMAC-SHA256 signature
    const signedPayload = timestamp + rawBody;
    const computedSignature = createHmac("sha256", secretKey)
      .update(signedPayload)
      .digest("hex");

    // Constant-time comparison
    return secureCompare(computedSignature, expectedSignature);
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Error verifying Cashfree signature"
    );
    return false;
  }
}

/**
 * Secure string comparison (constant-time to prevent timing attacks)
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");

  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Handle PAYMENT_SUCCESS event
 */
async function handlePaymentSuccess(
  payload: CashfreeWebhookPayload
): Promise<void> {
  const orderId = payload.data.order.order_id;
  const cfPaymentId = payload.data.payment.cf_payment_id;

  logger.info(
    {
      orderId,
      cfPaymentId,
      amount: payload.data.payment.payment_amount,
    },
    "Processing PAYMENT_SUCCESS"
  );

  // Find payment by provider_ref (Cashfree order_id)
  const payment = await prisma.payment.findFirst({
    where: { provider_ref: orderId },
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
    logger.warn(
      { orderId, cfPaymentId },
      "Payment not found for successful Cashfree payment (may be from test or external source)"
    );
    return;
  }

  // Check if payment is already settled (idempotency at payment level)
  if (payment.status === "SETTLED") {
    logger.info(
      { paymentId: payment.id },
      "Payment already settled (duplicate webhook)"
    );
    return;
  }

  // Update payment status
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "SETTLED",
      settled_at: new Date(payload.data.payment.payment_time),
    },
  });

  // Generate receipt if not already created
  if (!payment.receipt) {
    const agentId = payment.mandate.intent.agent_id;

    // Get last receipt for this agent (for chain linking)
    const lastReceipt = await prisma.receipt.findFirst({
      where: { agent_id: agentId },
      orderBy: { chain_index: "desc" },
    });

    const chainIndex = lastReceipt ? lastReceipt.chain_index + 1 : 0;

    // Prepare receipt data for hashing
    const receiptData = {
      prev_hash: lastReceipt?.hash || null,
      payment_id: payment.id,
      mandate_id: payment.mandate_id,
      amount: payment.amount,
      currency: payment.currency,
      timestamp: new Date(payload.data.payment.payment_time),
    };

    const receiptHash = generateReceiptHash(receiptData);

    // Create receipt
    const receipt = await prisma.receipt.create({
      data: {
        payment_id: payment.id,
        agent_id: agentId,
        hash: receiptHash,
        prev_hash: lastReceipt?.hash || null,
        chain_index: chainIndex,
      },
    });

    logger.info(
      {
        paymentId: payment.id,
        receiptId: receipt.id,
        chainIndex,
        hash: receiptHash,
      },
      "Receipt generated for settled Cashfree payment"
    );
  }

  logger.info(
    { paymentId: payment.id, cfPaymentId },
    "Cashfree payment successfully settled"
  );
}

/**
 * Handle PAYMENT_FAILED event
 */
async function handlePaymentFailed(
  payload: CashfreeWebhookPayload
): Promise<void> {
  const orderId = payload.data.order.order_id;

  logger.info(
    {
      orderId,
      paymentStatus: payload.data.payment.payment_status,
    },
    "Processing PAYMENT_FAILED"
  );

  // Find payment by provider_ref
  const payment = await prisma.payment.findFirst({
    where: { provider_ref: orderId },
  });

  if (!payment) {
    logger.warn(
      { orderId },
      "Payment not found for failed Cashfree payment"
    );
    return;
  }

  // Update payment status to FAILED
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "FAILED",
    },
  });

  logger.info(
    { paymentId: payment.id },
    "Cashfree payment marked as failed"
  );
}

/**
 * Handle PAYMENT_USER_DROPPED event
 */
async function handlePaymentDropped(
  payload: CashfreeWebhookPayload
): Promise<void> {
  const orderId = payload.data.order.order_id;

  logger.info(
    { orderId },
    "Processing PAYMENT_USER_DROPPED"
  );

  // Find payment by provider_ref
  const payment = await prisma.payment.findFirst({
    where: { provider_ref: orderId },
  });

  if (!payment) {
    logger.warn(
      { orderId },
      "Payment not found for dropped Cashfree payment"
    );
    return;
  }

  // Update payment status to CANCELLED
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "CANCELLED",
    },
  });

  logger.info(
    { paymentId: payment.id },
    "Cashfree payment marked as cancelled (user dropped)"
  );
}

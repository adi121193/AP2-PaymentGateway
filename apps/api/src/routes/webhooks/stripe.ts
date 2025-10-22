/**
 * Stripe Webhook Handler
 *
 * Handles asynchronous payment notifications from Stripe
 *
 * Events:
 * - payment_intent.succeeded → Update payment to SETTLED
 * - payment_intent.payment_failed → Update payment to FAILED
 *
 * Security:
 * - Verifies webhook signature using STRIPE_WEBHOOK_SECRET
 * - Idempotent (Stripe event IDs are unique and can be retried)
 * - Returns 200 OK to prevent Stripe retries even on errors
 *
 * Flow:
 * 1. Verify Stripe signature
 * 2. Parse event type
 * 3. Find payment by provider_ref (payment_intent.id)
 * 4. Update payment status
 * 5. Generate receipt if payment settled
 * 6. Return 200 OK
 */

import { Router, Request, Response } from "express";
import { prisma } from "@ap2/database";
import { getEnv } from "@ap2/domain";
import { generateReceiptHash } from "@ap2/receipts";
import { logger } from "../../logger.js";
import { asyncHandler } from "../../middleware/error-handler.js";
import Stripe from "stripe";

export const stripeWebhookRouter = Router();

/**
 * POST /webhooks/stripe
 * Handle Stripe webhook events
 *
 * NOTE: This endpoint MUST receive raw body for signature verification
 * The webhook router configures express.raw() middleware for this path
 */
stripeWebhookRouter.post(
  "/",
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const env = getEnv();

    // Ensure Stripe is configured
    if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
      logger.warn("Stripe webhook received but Stripe is not configured");
      res.status(200).json({ received: true, message: "Stripe not configured" });
      return;
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
      typescript: true,
    });

    // Get signature from header
    const signature = req.headers["stripe-signature"] as string;

    if (!signature) {
      logger.warn("Stripe webhook received without signature header");
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature and construct event
      // req.body should be Buffer (from express.raw())
      event = stripe.webhooks.constructEvent(
        req.body,
        signature,
        env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      const error = err as Error;
      logger.warn(
        {
          error: error.message,
          signature: signature.substring(0, 20) + "...",
        },
        "Stripe webhook signature verification failed"
      );
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    // Log the event
    logger.info(
      {
        eventId: event.id,
        eventType: event.type,
        created: event.created,
      },
      "Stripe webhook event received"
    );

    // Check if we've already processed this event (idempotency)
    const existingIdempotency = await prisma.idempotency.findUnique({
      where: {
        route_key: {
          route: "/webhooks/stripe",
          key: event.id,
        },
      },
    });

    if (existingIdempotency) {
      logger.info(
        { eventId: event.id },
        "Stripe webhook event already processed (idempotent)"
      );
      res.status(200).json({ received: true, message: "Already processed" });
      return;
    }

    // Handle specific event types
    try {
      switch (event.type) {
        case "payment_intent.succeeded":
          await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case "payment_intent.payment_failed":
          await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case "payment_intent.processing":
          await handlePaymentProcessing(event.data.object as Stripe.PaymentIntent);
          break;

        case "payment_intent.canceled":
          await handlePaymentCanceled(event.data.object as Stripe.PaymentIntent);
          break;

        default:
          logger.info(
            { eventType: event.type },
            "Unhandled Stripe webhook event type"
          );
      }

      // Store idempotency record to prevent duplicate processing
      await prisma.idempotency.create({
        data: {
          route: "/webhooks/stripe",
          key: event.id,
          payload: event as any,
          status_code: 200,
          response: { received: true, processed: true },
        },
      });

      res.status(200).json({ received: true, processed: true });
    } catch (error) {
      // Log error but still return 200 to prevent Stripe retries
      // Stripe will retry webhook delivery for non-200 responses
      logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          eventId: event.id,
          eventType: event.type,
        },
        "Error processing Stripe webhook event"
      );

      // Still return 200 to acknowledge receipt
      res.status(200).json({
        received: true,
        processed: false,
        error: "Internal processing error"
      });
    }
  })
);

/**
 * Handle payment_intent.succeeded event
 */
async function handlePaymentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const providerId = paymentIntent.id;

  logger.info(
    {
      paymentIntentId: providerId,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    },
    "Processing payment_intent.succeeded"
  );

  // Find payment by provider_ref
  const payment = await prisma.payment.findFirst({
    where: { provider_ref: providerId },
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
      { paymentIntentId: providerId },
      "Payment not found for succeeded payment_intent (may be from test or external source)"
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
      settled_at: new Date(),
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
      timestamp: new Date(),
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
      "Receipt generated for settled payment"
    );
  }

  logger.info(
    { paymentId: payment.id },
    "Payment successfully settled"
  );
}

/**
 * Handle payment_intent.payment_failed event
 */
async function handlePaymentFailed(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const providerId = paymentIntent.id;

  logger.info(
    {
      paymentIntentId: providerId,
      lastPaymentError: paymentIntent.last_payment_error?.message,
    },
    "Processing payment_intent.payment_failed"
  );

  // Find payment by provider_ref
  const payment = await prisma.payment.findFirst({
    where: { provider_ref: providerId },
  });

  if (!payment) {
    logger.warn(
      { paymentIntentId: providerId },
      "Payment not found for failed payment_intent"
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
    "Payment marked as failed"
  );
}

/**
 * Handle payment_intent.processing event
 */
async function handlePaymentProcessing(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const providerId = paymentIntent.id;

  logger.info(
    { paymentIntentId: providerId },
    "Processing payment_intent.processing"
  );

  const payment = await prisma.payment.findFirst({
    where: { provider_ref: providerId },
  });

  if (!payment) {
    logger.warn(
      { paymentIntentId: providerId },
      "Payment not found for processing payment_intent"
    );
    return;
  }

  // Update to PROCESSING status if not already settled
  if (payment.status !== "SETTLED") {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "PROCESSING",
      },
    });

    logger.info(
      { paymentId: payment.id },
      "Payment status updated to PROCESSING"
    );
  }
}

/**
 * Handle payment_intent.canceled event
 */
async function handlePaymentCanceled(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const providerId = paymentIntent.id;

  logger.info(
    { paymentIntentId: providerId },
    "Processing payment_intent.canceled"
  );

  const payment = await prisma.payment.findFirst({
    where: { provider_ref: providerId },
  });

  if (!payment) {
    logger.warn(
      { paymentIntentId: providerId },
      "Payment not found for canceled payment_intent"
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
    "Payment marked as cancelled"
  );
}

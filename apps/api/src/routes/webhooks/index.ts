/**
 * Webhooks Router
 *
 * Central router for all payment rail webhooks
 *
 * Routes:
 * - POST /webhooks/stripe → Stripe payment notifications
 * - POST /webhooks/cashfree → Cashfree payment notifications
 *
 * Security:
 * - Each webhook handler verifies signatures independently
 * - Rate limiting: 100 requests/min per IP
 * - Raw body parsing for signature verification
 *
 * IMPORTANT: Webhook routes MUST be registered BEFORE json middleware
 * in app.ts because signature verification requires raw body access
 */

import { Router, Request, Response, NextFunction } from "express";
import express from "express";
import rateLimit from "express-rate-limit";
import { stripeWebhookRouter } from "./stripe.js";
import { cashfreeWebhookRouter } from "./cashfree.js";
import { logger } from "../../logger.js";

export const webhooksRouter = Router();

/**
 * Rate limiting for webhooks
 * Prevents abuse while allowing legitimate payment provider webhooks
 */
const webhookRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: "Too many webhook requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (_req: Request) => {
    // Skip rate limiting in development
    return process.env.NODE_ENV === "development";
  },
});

/**
 * Middleware to capture raw body for signature verification
 * Stores raw body on req.rawBody before JSON parsing
 */
function captureRawBody(req: Request, res: Response, next: NextFunction) {
  if (req.path.startsWith("/stripe")) {
    // Stripe needs raw Buffer for signature verification
    express.raw({ type: "application/json" })(req, res, (err) => {
      if (err) {
        return next(err);
      }
      next();
    });
  } else if (req.path.startsWith("/cashfree")) {
    // Cashfree needs raw body as string
    let rawBody = "";
    req.on("data", (chunk) => {
      rawBody += chunk.toString();
    });
    req.on("end", () => {
      (req as any).rawBody = rawBody;
      // Parse JSON manually after capturing raw body
      try {
        req.body = JSON.parse(rawBody);
      } catch (error) {
        logger.warn(
          { error: error instanceof Error ? error.message : String(error) },
          "Failed to parse Cashfree webhook body"
        );
      }
      next();
    });
  } else {
    // Other webhooks can use standard JSON parsing
    express.json()(req, res, next);
  }
}

/**
 * Request logging for webhooks
 */
webhooksRouter.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(
    {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      contentType: req.get("content-type"),
    },
    "Webhook request received"
  );
  next();
});

/**
 * Apply rate limiting
 */
webhooksRouter.use(webhookRateLimiter);

/**
 * Apply raw body capture
 */
webhooksRouter.use(captureRawBody);

/**
 * Mount webhook handlers
 */
webhooksRouter.use("/stripe", stripeWebhookRouter);
webhooksRouter.use("/cashfree", cashfreeWebhookRouter);

/**
 * Health check for webhooks
 */
webhooksRouter.get("/health", (_req: Request, _res: Response) => {
  _res.status(200).json({
    status: "healthy",
    webhooks: ["stripe", "cashfree"],
    timestamp: new Date().toISOString(),
  });
});

/**
 * 404 handler for unknown webhook routes
 */
webhooksRouter.use((req: Request, res: Response) => {
  logger.warn(
    { path: req.path, method: req.method },
    "Unknown webhook route"
  );

  res.status(404).json({
    success: false,
    error: {
      code: "WEBHOOK_NOT_FOUND",
      message: `Webhook route ${req.method} ${req.path} not found`,
    },
  });
});

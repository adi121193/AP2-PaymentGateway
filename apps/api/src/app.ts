import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { errorHandler } from "./middleware/error-handler.js";
import { purchaseIntentsRouter } from "./routes/purchase-intents.js";
import { logger, logRequest } from "./logger.js";
import type { Env } from "@ap2/domain";

/**
 * Create and configure Express application
 */
export function createApp(env: Env): express.Application {
  const app = express();

  // Trust proxy for correct IP addresses behind reverse proxies
  app.set("trust proxy", true);

  // Parse JSON bodies
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // CORS configuration
  app.use(
    cors({
      origin: env.ALLOWED_ORIGINS,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "Idempotency-Key",
        "X-Request-ID",
      ],
    })
  );

  // Request logging middleware
  if (env.ENABLE_REQUEST_LOGGING) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();

      // Log after response is finished
      res.on("finish", () => {
        const duration = Date.now() - startTime;
        logRequest(req.method, req.path, res.statusCode, duration, {
          agentId: (req as any).agentId,
        });
      });

      next();
    });
  }

  // Health check endpoint
  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
    });
  });

  // API routes
  app.use("/purchase-intents", purchaseIntentsRouter);

  // TODO: Add more routes in Phase B2
  // app.use("/mandates", mandatesRouter);
  // app.use("/execute", executeRouter);
  // app.use("/receipts", receiptsRouter);
  // app.use("/webhooks", webhooksRouter);

  // 404 handler for unknown routes
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: `Route ${req.method} ${req.path} not found`,
      },
    });
  });

  // Global error handler (must be last)
  app.use(errorHandler);

  logger.info(
    {
      allowedOrigins: env.ALLOWED_ORIGINS,
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
    },
    "Express app configured"
  );

  return app;
}

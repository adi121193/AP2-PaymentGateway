import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { loadEnv } from "@ap2/domain";
import { createApp } from "./app.js";
import { logger } from "./logger.js";

/**
 * Entry point for the AP2-Native Agent Payment Gateway API
 */

// Load .env from project root
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../../../.env");
config({ path: envPath });

// Load and validate environment variables (fail-fast on missing/invalid config)
let env;
try {
  env = loadEnv();
  logger.info(
    {
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
      logLevel: env.LOG_LEVEL,
    },
    "Environment loaded successfully"
  );
} catch (error) {
  console.error("Failed to load environment:", error);
  process.exit(1);
}

// Create Express app
const app = createApp(env);

// Start server
const server = app.listen(env.PORT, () => {
  logger.info(
    {
      port: env.PORT,
      environment: env.NODE_ENV,
      pid: process.pid,
    },
    `🚀 AP2 Payment Gateway API listening on port ${env.PORT}`
  );

  logger.info(
    `📍 Health check: http://localhost:${env.PORT}/healthz`
  );
});

// Graceful shutdown handler
function gracefulShutdown(signal: string) {
  logger.info({ signal }, "Received shutdown signal, closing server...");

  server.close(() => {
    logger.info("Server closed successfully");

    // Close database connections
    // Note: Prisma client disconnect is handled automatically on process exit
    // If needed, you can explicitly call: await prisma.$disconnect()

    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10000);
}

// Handle shutdown signals
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  logger.fatal({ error }, "Uncaught exception");
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.fatal({ reason, promise }, "Unhandled promise rejection");
  process.exit(1);
});

export { app };

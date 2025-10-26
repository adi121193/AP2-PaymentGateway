import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createServer } from "net";
import { execSync } from "child_process";
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

/**
 * Check if a port is available
 * @param port - Port number to check
 * @returns Promise<boolean> - true if port is available, false otherwise
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(true);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
}

/**
 * Find the process using a specific port
 * @param port - Port number to check
 * @returns string | null - PID if found, null otherwise
 */
function findProcessOnPort(port: number): string | null {
  try {
    const output = execSync(`lsof -ti :${port}`, { encoding: 'utf-8' });
    return output.trim();
  } catch {
    return null;
  }
}

// Create Express app
const app = createApp(env);

// Check port availability before starting
const portAvailable = await isPortAvailable(env.PORT);

if (!portAvailable) {
  const pid = findProcessOnPort(env.PORT);

  logger.error(
    {
      port: env.PORT,
      existingPid: pid,
    },
    `❌ Port ${env.PORT} is already in use`
  );

  console.error(`\n${'='.repeat(70)}`);
  console.error(`  PORT CONFLICT DETECTED`);
  console.error(`${'='.repeat(70)}\n`);
  console.error(`  Port ${env.PORT} is already in use by another process.`);

  if (pid) {
    console.error(`  Process PID: ${pid}\n`);
    console.error(`  To kill the existing process, run:`);
    console.error(`    kill ${pid}`);
    console.error(`  \n  Or to kill all Node processes on this port:`);
    console.error(`    npm run dev:clean`);
  } else {
    console.error(`\n  To find the process using this port:`);
    console.error(`    lsof -i :${env.PORT}`);
  }

  console.error(`\n  Alternatively, change the PORT in your .env file.\n`);
  console.error(`${'='.repeat(70)}\n`);

  process.exit(1);
}

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
process.on("uncaughtException", (error: any) => {
  // Special handling for port-in-use errors
  if (error.code === 'EADDRINUSE') {
    logger.fatal(
      {
        error,
        port: error.port || env?.PORT,
        address: error.address
      },
      "Port already in use - another instance may be running"
    );

    console.error(`\n${'='.repeat(70)}`);
    console.error(`  FATAL ERROR: Port Already In Use`);
    console.error(`${'='.repeat(70)}\n`);
    console.error(`  Another process is already using port ${error.port || env?.PORT}.`);
    console.error(`  \n  This usually means another instance of the API is running.`);
    console.error(`  \n  To resolve:`);
    console.error(`    1. Check for running processes: lsof -i :${error.port || env?.PORT}`);
    console.error(`    2. Kill the process: kill <PID>`);
    console.error(`    3. Or run: npm run dev:clean`);
    console.error(`\n${'='.repeat(70)}\n`);
  } else {
    logger.fatal({ error }, "Uncaught exception");
  }

  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.fatal({ reason, promise }, "Unhandled promise rejection");
  process.exit(1);
});

export { app };

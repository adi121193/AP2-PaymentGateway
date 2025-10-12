import pino from "pino";

// Fallback to env vars directly since getEnv() requires loadEnv() first
const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const NODE_ENV = process.env.NODE_ENV || "development";

/**
 * Structured logger using Pino
 * Redacts sensitive fields for security
 */
export const logger = pino({
  level: LOG_LEVEL,
  redact: {
    paths: [
      "authorization",
      "req.headers.authorization",
      "res.headers.authorization",
      "stripe_secret_key",
      "jwt_secret",
      "signature",
      "password",
      "secret",
      "token",
      "mandate_sign_key",
    ],
    remove: true,
  },
  transport:
    NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  formatters: {
    level: (label: string) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Create a child logger with additional context
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log request details
 */
export function logRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  additionalContext?: Record<string, unknown>
) {
  logger.info(
    {
      method,
      path,
      statusCode,
      duration,
      ...additionalContext,
    },
    `${method} ${path} ${statusCode} - ${duration}ms`
  );
}

/**
 * Log error with stack trace
 */
export function logError(
  error: Error,
  context?: Record<string, unknown>
) {
  logger.error(
    {
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
      ...context,
    },
    `Error: ${error.message}`
  );
}

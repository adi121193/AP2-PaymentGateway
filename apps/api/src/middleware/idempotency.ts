import { Request, Response, NextFunction } from "express";
import { prisma } from "@ap2/database";
import { IdempotencyKeySchema, UnauthorizedError } from "@ap2/domain";
import { logger } from "../logger.js";

/**
 * Idempotency middleware
 * Ensures that duplicate requests with the same Idempotency-Key return the same response
 *
 * Required for POST, PUT, DELETE methods
 * Uses database Idempotency table to store cached responses
 */
export async function idempotency(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Only apply to mutation methods
  const mutationMethods = ["POST", "PUT", "DELETE", "PATCH"];
  if (!mutationMethods.includes(req.method)) {
    next();
    return;
  }

  try {
    // Extract idempotency key from header
    const idempotencyKey = req.headers["idempotency-key"] as string;

    if (!idempotencyKey) {
      throw new UnauthorizedError("Idempotency-Key header is required for mutation requests");
    }

    // Validate idempotency key format
    const validatedKey = IdempotencyKeySchema.parse(idempotencyKey);

    const route = `${req.method} ${req.path}`;

    try {
      // Check if this request has been processed before
      const existingEntry = await prisma.idempotency.findUnique({
        where: {
          route_key: {
            route,
            key: validatedKey,
          },
        },
      });

      if (existingEntry) {
        // Request already processed - return cached response
        logger.info(
          { route, key: validatedKey, cachedStatusCode: existingEntry.status_code },
          "Idempotency: Returning cached response"
        );

        res
          .status(existingEntry.status_code)
          .json(existingEntry.response);
        return;
      }

      // Store idempotency key in request for use by route handler
      (req as any).idempotencyKey = validatedKey;
      (req as any).idempotencyRoute = route;

      // Intercept the response to cache it
      const originalJson = res.json.bind(res);
      res.json = function (body: any) {
        // Cache the response in the database
        cacheResponse(route, validatedKey, res.statusCode, body).catch((err) => {
          logger.error(
            { error: err, route, key: validatedKey },
            "Failed to cache idempotency response"
          );
        });

        return originalJson(body);
      };

      next();
    } catch (dbError) {
      // If database is unavailable, log and continue without idempotency protection
      if (
        dbError instanceof Error &&
        (dbError.message.includes("Can't reach database server") ||
          dbError.message.includes("Connection refused"))
      ) {
        logger.warn(
          { route, key: validatedKey },
          "Database not available - proceeding without idempotency protection"
        );
        next();
        return;
      }

      throw dbError;
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Cache the response for future idempotent requests
 */
async function cacheResponse(
  route: string,
  key: string,
  statusCode: number,
  responsePayload: any
): Promise<void> {
  try {
    await prisma.idempotency.create({
      data: {
        route,
        key,
        status_code: statusCode,
        payload: {},  // Deprecated, kept for schema compatibility
        response: responsePayload,
      },
    });

    logger.debug(
      { route, key, statusCode },
      "Idempotency response cached"
    );
  } catch (error) {
    // Ignore duplicate key errors (race condition - another request already cached it)
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      logger.debug({ route, key }, "Idempotency entry already exists (race condition)");
      return;
    }

    throw error;
  }
}

/**
 * Clean up old idempotency entries (older than 24 hours)
 * This should be called periodically by a cron job or background worker
 */
export async function cleanupOldIdempotencyEntries(): Promise<number> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const result = await prisma.idempotency.deleteMany({
    where: {
      created_at: {
        lt: twentyFourHoursAgo,
      },
    },
  });

  logger.info(
    { deletedCount: result.count, olderThan: twentyFourHoursAgo },
    "Cleaned up old idempotency entries"
  );

  return result.count;
}

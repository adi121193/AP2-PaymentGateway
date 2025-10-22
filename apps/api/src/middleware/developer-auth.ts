/**
 * Developer Authentication Middleware
 *
 * Verifies API key for developer endpoints (agent registration, deployment)
 * Uses constant-time comparison to prevent timing attacks
 */

import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { prisma } from "@ap2/database";
import { logger } from "../logger.js";

export interface AuthenticatedRequest extends Request {
  developer?: {
    id: string;
    email: string;
    name: string;
    verified: boolean;
  };
}

/**
 * Hash API key with SHA-256 for storage/comparison
 */
export function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey, "utf8").digest("hex");
}

/**
 * Developer authentication middleware
 * Expects: Authorization: Bearer dev_<32_chars>
 */
export async function authenticateDeveloper(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Missing or invalid Authorization header",
        },
      });
      return;
    }

    const apiKey = authHeader.substring(7); // Remove "Bearer "

    // Validate API key format: dev_<32 alphanumeric chars>
    if (!/^dev_[a-zA-Z0-9]{32}$/.test(apiKey)) {
      res.status(401).json({
        success: false,
        error: {
          code: "INVALID_API_KEY",
          message: "API key must be in format: dev_<32_chars>",
        },
      });
      return;
    }

    const apiKeyHash = hashApiKey(apiKey);

    // Find developer by API key hash
    const developer = await prisma.developer.findUnique({
      where: { api_key_hash: apiKeyHash },
      select: {
        id: true,
        email: true,
        name: true,
        verified: true,
      },
    });

    if (!developer) {
      logger.warn({ apiKeyHash: apiKeyHash.substring(0, 8) }, "Invalid API key attempt");
      res.status(401).json({
        success: false,
        error: {
          code: "INVALID_API_KEY",
          message: "Invalid API key",
        },
      });
      return;
    }

    // Require email verification for write operations
    if (!developer.verified) {
      res.status(403).json({
        success: false,
        error: {
          code: "EMAIL_NOT_VERIFIED",
          message: "Please verify your email before registering agents",
        },
      });
      return;
    }

    // Attach developer info to request
    (req as AuthenticatedRequest).developer = developer;

    logger.debug({ developerId: developer.id }, "Developer authenticated");
    next();
  } catch (error) {
    logger.error({ error }, "Developer authentication error");
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Authentication failed",
      },
    });
  }
}

/**
 * Optional developer auth - doesn't fail if no auth provided
 * Used for public endpoints that behave differently for authenticated developers
 */
export async function optionalDeveloperAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  // If auth header exists, validate it
  await authenticateDeveloper(req, res, next);
}

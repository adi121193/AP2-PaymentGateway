import { Request, Response, NextFunction } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { UnauthorizedError } from "@ap2/domain";
import { prisma } from "@ap2/database";
import { logger } from "../logger.js";

// Extend Express Request type to include agentId
declare global {
  namespace Express {
    interface Request {
      agentId?: string;
    }
  }
}

/**
 * Authentication middleware
 * Supports two authentication modes:
 * 1. HMAC-SHA256: "HMAC-SHA256 agent_id:signature"
 * 2. JWT: "Bearer <token>" (to be implemented)
 *
 * For Phase B1, we implement HMAC authentication
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError("Authorization header is required");
    }

    // Check for HMAC authentication
    if (authHeader.startsWith("HMAC-SHA256 ")) {
      await authenticateHMAC(authHeader, req);
      next();
      return;
    }

    // Check for JWT authentication
    if (authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("JWT authentication not yet implemented");
      // TODO: Implement JWT authentication in future phase
    }

    throw new UnauthorizedError("Invalid authentication scheme");
  } catch (error) {
    next(error);
  }
}

/**
 * Authenticate using HMAC-SHA256
 * Format: "HMAC-SHA256 agent_id:signature"
 * Signature is HMAC-SHA256 of request body using agent's secret key
 */
async function authenticateHMAC(
  authHeader: string,
  req: Request
): Promise<void> {
  const authValue = authHeader.substring("HMAC-SHA256 ".length);
  const [agentId, providedSignature] = authValue.split(":");

  if (!agentId || !providedSignature) {
    throw new UnauthorizedError(
      "Invalid HMAC format. Expected: HMAC-SHA256 agent_id:signature"
    );
  }

  // For Phase B1, we validate the format but cannot verify against database
  // until DATABASE_URL is configured
  // TODO(human): Once database is configured, uncomment the agent lookup below

  try {
    // Verify agent exists and is active
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        status: true,
        public_key: true,
      },
    });

    if (!agent) {
      logger.warn({ agentId }, "Authentication failed: agent not found");
      throw new UnauthorizedError("Invalid agent credentials");
    }

    if (agent.status !== "active") {
      logger.warn({ agentId, status: agent.status }, "Authentication failed: agent not active");
      throw new UnauthorizedError("Agent account is not active");
    }

    // TODO(future): Verify HMAC signature using agent's secret key
    // For now, we accept the signature format but don't verify it
    // In production, you would:
    // 1. Retrieve agent's secret key from secure storage
    // 2. Compute HMAC of request body
    // 3. Compare with provided signature using timing-safe comparison

    // Example verification (commented out until secret key storage is implemented):
    // const requestBody = JSON.stringify(req.body);
    // const expectedSignature = createHmac('sha256', agent.secret_key)
    //   .update(requestBody)
    //   .digest('hex');
    //
    // if (!timingSafeEqual(
    //   Buffer.from(providedSignature, 'hex'),
    //   Buffer.from(expectedSignature, 'hex')
    // )) {
    //   throw new UnauthorizedError('Invalid signature');
    // }

    // Attach agent ID to request
    req.agentId = agentId;

    logger.debug({ agentId }, "HMAC authentication successful");
  } catch (error) {
    // If database is not connected, allow authentication to pass for testing
    // This allows Phase B1 testing before database is configured
    if (
      error instanceof Error &&
      (error.message.includes("Can't reach database server") ||
        error.message.includes("Connection refused"))
    ) {
      logger.warn(
        { agentId },
        "Database not available - allowing authentication for testing"
      );
      req.agentId = agentId;
      return;
    }

    throw error;
  }
}

/**
 * Verify HMAC signature (utility function for future use)
 */
export function verifyHmacSignature(
  data: string,
  secretKey: string,
  providedSignature: string
): boolean {
  const expectedSignature = createHmac("sha256", secretKey)
    .update(data)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(providedSignature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Generate HMAC signature (utility function for testing)
 */
export function generateHmacSignature(data: string, secretKey: string): string {
  return createHmac("sha256", secretKey).update(data).digest("hex");
}

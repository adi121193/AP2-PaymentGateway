import { prisma } from "@ap2/database";
import { PolicyViolationError } from "@ap2/domain";
import { logger } from "../logger.js";

/**
 * Policy Gate Service
 *
 * Enforces policy rules before issuing mandates or executing payments.
 * All business logic for authorization is centralized here.
 */

export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
  policy?: any;
}

/**
 * Check if a purchase intent can have a mandate issued
 *
 * Validates:
 * - Agent exists and is active
 * - Active policy exists for agent
 * - Vendor is in policy allowlist
 * - Amount is within policy cap
 * - Policy has not expired
 */
export async function canIssueMandate(
  intentId: string,
  agentId: string
): Promise<PolicyCheckResult> {
  try {
    // Fetch purchase intent
    const intent = await prisma.purchaseIntent.findUnique({
      where: { id: intentId },
      include: { agent: true },
    });

    if (!intent) {
      return {
        allowed: false,
        reason: "Purchase intent not found",
      };
    }

    // Verify intent belongs to agent
    if (intent.agent_id !== agentId) {
      return {
        allowed: false,
        reason: "Purchase intent does not belong to this agent",
      };
    }

    // Check agent status
    if (intent.agent.status !== "active") {
      return {
        allowed: false,
        reason: `Agent is ${intent.agent.status}, not active`,
      };
    }

    // Find active policy for agent
    const policy = await prisma.policy.findFirst({
      where: {
        agent_id: agentId,
        expires_at: {
          gt: new Date(),
        },
      },
      orderBy: {
        version: "desc",
      },
    });

    if (!policy) {
      return {
        allowed: false,
        reason: "No active policy found for agent",
      };
    }

    // Check vendor allowlist
    const vendorAllowlist = policy.vendor_allowlist as string[];
    if (!vendorAllowlist.includes(intent.vendor)) {
      return {
        allowed: false,
        reason: `Vendor "${intent.vendor}" not in policy allowlist`,
      };
    }

    // Check amount cap
    if (intent.amount > policy.amount_cap) {
      return {
        allowed: false,
        reason: `Amount ${intent.amount} exceeds policy cap ${policy.amount_cap}`,
      };
    }

    // Check daily spending cap
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todaySpending = await prisma.payment.aggregate({
      where: {
        mandate: {
          policy_id: policy.id,
        },
        created_at: {
          gte: todayStart,
        },
        status: {
          in: ["SETTLED", "PENDING", "PROCESSING"],
        },
      },
      _sum: {
        amount: true,
      },
    });

    const spentToday = todaySpending._sum.amount || 0;
    const remainingDaily = policy.daily_cap - spentToday;

    if (intent.amount > remainingDaily) {
      return {
        allowed: false,
        reason: `Amount ${intent.amount} exceeds remaining daily cap ${remainingDaily} (spent today: ${spentToday})`,
      };
    }

    logger.info(
      {
        intentId,
        agentId,
        policyId: policy.id,
        vendor: intent.vendor,
        amount: intent.amount,
        dailyRemaining: remainingDaily,
      },
      "Policy check passed: mandate can be issued"
    );

    return {
      allowed: true,
      policy,
    };
  } catch (error) {
    logger.error(
      {
        error,
        intentId,
        agentId,
      },
      "Policy check failed with error"
    );

    // If database unavailable, fail closed (deny)
    return {
      allowed: false,
      reason: "Policy check failed due to system error",
    };
  }
}

/**
 * Validate a mandate before execution
 *
 * Checks:
 * - Mandate exists and is ACTIVE
 * - Mandate has not expired
 * - Mandate signature is valid (future: verify cryptographically)
 */
export async function validateMandate(mandateId: string): Promise<PolicyCheckResult> {
  try {
    const mandate = await prisma.mandate.findUnique({
      where: { id: mandateId },
      include: {
        intent: true,
        policy: true,
      },
    });

    if (!mandate) {
      return {
        allowed: false,
        reason: "Mandate not found",
      };
    }

    // Check mandate status
    if (mandate.status !== "ACTIVE") {
      return {
        allowed: false,
        reason: `Mandate is ${mandate.status}, not ACTIVE`,
      };
    }

    // Check expiry
    if (mandate.expires_at < new Date()) {
      return {
        allowed: false,
        reason: "Mandate has expired",
      };
    }

    // Check policy still valid
    if (mandate.policy.expires_at < new Date()) {
      return {
        allowed: false,
        reason: "Policy has expired",
      };
    }

    logger.info(
      {
        mandateId,
        intentId: mandate.intent_id,
        policyId: mandate.policy_id,
      },
      "Mandate validation passed"
    );

    return {
      allowed: true,
      policy: mandate.policy,
    };
  } catch (error) {
    logger.error(
      {
        error,
        mandateId,
      },
      "Mandate validation failed with error"
    );

    return {
      allowed: false,
      reason: "Mandate validation failed due to system error",
    };
  }
}

/**
 * Check if execution parameters are within policy bounds
 *
 * Used when executing a payment to ensure it matches the mandate/policy
 */
export async function validateExecution(
  mandateId: string,
  executionAmount?: number
): Promise<PolicyCheckResult> {
  try {
    // First validate the mandate itself
    const mandateCheck = await validateMandate(mandateId);
    if (!mandateCheck.allowed) {
      return mandateCheck;
    }

    const mandate = await prisma.mandate.findUnique({
      where: { id: mandateId },
      include: {
        intent: true,
        policy: true,
      },
    });

    if (!mandate) {
      return {
        allowed: false,
        reason: "Mandate not found",
      };
    }

    // If execution amount is provided, validate it matches intent
    if (executionAmount !== undefined) {
      if (executionAmount !== mandate.intent.amount) {
        return {
          allowed: false,
          reason: `Execution amount ${executionAmount} does not match mandate intent amount ${mandate.intent.amount}`,
        };
      }
    }

    // Check if intent has already been executed
    const existingPayment = await prisma.payment.findFirst({
      where: {
        mandate_id: mandateId,
      },
    });

    if (existingPayment) {
      return {
        allowed: false,
        reason: "Mandate has already been executed",
      };
    }

    logger.info(
      {
        mandateId,
        amount: executionAmount || mandate.intent.amount,
      },
      "Execution validation passed"
    );

    return {
      allowed: true,
      policy: mandate.policy,
    };
  } catch (error) {
    logger.error(
      {
        error,
        mandateId,
      },
      "Execution validation failed with error"
    );

    return {
      allowed: false,
      reason: "Execution validation failed due to system error",
    };
  }
}

/**
 * Helper: Throw PolicyViolationError if check fails
 */
export function enforcePolicy(result: PolicyCheckResult): void {
  if (!result.allowed) {
    throw new PolicyViolationError(result.reason || "Policy violation", {
      check: result,
    });
  }
}

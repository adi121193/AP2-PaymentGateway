/**
 * Unit Tests: Policy Gate Service
 *
 * Tests for policy enforcement and authorization logic.
 * MOST CRITICAL business logic - 100% coverage required.
 *
 * Coverage:
 * - canIssueMandate: policy validation for mandate issuance
 * - validateMandate: mandate expiry and status checks
 * - validateExecution: execution authorization
 * - enforcePolicy: exception throwing helper
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { PolicyViolationError } from "@ap2/domain";

// Mock the database module (must be before imports)
vi.mock("@ap2/database", () => ({
  prisma: {
    purchaseIntent: {
      findUnique: vi.fn(),
    },
    policy: {
      findFirst: vi.fn(),
    },
    mandate: {
      findUnique: vi.fn(),
    },
    payment: {
      aggregate: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

// Mock the logger
vi.mock("../../apps/api/src/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
import {
  canIssueMandate,
  validateMandate,
  validateExecution,
  enforcePolicy,
  type PolicyCheckResult,
} from "../../apps/api/src/services/policy-gate";
import { prisma } from "@ap2/database";

// Get mocked prisma for test assertions
const mockPrismaClient = prisma as any;

describe("Policy Gate Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("canIssueMandate", () => {
    const mockAgent = {
      id: "agt_test123",
      name: "Test Agent",
      status: "active",
      api_key_hash: "hash123",
      risk_tier: "LOW",
      created_at: new Date("2025-01-01T00:00:00.000Z"),
      updated_at: new Date("2025-01-01T00:00:00.000Z"),
    };

    const mockIntent = {
      id: "int_test123",
      agent_id: "agt_test123",
      sku: "api_enrichment",
      vendor: "acme_api",
      amount: 25000,
      currency: "INR",
      metadata: {},
      status: "PENDING",
      created_at: new Date("2025-01-15T10:00:00.000Z"),
      agent: mockAgent,
    };

    const mockPolicy = {
      id: "pol_test456",
      agent_id: "agt_test123",
      version: 1,
      vendor_allowlist: ["acme_api", "beta_vendor"],
      amount_cap: 50000,
      daily_cap: 200000,
      expires_at: new Date("2025-12-31T23:59:59.000Z"),
      created_at: new Date("2025-01-01T00:00:00.000Z"),
    };

    // POSITIVE CASES
    it("should allow mandate issuance when all checks pass", async () => {
      mockPrismaClient.purchaseIntent.findUnique.mockResolvedValue(mockIntent);
      mockPrismaClient.policy.findFirst.mockResolvedValue(mockPolicy);
      mockPrismaClient.payment.aggregate.mockResolvedValue({
        _sum: { amount: 0 },
      });

      const result = await canIssueMandate("int_test123", "agt_test123");

      expect(result.allowed).toBe(true);
      expect(result.policy).toEqual(mockPolicy);
      expect(result.reason).toBeUndefined();
    });

    it("should allow mandate when spending is below daily cap", async () => {
      mockPrismaClient.purchaseIntent.findUnique.mockResolvedValue(mockIntent);
      mockPrismaClient.policy.findFirst.mockResolvedValue(mockPolicy);
      // Already spent 100000 (100 INR), daily cap is 200000 (200 INR)
      mockPrismaClient.payment.aggregate.mockResolvedValue({
        _sum: { amount: 100000 },
      });

      const result = await canIssueMandate("int_test123", "agt_test123");

      expect(result.allowed).toBe(true);
      expect(result.policy).toEqual(mockPolicy);
    });

    it("should allow mandate for vendor in allowlist", async () => {
      const intentWithDifferentVendor = {
        ...mockIntent,
        vendor: "beta_vendor", // Second vendor in allowlist
      };

      mockPrismaClient.purchaseIntent.findUnique.mockResolvedValue(
        intentWithDifferentVendor
      );
      mockPrismaClient.policy.findFirst.mockResolvedValue(mockPolicy);
      mockPrismaClient.payment.aggregate.mockResolvedValue({
        _sum: { amount: 0 },
      });

      const result = await canIssueMandate("int_test123", "agt_test123");

      expect(result.allowed).toBe(true);
    });

    it("should allow mandate at exact amount cap", async () => {
      const intentAtCap = {
        ...mockIntent,
        amount: 50000, // Exactly at cap
      };

      mockPrismaClient.purchaseIntent.findUnique.mockResolvedValue(intentAtCap);
      mockPrismaClient.policy.findFirst.mockResolvedValue(mockPolicy);
      mockPrismaClient.payment.aggregate.mockResolvedValue({
        _sum: { amount: 0 },
      });

      const result = await canIssueMandate("int_test123", "agt_test123");

      expect(result.allowed).toBe(true);
    });

    // NEGATIVE CASES
    it("should deny if purchase intent not found", async () => {
      mockPrismaClient.purchaseIntent.findUnique.mockResolvedValue(null);

      const result = await canIssueMandate("int_invalid", "agt_test123");

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Purchase intent not found");
    });

    it("should deny if intent belongs to different agent", async () => {
      mockPrismaClient.purchaseIntent.findUnique.mockResolvedValue(mockIntent);

      const result = await canIssueMandate("int_test123", "agt_different");

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe(
        "Purchase intent does not belong to this agent"
      );
    });

    it("should deny if agent is suspended", async () => {
      const suspendedAgent = { ...mockAgent, status: "suspended" };
      const intentWithSuspendedAgent = {
        ...mockIntent,
        agent: suspendedAgent,
      };

      mockPrismaClient.purchaseIntent.findUnique.mockResolvedValue(
        intentWithSuspendedAgent
      );

      const result = await canIssueMandate("int_test123", "agt_test123");

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("suspended");
    });

    it("should deny if agent is inactive", async () => {
      const inactiveAgent = { ...mockAgent, status: "inactive" };
      const intentWithInactiveAgent = {
        ...mockIntent,
        agent: inactiveAgent,
      };

      mockPrismaClient.purchaseIntent.findUnique.mockResolvedValue(
        intentWithInactiveAgent
      );

      const result = await canIssueMandate("int_test123", "agt_test123");

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("inactive");
    });

    it("should deny if no active policy found", async () => {
      mockPrismaClient.purchaseIntent.findUnique.mockResolvedValue(mockIntent);
      mockPrismaClient.policy.findFirst.mockResolvedValue(null);

      const result = await canIssueMandate("int_test123", "agt_test123");

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("No active policy found for agent");
    });

    it("should deny if vendor not in allowlist", async () => {
      const intentWithDisallowedVendor = {
        ...mockIntent,
        vendor: "evil_corp", // Not in allowlist
      };

      mockPrismaClient.purchaseIntent.findUnique.mockResolvedValue(
        intentWithDisallowedVendor
      );
      mockPrismaClient.policy.findFirst.mockResolvedValue(mockPolicy);

      const result = await canIssueMandate("int_test123", "agt_test123");

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Vendor "evil_corp" not in policy allowlist');
    });

    it("should deny if amount exceeds policy cap", async () => {
      const intentAboveCap = {
        ...mockIntent,
        amount: 60000, // Above 50000 cap
      };

      mockPrismaClient.purchaseIntent.findUnique.mockResolvedValue(
        intentAboveCap
      );
      mockPrismaClient.policy.findFirst.mockResolvedValue(mockPolicy);

      const result = await canIssueMandate("int_test123", "agt_test123");

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("exceeds policy cap");
      expect(result.reason).toContain("60000");
      expect(result.reason).toContain("50000");
    });

    it("should deny if amount exceeds remaining daily cap", async () => {
      mockPrismaClient.purchaseIntent.findUnique.mockResolvedValue(mockIntent);
      mockPrismaClient.policy.findFirst.mockResolvedValue(mockPolicy);
      // Already spent 180000 (180 INR), only 20000 (20 INR) remaining
      // Intent wants 25000 (25 INR) - should be denied
      mockPrismaClient.payment.aggregate.mockResolvedValue({
        _sum: { amount: 180000 },
      });

      const result = await canIssueMandate("int_test123", "agt_test123");

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("exceeds remaining daily cap");
      expect(result.reason).toContain("20000");
    });

    it("should deny if daily cap already reached", async () => {
      mockPrismaClient.purchaseIntent.findUnique.mockResolvedValue(mockIntent);
      mockPrismaClient.policy.findFirst.mockResolvedValue(mockPolicy);
      // Already spent entire daily cap
      mockPrismaClient.payment.aggregate.mockResolvedValue({
        _sum: { amount: 200000 },
      });

      const result = await canIssueMandate("int_test123", "agt_test123");

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("exceeds remaining daily cap");
    });

    it("should handle null daily spending (no payments yet)", async () => {
      mockPrismaClient.purchaseIntent.findUnique.mockResolvedValue(mockIntent);
      mockPrismaClient.policy.findFirst.mockResolvedValue(mockPolicy);
      // No payments yet - _sum.amount is null
      mockPrismaClient.payment.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });

      const result = await canIssueMandate("int_test123", "agt_test123");

      expect(result.allowed).toBe(true);
    });

    // ERROR CASES
    it("should fail closed on database error", async () => {
      mockPrismaClient.purchaseIntent.findUnique.mockRejectedValue(
        new Error("Database connection failed")
      );

      const result = await canIssueMandate("int_test123", "agt_test123");

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Policy check failed due to system error");
    });

    it("should fail closed on unexpected error", async () => {
      mockPrismaClient.purchaseIntent.findUnique.mockImplementation(() => {
        throw new Error("Unexpected error");
      });

      const result = await canIssueMandate("int_test123", "agt_test123");

      expect(result.allowed).toBe(false);
    });
  });

  describe("validateMandate", () => {
    const mockPolicy = {
      id: "pol_test456",
      agent_id: "agt_test123",
      version: 1,
      vendor_allowlist: ["acme_api"],
      amount_cap: 50000,
      daily_cap: 200000,
      expires_at: new Date("2025-12-31T23:59:59.000Z"),
      created_at: new Date("2025-01-01T00:00:00.000Z"),
    };

    const mockIntent = {
      id: "int_test123",
      agent_id: "agt_test123",
      sku: "api_enrichment",
      vendor: "acme_api",
      amount: 25000,
      currency: "INR",
      metadata: {},
      status: "PENDING",
      created_at: new Date("2025-01-15T10:00:00.000Z"),
    };

    const mockMandate = {
      id: "mdt_test789",
      intent_id: "int_test123",
      policy_id: "pol_test456",
      signature: "sig123",
      public_key: "pub123",
      status: "ACTIVE",
      expires_at: new Date("2025-12-31T23:59:59.000Z"),
      created_at: new Date("2025-01-15T10:00:00.000Z"),
      intent: mockIntent,
      policy: mockPolicy,
    };

    // POSITIVE CASES
    it("should validate active mandate that has not expired", async () => {
      mockPrismaClient.mandate.findUnique.mockResolvedValue(mockMandate);

      const result = await validateMandate("mdt_test789");

      expect(result.allowed).toBe(true);
      expect(result.policy).toEqual(mockPolicy);
    });

    it("should validate mandate with future expiry", async () => {
      const mandateExpiresSoon = {
        ...mockMandate,
        expires_at: new Date(Date.now() + 60000), // Expires in 1 minute
      };

      mockPrismaClient.mandate.findUnique.mockResolvedValue(mandateExpiresSoon);

      const result = await validateMandate("mdt_test789");

      expect(result.allowed).toBe(true);
    });

    // NEGATIVE CASES
    it("should deny if mandate not found", async () => {
      mockPrismaClient.mandate.findUnique.mockResolvedValue(null);

      const result = await validateMandate("mdt_invalid");

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Mandate not found");
    });

    it("should deny if mandate is revoked", async () => {
      const revokedMandate = {
        ...mockMandate,
        status: "REVOKED",
      };

      mockPrismaClient.mandate.findUnique.mockResolvedValue(revokedMandate);

      const result = await validateMandate("mdt_test789");

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("REVOKED");
    });

    it("should deny if mandate is expired", async () => {
      const expiredMandate = {
        ...mockMandate,
        status: "EXPIRED",
      };

      mockPrismaClient.mandate.findUnique.mockResolvedValue(expiredMandate);

      const result = await validateMandate("mdt_test789");

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("EXPIRED");
    });

    it("should deny if mandate expiry time has passed", async () => {
      const pastExpiredMandate = {
        ...mockMandate,
        expires_at: new Date("2024-01-01T00:00:00.000Z"), // Past date
      };

      mockPrismaClient.mandate.findUnique.mockResolvedValue(pastExpiredMandate);

      const result = await validateMandate("mdt_test789");

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Mandate has expired");
    });

    it("should deny if policy has expired", async () => {
      const expiredPolicy = {
        ...mockPolicy,
        expires_at: new Date("2024-01-01T00:00:00.000Z"), // Past date
      };

      const mandateWithExpiredPolicy = {
        ...mockMandate,
        policy: expiredPolicy,
      };

      mockPrismaClient.mandate.findUnique.mockResolvedValue(
        mandateWithExpiredPolicy
      );

      const result = await validateMandate("mdt_test789");

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Policy has expired");
    });

    // ERROR CASES
    it("should fail closed on database error", async () => {
      mockPrismaClient.mandate.findUnique.mockRejectedValue(
        new Error("Database error")
      );

      const result = await validateMandate("mdt_test789");

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe(
        "Mandate validation failed due to system error"
      );
    });
  });

  describe("validateExecution", () => {
    const mockPolicy = {
      id: "pol_test456",
      agent_id: "agt_test123",
      version: 1,
      vendor_allowlist: ["acme_api"],
      amount_cap: 50000,
      daily_cap: 200000,
      expires_at: new Date("2025-12-31T23:59:59.000Z"),
      created_at: new Date("2025-01-01T00:00:00.000Z"),
    };

    const mockIntent = {
      id: "int_test123",
      agent_id: "agt_test123",
      sku: "api_enrichment",
      vendor: "acme_api",
      amount: 25000,
      currency: "INR",
      metadata: {},
      status: "PENDING",
      created_at: new Date("2025-01-15T10:00:00.000Z"),
    };

    const mockMandate = {
      id: "mdt_test789",
      intent_id: "int_test123",
      policy_id: "pol_test456",
      signature: "sig123",
      public_key: "pub123",
      status: "ACTIVE",
      expires_at: new Date("2025-12-31T23:59:59.000Z"),
      created_at: new Date("2025-01-15T10:00:00.000Z"),
      intent: mockIntent,
      policy: mockPolicy,
    };

    // POSITIVE CASES
    it("should allow execution when mandate is valid and not executed", async () => {
      mockPrismaClient.mandate.findUnique.mockResolvedValue(mockMandate);
      mockPrismaClient.payment.findFirst.mockResolvedValue(null);

      const result = await validateExecution("mdt_test789");

      expect(result.allowed).toBe(true);
      expect(result.policy).toEqual(mockPolicy);
    });

    it("should allow execution when amount matches intent", async () => {
      mockPrismaClient.mandate.findUnique.mockResolvedValue(mockMandate);
      mockPrismaClient.payment.findFirst.mockResolvedValue(null);

      const result = await validateExecution("mdt_test789", 25000);

      expect(result.allowed).toBe(true);
    });

    it("should allow execution without explicit amount", async () => {
      mockPrismaClient.mandate.findUnique.mockResolvedValue(mockMandate);
      mockPrismaClient.payment.findFirst.mockResolvedValue(null);

      const result = await validateExecution("mdt_test789");

      expect(result.allowed).toBe(true);
    });

    // NEGATIVE CASES
    it("should deny if mandate validation fails", async () => {
      // Expired mandate
      const expiredMandate = {
        ...mockMandate,
        expires_at: new Date("2024-01-01T00:00:00.000Z"),
      };

      mockPrismaClient.mandate.findUnique.mockResolvedValue(expiredMandate);

      const result = await validateExecution("mdt_test789");

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Mandate has expired");
    });

    it("should deny if execution amount does not match intent", async () => {
      mockPrismaClient.mandate.findUnique.mockResolvedValue(mockMandate);
      mockPrismaClient.payment.findFirst.mockResolvedValue(null);

      const result = await validateExecution("mdt_test789", 30000); // Different amount

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("does not match mandate intent amount");
      expect(result.reason).toContain("30000");
      expect(result.reason).toContain("25000");
    });

    it("should deny if mandate already executed", async () => {
      const existingPayment = {
        id: "pay_existing",
        mandate_id: "mdt_test789",
        amount: 25000,
        currency: "INR",
        status: "SETTLED",
        rail: "stripe_card",
        provider_ref: "pi_123",
        created_at: new Date("2025-01-15T10:00:00.000Z"),
      };

      mockPrismaClient.mandate.findUnique.mockResolvedValue(mockMandate);
      mockPrismaClient.payment.findFirst.mockResolvedValue(existingPayment);

      const result = await validateExecution("mdt_test789");

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Mandate has already been executed");
    });

    it("should deny if mandate not found", async () => {
      mockPrismaClient.mandate.findUnique.mockResolvedValue(null);

      const result = await validateExecution("mdt_invalid");

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("Mandate not found");
    });

    // ERROR CASES
    it("should fail closed on database error", async () => {
      mockPrismaClient.mandate.findUnique.mockRejectedValue(
        new Error("Database error")
      );

      const result = await validateExecution("mdt_test789");

      expect(result.allowed).toBe(false);
      // Note: validateExecution calls validateMandate first, which catches the error
      expect(result.reason).toBe(
        "Mandate validation failed due to system error"
      );
    });
  });

  describe("enforcePolicy", () => {
    // POSITIVE CASES
    it("should not throw when policy check passes", () => {
      const passedCheck: PolicyCheckResult = {
        allowed: true,
        policy: { id: "pol_123" },
      };

      expect(() => enforcePolicy(passedCheck)).not.toThrow();
    });

    // NEGATIVE CASES
    it("should throw PolicyViolationError when policy check fails", () => {
      const failedCheck: PolicyCheckResult = {
        allowed: false,
        reason: "Vendor not allowed",
      };

      expect(() => enforcePolicy(failedCheck)).toThrow(PolicyViolationError);
    });

    it("should throw with correct reason message", () => {
      const failedCheck: PolicyCheckResult = {
        allowed: false,
        reason: "Amount exceeds cap",
      };

      expect(() => enforcePolicy(failedCheck)).toThrow("Amount exceeds cap");
    });

    it("should throw with default message when no reason provided", () => {
      const failedCheck: PolicyCheckResult = {
        allowed: false,
      };

      expect(() => enforcePolicy(failedCheck)).toThrow("Policy violation");
    });

    it("should include check details in error", () => {
      const failedCheck: PolicyCheckResult = {
        allowed: false,
        reason: "Test failure",
      };

      try {
        enforcePolicy(failedCheck);
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(PolicyViolationError);
        if (error instanceof PolicyViolationError) {
          // ApiError uses 'details' property, not 'context'
          expect(error.details).toEqual({ check: failedCheck });
        }
      }
    });
  });

  describe("edge cases and integration scenarios", () => {
    it("should handle policy check with multiple simultaneous violations", async () => {
      const mockAgent = {
        id: "agt_test",
        status: "suspended", // Violation 1
        name: "Test",
        api_key_hash: "hash",
        risk_tier: "LOW",
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockIntent = {
        id: "int_test",
        agent_id: "agt_test",
        vendor: "evil_corp", // Violation 2: not in allowlist
        amount: 999999, // Violation 3: exceeds cap
        currency: "INR",
        sku: "test",
        metadata: {},
        status: "PENDING",
        created_at: new Date(),
        agent: mockAgent,
      };

      mockPrismaClient.purchaseIntent.findUnique.mockResolvedValue(mockIntent);

      const result = await canIssueMandate("int_test", "agt_test");

      expect(result.allowed).toBe(false);
      // Should fail on first check (agent status)
      expect(result.reason).toContain("suspended");
    });

    it("should correctly calculate daily cap at midnight boundary", async () => {
      const mockAgent = {
        id: "agt_test",
        status: "active",
        name: "Test",
        api_key_hash: "hash",
        risk_tier: "LOW",
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mockIntent = {
        id: "int_test",
        agent_id: "agt_test",
        vendor: "acme_api",
        amount: 25000,
        currency: "INR",
        sku: "test",
        metadata: {},
        status: "PENDING",
        created_at: new Date(),
        agent: mockAgent,
      };

      const mockPolicy = {
        id: "pol_test",
        agent_id: "agt_test",
        version: 1,
        vendor_allowlist: ["acme_api"],
        amount_cap: 50000,
        daily_cap: 100000,
        expires_at: new Date("2025-12-31T23:59:59.000Z"),
        created_at: new Date(),
      };

      mockPrismaClient.purchaseIntent.findUnique.mockResolvedValue(mockIntent);
      mockPrismaClient.policy.findFirst.mockResolvedValue(mockPolicy);
      mockPrismaClient.payment.aggregate.mockResolvedValue({
        _sum: { amount: 80000 }, // 80 INR already spent today
      });

      const result = await canIssueMandate("int_test", "agt_test");

      // 25000 + 80000 = 105000 > 100000 (daily cap)
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("exceeds remaining daily cap");
    });
  });
});

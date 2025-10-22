/**
 * Unit Tests: Mandate Signer Service
 *
 * Tests for Ed25519 cryptographic signing and verification of mandates.
 * Critical security component - 100% coverage target.
 *
 * Coverage:
 * - signMandate: Ed25519 signature generation
 * - verifyMandateSignature: signature verification
 * - getPublicKeyFromPrivateKey: key derivation
 * - hexToBytes / bytesToHex: utility functions
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  signMandate,
  verifyMandateSignature,
  getPublicKeyFromPrivateKey,
  type MandateData,
} from "../../apps/api/src/services/mandate-signer";

// Mock environment
vi.mock("@ap2/domain", () => ({
  getEnv: () => ({
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://test",
    MANDATE_SIGN_KEY:
      "a".repeat(64) + "b".repeat(64), // Valid 128-char hex (64 bytes)
    JWT_SECRET: "test-secret-key-12345678901234567890",
    ALLOWED_ORIGINS: "*",
  }),
}));

describe("Mandate Signer Service", () => {
  const validMandateData: MandateData = {
    intent_id: "int_test123",
    policy_id: "pol_test456",
    agent_id: "agt_test789",
    vendor: "test_vendor",
    amount: 25000,
    currency: "INR",
    expires_at: new Date("2025-12-31T23:59:59.000Z"),
  };

  describe("signMandate", () => {
    // POSITIVE CASES
    it("should generate valid Ed25519 signature", async () => {
      const result = await signMandate(validMandateData);

      expect(result).toHaveProperty("signature");
      expect(result).toHaveProperty("hash");
      expect(result).toHaveProperty("public_key");
    });

    it("should generate signature in hex format (128 chars)", async () => {
      const result = await signMandate(validMandateData);

      // Ed25519 signatures are 64 bytes = 128 hex characters
      expect(result.signature).toMatch(/^[a-f0-9]{128}$/);
    });

    it("should generate hash in sha256 format", async () => {
      const result = await signMandate(validMandateData);

      expect(result.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
    });

    it("should generate public key in hex format (64 chars)", async () => {
      const result = await signMandate(validMandateData);

      // Ed25519 public keys are 32 bytes = 64 hex characters
      expect(result.public_key).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should produce deterministic signature for same input", async () => {
      const result1 = await signMandate(validMandateData);
      const result2 = await signMandate(validMandateData);

      expect(result1.signature).toBe(result2.signature);
      expect(result1.hash).toBe(result2.hash);
      expect(result1.public_key).toBe(result2.public_key);
    });

    it("should produce different signatures for different inputs", async () => {
      const result1 = await signMandate(validMandateData);
      const result2 = await signMandate({
        ...validMandateData,
        intent_id: "int_different",
      });

      expect(result1.signature).not.toBe(result2.signature);
      expect(result1.hash).not.toBe(result2.hash);
      // Public key should be same (derived from same private key)
      expect(result1.public_key).toBe(result2.public_key);
    });

    it("should sign different mandate fields correctly", async () => {
      const baseResult = await signMandate(validMandateData);

      // Different intent_id
      const result1 = await signMandate({
        ...validMandateData,
        intent_id: "int_999",
      });
      expect(result1.signature).not.toBe(baseResult.signature);

      // Different policy_id
      const result2 = await signMandate({
        ...validMandateData,
        policy_id: "pol_999",
      });
      expect(result2.signature).not.toBe(baseResult.signature);

      // Different amount
      const result3 = await signMandate({
        ...validMandateData,
        amount: 50000,
      });
      expect(result3.signature).not.toBe(baseResult.signature);

      // Different expires_at
      const result4 = await signMandate({
        ...validMandateData,
        expires_at: new Date("2026-12-31T23:59:59.000Z"),
      });
      expect(result4.signature).not.toBe(baseResult.signature);
    });

    it("should handle mandate with minimal data", async () => {
      const minimalMandate: MandateData = {
        intent_id: "int_1",
        policy_id: "pol_1",
        agent_id: "agt_1",
        vendor: "v",
        amount: 1,
        currency: "INR",
        expires_at: new Date("2025-01-01T00:00:00.000Z"),
      };

      const result = await signMandate(minimalMandate);
      expect(result.signature).toMatch(/^[a-f0-9]{128}$/);
    });

    it("should handle mandate with large amount", async () => {
      const largeAmountMandate: MandateData = {
        ...validMandateData,
        amount: 999999999,
      };

      const result = await signMandate(largeAmountMandate);
      expect(result.signature).toMatch(/^[a-f0-9]{128}$/);
    });

    it("should handle different currencies", async () => {
      const usdMandate: MandateData = {
        ...validMandateData,
        currency: "USD",
      };

      const result = await signMandate(usdMandate);
      expect(result.signature).toMatch(/^[a-f0-9]{128}$/);
    });

    // NEGATIVE CASES
    // NOTE: Testing short key validation is difficult with Vitest module mocking
    // The validation happens at runtime in production via env.ts Zod schema
    // which will reject keys < 64 chars before signMandate is even called
  });

  describe("verifyMandateSignature", () => {
    let signedMandate: {
      signature: string;
      hash: string;
      public_key: string;
    };

    beforeEach(async () => {
      signedMandate = await signMandate(validMandateData);
    });

    // POSITIVE CASES
    it("should verify valid signature", () => {
      const isValid = verifyMandateSignature(
        validMandateData,
        signedMandate.signature,
        signedMandate.public_key
      );

      expect(isValid).toBe(true);
    });

    it("should verify signature for different mandate data correctly", async () => {
      const mandate2: MandateData = {
        ...validMandateData,
        intent_id: "int_different",
      };
      const signed2 = await signMandate(mandate2);

      const isValid = verifyMandateSignature(
        mandate2,
        signed2.signature,
        signed2.public_key
      );

      expect(isValid).toBe(true);
    });

    it("should verify signature with same public key for multiple mandates", async () => {
      const mandates = [
        { ...validMandateData, intent_id: "int_1" },
        { ...validMandateData, intent_id: "int_2" },
        { ...validMandateData, intent_id: "int_3" },
      ];

      for (const mandate of mandates) {
        const signed = await signMandate(mandate);
        const isValid = verifyMandateSignature(
          mandate,
          signed.signature,
          signed.public_key
        );
        expect(isValid).toBe(true);
      }
    });

    // NEGATIVE CASES
    it("should reject tampered signature", () => {
      // Change one character in signature
      const tamperedSignature =
        signedMandate.signature.substring(0, 64) +
        "f" +
        signedMandate.signature.substring(65);

      const isValid = verifyMandateSignature(
        validMandateData,
        tamperedSignature,
        signedMandate.public_key
      );

      expect(isValid).toBe(false);
    });

    it("should reject signature with wrong public key", () => {
      // Generate wrong public key (all zeros)
      const wrongPublicKey = "0".repeat(64);

      const isValid = verifyMandateSignature(
        validMandateData,
        signedMandate.signature,
        wrongPublicKey
      );

      expect(isValid).toBe(false);
    });

    it("should reject signature for tampered mandate data", () => {
      const tamperedMandate: MandateData = {
        ...validMandateData,
        amount: 99999, // Changed amount
      };

      const isValid = verifyMandateSignature(
        tamperedMandate,
        signedMandate.signature,
        signedMandate.public_key
      );

      expect(isValid).toBe(false);
    });

    it("should reject completely wrong signature", () => {
      const wrongSignature = "a".repeat(128);

      const isValid = verifyMandateSignature(
        validMandateData,
        wrongSignature,
        signedMandate.public_key
      );

      expect(isValid).toBe(false);
    });

    it("should reject signature from different mandate", async () => {
      const otherMandate: MandateData = {
        ...validMandateData,
        intent_id: "int_other",
      };
      const otherSigned = await signMandate(otherMandate);

      // Try to verify original mandate with other mandate's signature
      const isValid = verifyMandateSignature(
        validMandateData,
        otherSigned.signature,
        otherSigned.public_key
      );

      expect(isValid).toBe(false);
    });

    it("should return false on malformed signature (invalid hex)", () => {
      const malformedSignature = "ZZZZ" + "a".repeat(124);

      const isValid = verifyMandateSignature(
        validMandateData,
        malformedSignature,
        signedMandate.public_key
      );

      expect(isValid).toBe(false);
    });

    it("should return false on malformed public key (invalid hex)", () => {
      const malformedPublicKey = "ZZZZ" + "a".repeat(60);

      const isValid = verifyMandateSignature(
        validMandateData,
        signedMandate.signature,
        malformedPublicKey
      );

      expect(isValid).toBe(false);
    });
  });

  describe("getPublicKeyFromPrivateKey", () => {
    // POSITIVE CASES
    it("should extract public key from valid private key", () => {
      const privateKeyHex = "a".repeat(64);
      const publicKey = getPublicKeyFromPrivateKey(privateKeyHex);

      expect(publicKey).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should produce same public key for same private key", () => {
      const privateKeyHex = "a".repeat(64);
      const publicKey1 = getPublicKeyFromPrivateKey(privateKeyHex);
      const publicKey2 = getPublicKeyFromPrivateKey(privateKeyHex);

      expect(publicKey1).toBe(publicKey2);
    });

    it("should produce different public keys for different private keys", () => {
      const privateKey1 = "a".repeat(64);
      const privateKey2 = "b".repeat(64);

      const publicKey1 = getPublicKeyFromPrivateKey(privateKey1);
      const publicKey2 = getPublicKeyFromPrivateKey(privateKey2);

      expect(publicKey1).not.toBe(publicKey2);
    });

    it("should handle private key with extra characters (uses first 64)", () => {
      const privateKeyHex = "a".repeat(64) + "extra_chars";
      const publicKey = getPublicKeyFromPrivateKey(privateKeyHex);

      expect(publicKey).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should handle private key with 0x prefix", () => {
      const privateKeyHex = "0x" + "a".repeat(64);
      // Note: Current implementation doesn't handle 0x in getPublicKeyFromPrivateKey
      // It handles it in hexToBytes which is called internally
      const publicKey = getPublicKeyFromPrivateKey(privateKeyHex);

      expect(publicKey).toMatch(/^[a-f0-9]{64}$/);
    });

    // NEGATIVE CASES
    it("should throw on odd-length hex string", () => {
      const oddLengthHex = "a".repeat(63); // 63 chars (odd)

      expect(() => getPublicKeyFromPrivateKey(oddLengthHex)).toThrow(
        "even length"
      );
    });

    it("should throw on invalid hex characters", () => {
      const invalidHex = "ZZZZ" + "a".repeat(60);

      expect(() => getPublicKeyFromPrivateKey(invalidHex)).toThrow();
    });
  });

  describe("mandate hash generation", () => {
    it("should generate consistent hash for mandate before signing", async () => {
      const signed1 = await signMandate(validMandateData);
      const signed2 = await signMandate(validMandateData);

      expect(signed1.hash).toBe(signed2.hash);
    });

    it("should include all mandate fields in hash", async () => {
      const baseResult = await signMandate(validMandateData);

      // Change each field and verify hash changes
      const fields: (keyof MandateData)[] = [
        "intent_id",
        "policy_id",
        "agent_id",
        "vendor",
        "amount",
        "currency",
      ];

      for (const field of fields) {
        const modifiedMandate = { ...validMandateData };
        if (field === "amount") {
          modifiedMandate[field] = 99999;
        } else if (field !== "expires_at") {
          modifiedMandate[field] = `modified_${field}`;
        }

        const result = await signMandate(modifiedMandate);
        expect(result.hash).not.toBe(baseResult.hash);
      }
    });

    it("should change hash when expires_at changes", async () => {
      const result1 = await signMandate(validMandateData);
      const result2 = await signMandate({
        ...validMandateData,
        expires_at: new Date("2026-12-31T23:59:59.000Z"),
      });

      expect(result1.hash).not.toBe(result2.hash);
    });
  });

  describe("signature verification edge cases", () => {
    it("should handle verification with empty string signature gracefully", () => {
      const isValid = verifyMandateSignature(validMandateData, "", "a".repeat(64));

      expect(isValid).toBe(false);
    });

    it("should handle verification with empty string public key gracefully", () => {
      const isValid = verifyMandateSignature(validMandateData, "a".repeat(128), "");

      expect(isValid).toBe(false);
    });

    it("should handle verification with short signature", () => {
      const shortSignature = "a".repeat(64); // Half length

      const isValid = verifyMandateSignature(
        validMandateData,
        shortSignature,
        "b".repeat(64)
      );

      expect(isValid).toBe(false);
    });

    it("should handle verification with short public key", () => {
      const shortPublicKey = "a".repeat(32); // Half length

      const isValid = verifyMandateSignature(
        validMandateData,
        "b".repeat(128),
        shortPublicKey
      );

      expect(isValid).toBe(false);
    });
  });

  describe("end-to-end signing workflow", () => {
    it("should complete full sign and verify workflow", async () => {
      // 1. Sign mandate
      const signed = await signMandate(validMandateData);

      // 2. Verify it can be verified with returned public key
      const isValid = verifyMandateSignature(
        validMandateData,
        signed.signature,
        signed.public_key
      );

      expect(isValid).toBe(true);
    });

    it("should handle multiple sequential sign operations", async () => {
      const mandates = Array.from({ length: 5 }, (_, i) => ({
        ...validMandateData,
        intent_id: `int_${i}`,
      }));

      for (const mandate of mandates) {
        const signed = await signMandate(mandate);
        const isValid = verifyMandateSignature(
          mandate,
          signed.signature,
          signed.public_key
        );
        expect(isValid).toBe(true);
      }
    });

    it("should detect tampering in end-to-end workflow", async () => {
      // Sign original mandate
      const signed = await signMandate(validMandateData);

      // Attempt to verify with tampered data
      const tamperedMandate = { ...validMandateData, amount: 999999 };
      const isValid = verifyMandateSignature(
        tamperedMandate,
        signed.signature,
        signed.public_key
      );

      expect(isValid).toBe(false);
    });
  });
});

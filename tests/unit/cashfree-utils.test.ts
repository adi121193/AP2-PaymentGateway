/**
 * Unit Tests: Cashfree Utils
 *
 * Tests for amount conversion and data masking utilities used by CashfreeAdapter
 *
 * Coverage:
 * - convertMinorToMajor: paise → rupees conversion
 * - convertMajorToMinor: rupees → paise conversion
 * - isValidOrderId: order ID format validation
 * - isValidIndianPhone: phone number validation
 * - maskPhone: phone number masking for logs
 * - maskCredential: credential masking for logs
 */

import { describe, it, expect } from "vitest";
import {
  convertMinorToMajor,
  convertMajorToMinor,
  isValidOrderId,
  isValidIndianPhone,
  maskPhone,
  maskCredential,
} from "../../packages/rails/src/cashfree/utils";

describe("Cashfree Utils", () => {
  describe("convertMinorToMajor", () => {
    // POSITIVE CASES
    it("should convert 25000 paise to 250.00 rupees", () => {
      const result = convertMinorToMajor(25000);
      expect(result).toBe(250.0);
    });

    it("should convert 1 paise to 0.01 rupees", () => {
      const result = convertMinorToMajor(1);
      expect(result).toBe(0.01);
    });

    it("should convert 199 paise to 1.99 rupees", () => {
      const result = convertMinorToMajor(199);
      expect(result).toBe(1.99);
    });

    it("should handle 0 correctly", () => {
      const result = convertMinorToMajor(0);
      expect(result).toBe(0.0);
    });

    it("should always return exactly 2 decimal places", () => {
      const result = convertMinorToMajor(12345);
      expect(result).toBe(123.45);
      expect(result.toFixed(2)).toBe("123.45");
    });

    it("should handle large amounts within safe integer range", () => {
      const result = convertMinorToMajor(1000000000); // 10 million rupees
      expect(result).toBe(10000000.0);
    });

    // NEGATIVE CASES
    it("should throw on negative amounts", () => {
      expect(() => convertMinorToMajor(-100)).toThrow("cannot be negative");
    });

    it("should throw on non-finite numbers (Infinity)", () => {
      expect(() => convertMinorToMajor(Infinity)).toThrow("not a finite number");
    });

    it("should throw on non-finite numbers (NaN)", () => {
      expect(() => convertMinorToMajor(NaN)).toThrow("not a finite number");
    });

    it("should throw on amounts exceeding safe integer range", () => {
      expect(() => convertMinorToMajor(Number.MAX_SAFE_INTEGER + 1)).toThrow(
        "exceeds JavaScript safe integer range"
      );
    });

    it("should throw on decimal amounts (paise must be integers)", () => {
      expect(() => convertMinorToMajor(250.5)).toThrow("safe integer");
    });
  });

  describe("convertMajorToMinor", () => {
    // POSITIVE CASES
    it("should convert 250.00 rupees to 25000 paise", () => {
      const result = convertMajorToMinor(250.0);
      expect(result).toBe(25000);
    });

    it("should convert 1.99 rupees to 199 paise", () => {
      const result = convertMajorToMinor(1.99);
      expect(result).toBe(199);
    });

    it("should convert 0.01 rupees to 1 paise", () => {
      const result = convertMajorToMinor(0.01);
      expect(result).toBe(1);
    });

    it("should handle 0 correctly", () => {
      const result = convertMajorToMinor(0);
      expect(result).toBe(0);
    });

    it("should round fractional paise correctly (banker's rounding)", () => {
      const result1 = convertMajorToMinor(1.995); // Should round to 200
      expect(result1).toBe(200);

      const result2 = convertMajorToMinor(1.994); // Should round to 199
      expect(result2).toBe(199);
    });

    it("should handle large amounts", () => {
      const result = convertMajorToMinor(10000000.0); // 10 million rupees
      expect(result).toBe(1000000000);
    });

    // NEGATIVE CASES
    it("should throw on negative amounts", () => {
      expect(() => convertMajorToMinor(-250.0)).toThrow("cannot be negative");
    });

    it("should throw on non-finite numbers (Infinity)", () => {
      expect(() => convertMajorToMinor(Infinity)).toThrow("not a finite number");
    });

    it("should throw on non-finite numbers (NaN)", () => {
      expect(() => convertMajorToMinor(NaN)).toThrow("not a finite number");
    });

    it("should throw on amounts that would exceed safe integer range after conversion", () => {
      const tooLarge = Number.MAX_SAFE_INTEGER / 100 + 1;
      expect(() => convertMajorToMinor(tooLarge)).toThrow(
        "exceeds JavaScript safe integer range"
      );
    });
  });

  describe("isValidOrderId", () => {
    // POSITIVE CASES
    it("should allow valid alphanumeric order ID", () => {
      expect(isValidOrderId("order123")).toBe(true);
    });

    it("should allow order ID with hyphens", () => {
      expect(isValidOrderId("order-123-abc")).toBe(true);
    });

    it("should allow order ID with underscores", () => {
      expect(isValidOrderId("order_123_abc")).toBe(true);
    });

    it("should allow order ID with mixed characters", () => {
      expect(isValidOrderId("Order_123-ABC")).toBe(true);
    });

    it("should allow minimum length order ID (3 chars)", () => {
      expect(isValidOrderId("abc")).toBe(true);
    });

    it("should allow maximum length order ID (50 chars)", () => {
      const longId = "a".repeat(50);
      expect(isValidOrderId(longId)).toBe(true);
    });

    // NEGATIVE CASES
    it("should reject order ID shorter than 3 characters", () => {
      expect(isValidOrderId("ab")).toBe(false);
    });

    it("should reject order ID longer than 50 characters", () => {
      const tooLong = "a".repeat(51);
      expect(isValidOrderId(tooLong)).toBe(false);
    });

    it("should reject order ID starting with hyphen", () => {
      expect(isValidOrderId("-order123")).toBe(false);
    });

    it("should reject order ID starting with underscore", () => {
      expect(isValidOrderId("_order123")).toBe(false);
    });

    it("should reject order ID with special characters", () => {
      expect(isValidOrderId("order@123")).toBe(false);
      expect(isValidOrderId("order#123")).toBe(false);
      expect(isValidOrderId("order.123")).toBe(false);
    });

    it("should reject non-string input", () => {
      expect(isValidOrderId(123 as any)).toBe(false);
      expect(isValidOrderId(null as any)).toBe(false);
      expect(isValidOrderId(undefined as any)).toBe(false);
    });
  });

  describe("isValidIndianPhone", () => {
    // POSITIVE CASES
    it("should allow valid 10-digit phone starting with 9", () => {
      expect(isValidIndianPhone("9876543210")).toBe(true);
    });

    it("should allow valid 10-digit phone starting with 8", () => {
      expect(isValidIndianPhone("8765432109")).toBe(true);
    });

    it("should allow valid 10-digit phone starting with 7", () => {
      expect(isValidIndianPhone("7654321098")).toBe(true);
    });

    it("should allow valid 10-digit phone starting with 6", () => {
      expect(isValidIndianPhone("6543210987")).toBe(true);
    });

    // NEGATIVE CASES
    it("should reject phone starting with 5", () => {
      expect(isValidIndianPhone("5432109876")).toBe(false);
    });

    it("should reject phone shorter than 10 digits", () => {
      expect(isValidIndianPhone("987654321")).toBe(false);
    });

    it("should reject phone longer than 10 digits", () => {
      expect(isValidIndianPhone("98765432101")).toBe(false);
    });

    it("should reject phone with non-numeric characters", () => {
      expect(isValidIndianPhone("9876-543210")).toBe(false);
      expect(isValidIndianPhone("9876 543210")).toBe(false);
      expect(isValidIndianPhone("+919876543210")).toBe(false);
    });

    it("should reject non-string input", () => {
      expect(isValidIndianPhone(9876543210 as any)).toBe(false);
      expect(isValidIndianPhone(null as any)).toBe(false);
    });
  });

  describe("maskPhone", () => {
    // POSITIVE CASES
    it("should mask 10-digit phone number showing first 4 digits", () => {
      const result = maskPhone("9876543210");
      expect(result).toBe("9876XXXXXX");
    });

    it("should mask phone showing only first 4 digits", () => {
      const result = maskPhone("8765432109");
      expect(result).toBe("8765XXXXXX");
    });

    it("should handle phone numbers of varying length", () => {
      const result = maskPhone("987654");
      expect(result).toBe("9876XX");
    });

    // NEGATIVE CASES
    it("should return XXXX for phone shorter than 4 digits", () => {
      expect(maskPhone("987")).toBe("XXXX");
    });

    it("should return XXXX for empty string", () => {
      expect(maskPhone("")).toBe("XXXX");
    });

    it("should return XXXX for non-string input", () => {
      expect(maskPhone(null as any)).toBe("XXXX");
      expect(maskPhone(undefined as any)).toBe("XXXX");
      expect(maskPhone(123 as any)).toBe("XXXX");
    });
  });

  describe("maskCredential", () => {
    // POSITIVE CASES
    it("should mask TEST credential showing first 8 characters", () => {
      const credential = "TEST430329ae80e0f32e41a393d78b923034";
      const result = maskCredential(credential);
      expect(result).toBe("TEST4303...XXXX");
    });

    it("should mask PROD credential showing first 8 characters", () => {
      const credential = "PRODaf195616268bd6202eeb3bf8dc458956e7192a85";
      const result = maskCredential(credential);
      expect(result).toBe("PRODaf19...XXXX");
    });

    it("should use custom visible character count", () => {
      const credential = "TEST430329ae80e0f32e41a393d78b923034";
      const result = maskCredential(credential, 12);
      expect(result).toBe("TEST430329ae...XXXX");
    });

    it("should handle exactly visible chars length credential", () => {
      const credential = "TEST4303";
      const result = maskCredential(credential, 8);
      expect(result).toBe("XXXX");
    });

    // NEGATIVE CASES
    it("should return XXXX for credential shorter than visible chars", () => {
      const credential = "TEST";
      const result = maskCredential(credential, 8);
      expect(result).toBe("XXXX");
    });

    it("should return XXXX for empty string", () => {
      expect(maskCredential("")).toBe("XXXX");
    });

    it("should return XXXX for non-string input", () => {
      expect(maskCredential(null as any)).toBe("XXXX");
      expect(maskCredential(undefined as any)).toBe("XXXX");
      expect(maskCredential(12345678 as any)).toBe("XXXX");
    });
  });

  describe("round-trip conversion (major ↔ minor)", () => {
    it("should maintain precision for common amounts", () => {
      const amounts = [0, 1, 99, 100, 199, 250, 1000, 9999, 10000];
      amounts.forEach((minor) => {
        const major = convertMinorToMajor(minor);
        const backToMinor = convertMajorToMinor(major);
        expect(backToMinor).toBe(minor);
      });
    });

    it("should handle large amounts in round-trip conversion", () => {
      const minorAmount = 1000000000; // 10 million rupees
      const majorAmount = convertMinorToMajor(minorAmount);
      const backToMinor = convertMajorToMinor(majorAmount);
      expect(backToMinor).toBe(minorAmount);
    });
  });
});

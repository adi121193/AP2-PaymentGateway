/**
 * Amount conversion utilities for Cashfree Payment Gateway
 *
 * Cashfree API expects amounts in major units (e.g., INR 250.00)
 * Our system works with minor units (e.g., 25000 paise)
 *
 * Conversion rules:
 * - 1 INR = 100 paise
 * - Always use exactly 2 decimal places for major units
 * - Validate inputs to prevent overflow and precision errors
 */

/**
 * Convert amount from minor units (paise) to major units (rupees)
 *
 * @param amountMinor - Amount in minor units (e.g., 25000 paise)
 * @returns Amount in major units with 2 decimal places (e.g., 250.00)
 * @throws Error if amount is invalid or exceeds safe integer range
 *
 * @example
 * convertMinorToMajor(25000) // Returns 250.00
 * convertMinorToMajor(199)   // Returns 1.99
 * convertMinorToMajor(1)     // Returns 0.01
 */
export function convertMinorToMajor(amountMinor: number): number {
  // Validate input is a finite number
  if (!Number.isFinite(amountMinor)) {
    throw new Error(`Invalid amount: ${amountMinor} is not a finite number`);
  }

  // Validate input is within safe integer range
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error(
      `Amount ${amountMinor} exceeds JavaScript safe integer range (${Number.MAX_SAFE_INTEGER})`
    );
  }

  // Validate input is non-negative
  if (amountMinor < 0) {
    throw new Error(`Amount ${amountMinor} cannot be negative`);
  }

  // Convert to major units (divide by 100)
  const amountMajor = amountMinor / 100;

  // Return with exactly 2 decimal places
  return Number(amountMajor.toFixed(2));
}

/**
 * Convert amount from major units (rupees) to minor units (paise)
 *
 * @param amountMajor - Amount in major units (e.g., 250.00)
 * @returns Amount in minor units (e.g., 25000 paise)
 * @throws Error if amount is invalid or conversion results in non-integer
 *
 * @example
 * convertMajorToMinor(250.00) // Returns 25000
 * convertMajorToMinor(1.99)   // Returns 199
 * convertMajorToMinor(0.01)   // Returns 1
 */
export function convertMajorToMinor(amountMajor: number): number {
  // Validate input is a finite number
  if (!Number.isFinite(amountMajor)) {
    throw new Error(`Invalid amount: ${amountMajor} is not a finite number`);
  }

  // Validate input is non-negative
  if (amountMajor < 0) {
    throw new Error(`Amount ${amountMajor} cannot be negative`);
  }

  // Convert to minor units (multiply by 100)
  const amountMinor = Math.round(amountMajor * 100);

  // Validate result is within safe integer range
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error(
      `Converted amount ${amountMinor} exceeds JavaScript safe integer range (${Number.MAX_SAFE_INTEGER})`
    );
  }

  return amountMinor;
}

/**
 * Validate a Cashfree order ID format
 *
 * @param orderId - Order ID to validate
 * @returns true if valid, false otherwise
 *
 * Order ID requirements:
 * - Alphanumeric characters, hyphens, underscores only
 * - 3-50 characters in length
 * - Must start with alphanumeric character
 */
export function isValidOrderId(orderId: string): boolean {
  if (typeof orderId !== "string") {
    return false;
  }

  // Check length
  if (orderId.length < 3 || orderId.length > 50) {
    return false;
  }

  // Check format: alphanumeric, hyphens, underscores; must start with alphanumeric
  const pattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
  return pattern.test(orderId);
}

/**
 * Validate a phone number for Cashfree (Indian format)
 *
 * @param phone - Phone number to validate
 * @returns true if valid, false otherwise
 *
 * Requirements:
 * - Must be exactly 10 digits
 * - Must start with 6-9
 */
export function isValidIndianPhone(phone: string): boolean {
  if (typeof phone !== "string") {
    return false;
  }

  // Check format: exactly 10 digits, starting with 6-9
  const pattern = /^[6-9]\d{9}$/;
  return pattern.test(phone);
}

/**
 * Mask sensitive phone number for logging
 *
 * @param phone - Phone number to mask
 * @returns Masked phone number (e.g., "9876XXXXXX")
 */
export function maskPhone(phone: string): string {
  if (typeof phone !== "string" || phone.length < 4) {
    return "XXXX";
  }

  const visibleDigits = phone.slice(0, 4);
  const maskedDigits = "X".repeat(phone.length - 4);
  return visibleDigits + maskedDigits;
}

/**
 * Mask sensitive credential for logging
 *
 * @param credential - Credential to mask
 * @param visibleChars - Number of characters to show (default: 8)
 * @returns Masked credential (e.g., "TEST4303...XXXX")
 */
export function maskCredential(credential: string, visibleChars = 8): string {
  if (typeof credential !== "string" || credential.length <= visibleChars) {
    return "XXXX";
  }

  const visible = credential.slice(0, visibleChars);
  return `${visible}...XXXX`;
}

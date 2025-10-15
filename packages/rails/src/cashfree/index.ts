/**
 * Cashfree Payment Gateway Module
 *
 * Exports:
 * - CashfreeAdapter: RailAdapter implementation
 * - Type definitions for Cashfree API
 * - Utility functions for amount conversion and validation
 */

export { CashfreeAdapter } from "./adapter";
export type {
  CashfreeCustomer,
  CashfreeOrderRequest,
  CashfreeOrderResponse,
  CashfreePaymentMethod,
  CashfreeCardPayment,
  CashfreeUPIPayment,
  CashfreeNetbankingPayment,
  CashfreeAppPayment,
  CashfreePaymentRequest,
  CashfreePaymentResponse,
  CashfreeWebhookPayload,
  CashfreeErrorResponse,
} from "./types";
export {
  convertMinorToMajor,
  convertMajorToMinor,
  isValidOrderId,
  isValidIndianPhone,
  maskPhone,
  maskCredential,
} from "./utils";

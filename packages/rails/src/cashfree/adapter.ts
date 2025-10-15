/**
 * Cashfree Payment Gateway Adapter
 *
 * Implements the RailAdapter interface for Cashfree PG API v2025-01-01
 *
 * Key features:
 * - 2-step payment flow: Create Order → Execute Payment
 * - UPI as primary payment method for Indian market
 * - Retry logic with exponential backoff for transient failures
 * - HMAC-SHA256 webhook signature verification
 * - Comprehensive error handling and logging
 * - Amount conversion: minor units (paise) ↔ major units (rupees)
 *
 * Security:
 * - All credentials stored in environment variables
 * - Sensitive data redacted in logs
 * - Constant-time signature comparison
 * - Input validation on all external data
 */

import { createHmac } from "crypto";
import { getEnv } from "@ap2/domain";
import type { RailAdapter, PaymentRequest, PaymentResult } from "../interface";
import type {
  CashfreeOrderRequest,
  CashfreeOrderResponse,
  CashfreePaymentRequest,
  CashfreePaymentResponse,
  CashfreeErrorResponse,
  CashfreeCustomer,
} from "./types";
import { convertMinorToMajor, maskCredential, maskPhone } from "./utils";

/**
 * Result type for internal API calls
 */
type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Configuration for retry logic
 */
interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

/**
 * Timeout configuration (milliseconds)
 */
interface TimeoutConfig {
  orderCreation: number;
  payment: number;
}

/**
 * Cashfree Payment Gateway Adapter
 *
 * Implements rail-agnostic payment execution for Indian market
 */
export class CashfreeAdapter implements RailAdapter {
  public readonly name = "cashfree" as const;

  // API Configuration
  private readonly baseUrl: string;
  private readonly appId: string;
  private readonly secretKey: string;
  private readonly apiVersion = "2025-01-01";

  // Timeouts (in milliseconds)
  private readonly timeout: TimeoutConfig = {
    orderCreation: 5000, // 5 seconds for order creation
    payment: 10000, // 10 seconds for payment execution
  };

  // Retry configuration
  private readonly retryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 500,
    maxDelayMs: 5000,
  };

  constructor() {
    const env = getEnv();

    // Load Cashfree credentials from environment
    this.appId = env.CASHFREE_APP_ID;
    this.secretKey = env.CASHFREE_SECRET_KEY;

    // Determine base URL from app ID prefix (TEST vs PROD)
    if (this.appId.startsWith("TEST")) {
      this.baseUrl = "https://sandbox.cashfree.com/pg";
    } else if (this.appId.startsWith("PROD")) {
      this.baseUrl = "https://api.cashfree.com/pg";
    } else {
      throw new Error(
        "Invalid CASHFREE_APP_ID: must start with TEST or PROD"
      );
    }

    // Log initialization (with redacted credentials)
    console.log(
      JSON.stringify({
        level: "info",
        msg: "CashfreeAdapter initialized",
        environment: this.appId.startsWith("TEST") ? "sandbox" : "production",
        appId: maskCredential(this.appId),
        apiVersion: this.apiVersion,
      })
    );
  }

  /**
   * Execute a payment using Cashfree PG
   *
   * Flow:
   * 1. Validate customer details from metadata
   * 2. Convert amount from minor to major units
   * 3. Create Cashfree order
   * 4. Execute payment (UPI link flow)
   * 5. Map response to standardized PaymentResult
   *
   * @param request - Payment request with mandate, amount, customer details
   * @returns PaymentResult with success/failure and provider reference
   */
  async executePayment(request: PaymentRequest): Promise<PaymentResult> {
    const startTime = Date.now();

    try {
      // Step 1: Extract and validate customer details
      const customer = this.extractCustomerDetails(request);
      if (!customer.success) {
        return {
          success: false,
          status: "failed",
          error: customer.error,
        };
      }

      // Step 2: Convert amount from minor units (paise) to major units (rupees)
      let amountMajor: number;
      try {
        amountMajor = convertMinorToMajor(request.amount);
      } catch (error) {
        return {
          success: false,
          status: "failed",
          error: `Amount conversion failed: ${error instanceof Error ? error.message : String(error)}`,
        };
      }

      // Step 3: Generate unique order ID
      const orderId = this.generateOrderId(request.mandate_id);

      // Step 4: Create Cashfree order
      const orderResult = await this.createOrder({
        orderId,
        amount: amountMajor,
        currency: request.currency,
        customer: customer.data,
      });

      if (!orderResult.success) {
        return {
          success: false,
          status: "failed",
          error: `Order creation failed: ${orderResult.error}`,
        };
      }

      const order = orderResult.data;

      // Step 5: Extract payment method from metadata
      const paymentMethod = this.extractPaymentMethod(request);

      // Step 6: Execute payment
      const paymentResult = await this.executePaymentStep({
        paymentSessionId: order.payment_session_id,
        paymentMethod,
      });

      if (!paymentResult.success) {
        return {
          success: false,
          status: "failed",
          error: `Payment execution failed: ${paymentResult.error}`,
          provider_ref: order.order_id,
        };
      }

      // Step 7: Map Cashfree response to PaymentResult
      const result = this.mapPaymentResponse(paymentResult.data, order.order_id);

      // Step 8: Log metrics
      const duration = Date.now() - startTime;
      console.log(
        JSON.stringify({
          level: "info",
          msg: "Payment executed",
          mandate_id: request.mandate_id,
          order_id: order.order_id,
          cf_payment_id: paymentResult.data.cf_payment_id,
          status: paymentResult.data.payment_status,
          amount_minor: request.amount,
          amount_major: amountMajor,
          currency: request.currency,
          duration_ms: duration,
          customer_phone: maskPhone(customer.data.customer_phone),
        })
      );

      return result;
    } catch (error) {
      // Catch-all for unexpected errors
      const duration = Date.now() - startTime;
      console.error(
        JSON.stringify({
          level: "error",
          msg: "Unexpected error in executePayment",
          mandate_id: request.mandate_id,
          error: error instanceof Error ? error.message : String(error),
          duration_ms: duration,
        })
      );

      return {
        success: false,
        status: "failed",
        error: "Internal error during payment execution",
      };
    }
  }

  /**
   * Verify Cashfree webhook signature
   *
   * Cashfree uses HMAC-SHA256 for webhook signatures
   * Format: "t=<timestamp>,v1=<signature>"
   *
   * Algorithm:
   * 1. Extract timestamp and signature from header
   * 2. Reconstruct signed payload: timestamp + raw JSON body
   * 3. Compute HMAC-SHA256 using secret key
   * 4. Compare signatures using constant-time comparison
   *
   * @param payload - Webhook payload (raw JSON string or object)
   * @param signature - Signature header value
   * @returns true if signature is valid, false otherwise
   */
  verifyWebhook(payload: unknown, signature: string): boolean {
    try {
      // Parse signature header: "t=1234567890,v1=abcdef..."
      const parts = signature.split(",");
      const timestampPart = parts.find((p) => p.startsWith("t="));
      const signaturePart = parts.find((p) => p.startsWith("v1="));

      if (!timestampPart || !signaturePart) {
        console.warn(
          JSON.stringify({
            level: "warn",
            msg: "Invalid webhook signature format",
            signature: signature.substring(0, 20) + "...",
          })
        );
        return false;
      }

      const timestamp = timestampPart.split("=")[1];
      const expectedSignature = signaturePart.split("=")[1];

      if (!timestamp || !expectedSignature) {
        return false;
      }

      // Convert payload to raw string
      const rawPayload =
        typeof payload === "string" ? payload : JSON.stringify(payload);

      // Reconstruct signed payload (timestamp + raw JSON)
      const signedPayload = timestamp + rawPayload;

      // Compute HMAC-SHA256 signature
      const computedSignature = createHmac("sha256", this.secretKey)
        .update(signedPayload)
        .digest("hex");

      // Constant-time comparison
      const isValid = this.secureCompare(computedSignature, expectedSignature);

      if (!isValid) {
        console.warn(
          JSON.stringify({
            level: "warn",
            msg: "Webhook signature verification failed",
            expected: expectedSignature.substring(0, 16) + "...",
            computed: computedSignature.substring(0, 16) + "...",
          })
        );
      }

      return isValid;
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          msg: "Error verifying webhook signature",
          error: error instanceof Error ? error.message : String(error),
        })
      );
      return false;
    }
  }

  /**
   * Generate a unique order ID for Cashfree
   *
   * Format: cf_<mandate_id>_<timestamp>
   * Length: Limited to 50 characters (Cashfree requirement)
   *
   * @param mandateId - Mandate ID from request
   * @returns Unique order ID
   */
  private generateOrderId(mandateId: string): string {
    const timestamp = Date.now();
    const orderId = `cf_${mandateId}_${timestamp}`;

    // Ensure order ID doesn't exceed Cashfree's 50-character limit
    if (orderId.length > 50) {
      // Truncate mandate ID if necessary
      const maxMandateLength = 50 - 14 - 3; // 14 for timestamp, 3 for "cf_" and "_"
      const truncatedMandateId = mandateId.substring(0, maxMandateLength);
      return `cf_${truncatedMandateId}_${timestamp}`;
    }

    return orderId;
  }

  /**
   * Extract customer details from payment request metadata
   *
   * Required fields:
   * - customer_phone: Indian mobile number (10 digits)
   * - customer_id: Unique identifier (defaults to agent_id)
   *
   * Optional fields:
   * - customer_email
   * - customer_name
   *
   * @param request - Payment request
   * @returns Validated customer details or error
   */
  private extractCustomerDetails(
    request: PaymentRequest
  ): ApiResult<CashfreeCustomer> {
    const metadata = request.metadata || {};

    // Extract phone number (required)
    const customerPhone =
      (metadata.customer_phone as string) ||
      (metadata.phone as string);

    if (!customerPhone) {
      return {
        success: false,
        error: "Missing required field: customer_phone in metadata",
      };
    }

    // Validate phone format (10 digits, starts with 6-9)
    const phonePattern = /^[6-9]\d{9}$/;
    if (!phonePattern.test(customerPhone)) {
      return {
        success: false,
        error: "Invalid customer_phone format (must be 10-digit Indian mobile number)",
      };
    }

    // Extract customer ID (defaults to agent_id)
    const customerId =
      (metadata.customer_id as string) || request.agent_id;

    // Extract optional fields
    const customerEmail = metadata.customer_email as string | undefined;
    const customerName = metadata.customer_name as string | undefined;

    return {
      success: true,
      data: {
        customer_id: customerId,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        customer_name: customerName,
      },
    };
  }

  /**
   * Extract payment method from request metadata
   *
   * Defaults to UPI link flow if not specified
   *
   * @param request - Payment request
   * @returns Payment method configuration
   */
  private extractPaymentMethod(
    request: PaymentRequest
  ): CashfreePaymentRequest["payment_method"] {
    const metadata = request.metadata || {};

    // Check if specific UPI ID is provided
    const upiId = metadata.upi_id as string | undefined;

    if (upiId) {
      // UPI collect flow (user-provided UPI ID)
      return {
        upi: {
          channel: "collect",
          upi_id: upiId,
          upi_expiry_minutes: 5,
        },
      };
    }

    // Default: UPI link flow (user enters UPI ID)
    return {
      upi: {
        channel: "link",
      },
    };
  }

  /**
   * Create a Cashfree order
   *
   * @param params - Order creation parameters
   * @returns Order creation result
   */
  private async createOrder(params: {
    orderId: string;
    amount: number;
    currency: string;
    customer: CashfreeCustomer;
  }): Promise<ApiResult<CashfreeOrderResponse>> {
    const requestBody: CashfreeOrderRequest = {
      order_id: params.orderId,
      order_amount: params.amount,
      order_currency: params.currency,
      customer_details: params.customer,
    };

    const result = await this.makeRequest<CashfreeOrderResponse>({
      method: "POST",
      endpoint: "/orders",
      body: requestBody,
      timeoutMs: this.timeout.orderCreation,
    });

    if (!result.success) {
      return result;
    }

    // Verify order is in ACTIVE state
    if (result.data.order_status !== "ACTIVE") {
      return {
        success: false,
        error: `Unexpected order status: ${result.data.order_status}`,
      };
    }

    return { success: true, data: result.data };
  }

  /**
   * Execute payment for an active order
   *
   * @param params - Payment execution parameters
   * @returns Payment execution result
   */
  private async executePaymentStep(params: {
    paymentSessionId: string;
    paymentMethod: CashfreePaymentRequest["payment_method"];
  }): Promise<ApiResult<CashfreePaymentResponse>> {
    const requestBody: CashfreePaymentRequest = {
      payment_session_id: params.paymentSessionId,
      payment_method: params.paymentMethod,
    };

    return this.makeRequest<CashfreePaymentResponse>({
      method: "POST",
      endpoint: "/orders/sessions",
      body: requestBody,
      timeoutMs: this.timeout.payment,
    });
  }

  /**
   * Make an HTTP request to Cashfree API with retry logic
   *
   * Features:
   * - Exponential backoff retry for transient failures
   * - Request timeout with AbortController
   * - Automatic retry on 5xx, 429, network errors
   * - No retry on 4xx client errors
   *
   * @param params - Request parameters
   * @returns API response or error
   */
  private async makeRequest<T>(params: {
    method: "GET" | "POST";
    endpoint: string;
    body?: unknown;
    timeoutMs: number;
  }): Promise<ApiResult<T>> {
    const url = `${this.baseUrl}${params.endpoint}`;

    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        // Setup timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          params.timeoutMs
        );

        // Make request
        const response = await fetch(url, {
          method: params.method,
          headers: {
            "Content-Type": "application/json",
            "x-client-id": this.appId,
            "x-client-secret": this.secretKey,
            "x-api-version": this.apiVersion,
          },
          body: params.body ? JSON.stringify(params.body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Parse response
        const responseBody = await response.json();

        // Success case
        if (response.ok) {
          return { success: true, data: responseBody as T };
        }

        // Error case
        const errorResponse = responseBody as CashfreeErrorResponse;
        const errorMessage = this.mapCashfreeError(errorResponse);
        const isRetryable = this.isRetryableError(response.status);

        // Don't retry if not retryable or max attempts reached
        if (!isRetryable || attempt === this.retryConfig.maxAttempts) {
          console.error(
            JSON.stringify({
              level: "error",
              msg: "Cashfree API error",
              method: params.method,
              endpoint: params.endpoint,
              status: response.status,
              error: errorMessage,
              attempt,
            })
          );
          return { success: false, error: errorMessage };
        }

        // Calculate delay for retry (exponential backoff)
        const delay = Math.min(
          this.retryConfig.baseDelayMs * Math.pow(2, attempt - 1),
          this.retryConfig.maxDelayMs
        );

        console.warn(
          JSON.stringify({
            level: "warn",
            msg: "Retrying Cashfree API request",
            method: params.method,
            endpoint: params.endpoint,
            status: response.status,
            attempt,
            next_attempt_in_ms: delay,
          })
        );

        await this.sleep(delay);
      } catch (error) {
        // Handle timeout
        if (error instanceof Error && error.name === "AbortError") {
          console.error(
            JSON.stringify({
              level: "error",
              msg: "Cashfree API request timeout",
              method: params.method,
              endpoint: params.endpoint,
              timeout_ms: params.timeoutMs,
              attempt,
            })
          );
          return { success: false, error: "Request timeout" };
        }

        // Handle network errors
        if (attempt === this.retryConfig.maxAttempts) {
          console.error(
            JSON.stringify({
              level: "error",
              msg: "Cashfree API request failed",
              method: params.method,
              endpoint: params.endpoint,
              error: error instanceof Error ? error.message : String(error),
              attempt,
            })
          );
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }

        // Retry network errors
        const delay = this.retryConfig.baseDelayMs * attempt;
        console.warn(
          JSON.stringify({
            level: "warn",
            msg: "Retrying after network error",
            method: params.method,
            endpoint: params.endpoint,
            error: error instanceof Error ? error.message : String(error),
            attempt,
            next_attempt_in_ms: delay,
          })
        );
        await this.sleep(delay);
      }
    }

    // Should never reach here, but TypeScript requires it
    return { success: false, error: "Max retries exceeded" };
  }

  /**
   * Map Cashfree payment response to standardized PaymentResult
   *
   * @param payment - Cashfree payment response
   * @param orderId - Order ID for reference
   * @returns Standardized payment result
   */
  private mapPaymentResponse(
    payment: CashfreePaymentResponse,
    orderId: string
  ): PaymentResult {
    switch (payment.payment_status) {
      case "SUCCESS":
        return {
          success: true,
          provider_ref: orderId,
          status: "settled",
          metadata: {
            cf_payment_id: payment.cf_payment_id,
            payment_time: payment.payment_time,
            bank_reference: payment.bank_reference,
          },
        };

      case "PENDING":
        return {
          success: true,
          provider_ref: orderId,
          status: "pending",
          metadata: {
            cf_payment_id: payment.cf_payment_id,
          },
        };

      case "FAILED":
      case "USER_DROPPED":
        return {
          success: false,
          provider_ref: orderId,
          status: "failed",
          error: payment.payment_message || "Payment failed",
          metadata: {
            cf_payment_id: payment.cf_payment_id,
          },
        };

      default:
        return {
          success: false,
          provider_ref: orderId,
          status: "failed",
          error: `Unknown payment status: ${payment.payment_status}`,
        };
    }
  }

  /**
   * Map Cashfree error response to human-readable message
   *
   * @param error - Cashfree error response
   * @returns Error message
   */
  private mapCashfreeError(error: CashfreeErrorResponse): string {
    // Try different error field names (Cashfree uses inconsistent naming)
    const message =
      error.message ||
      error.error_description ||
      error.error_reason ||
      "Unknown error";

    const code = error.code || error.error_code || "UNKNOWN";

    return `${code}: ${message}`;
  }

  /**
   * Determine if an error is retryable
   *
   * Retry on:
   * - 5xx server errors
   * - 429 rate limiting
   *
   * Don't retry on:
   * - 4xx client errors (except 429)
   *
   * @param status - HTTP status code
   * @param error - Error response
   * @returns true if error is retryable
   */
  private isRetryableError(status: number): boolean {
    // Retry on server errors (5xx)
    if (status >= 500) {
      return true;
    }

    // Retry on rate limiting (429)
    if (status === 429) {
      return true;
    }

    // Don't retry on client errors (4xx)
    return false;
  }

  /**
   * Sleep for specified milliseconds
   *
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Constant-time string comparison (prevents timing attacks)
   *
   * @param a - First string
   * @param b - Second string
   * @returns true if strings are equal
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}

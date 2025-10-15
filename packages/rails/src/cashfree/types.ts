/**
 * Cashfree Payment Gateway TypeScript Interfaces
 * API Version: 2025-01-01
 * Documentation: https://docs.cashfree.com/reference/pg-new-apis-endpoint
 */

/**
 * Customer details required for Cashfree orders
 */
export interface CashfreeCustomer {
  customer_id: string;
  customer_email?: string;
  customer_phone: string;
  customer_name?: string;
}

/**
 * Cashfree order creation request
 */
export interface CashfreeOrderRequest {
  order_id: string;
  order_amount: number;
  order_currency: string;
  customer_details: CashfreeCustomer;
  order_meta?: {
    return_url?: string;
    notify_url?: string;
    payment_methods?: string;
  };
  order_note?: string;
  order_tags?: Record<string, string>;
}

/**
 * Cashfree order creation response
 */
export interface CashfreeOrderResponse {
  cf_order_id: number;
  order_id: string;
  entity: "order";
  order_currency: string;
  order_amount: number;
  order_status: "ACTIVE" | "PAID" | "EXPIRED";
  payment_session_id: string;
  order_expiry_time: string;
  order_note?: string;
  created_at: string;
  customer_details: CashfreeCustomer;
  order_meta?: {
    return_url?: string;
    notify_url?: string;
    payment_methods?: string;
  };
  settlements?: {
    url: string;
  };
  payments?: {
    url: string;
  };
  refunds?: {
    url: string;
  };
}

/**
 * Card payment method details
 */
export interface CashfreeCardPayment {
  channel: "link";
  card_number: string;
  card_holder_name: string;
  card_expiry_mm: string;
  card_expiry_yy: string;
  card_cvv: string;
}

/**
 * UPI payment method details
 */
export interface CashfreeUPIPayment {
  channel: "link" | "collect";
  upi_id?: string;
  upi_expiry_minutes?: number;
}

/**
 * Netbanking payment method details
 */
export interface CashfreeNetbankingPayment {
  channel: "link";
  netbanking_bank_code: number;
}

/**
 * App-based payment method (Paytm, PhonePe, etc.)
 */
export interface CashfreeAppPayment {
  channel: "link";
  provider: "paytm" | "phonepe" | "gpay";
}

/**
 * Payment method wrapper
 */
export interface CashfreePaymentMethod {
  card?: CashfreeCardPayment;
  upi?: CashfreeUPIPayment;
  netbanking?: CashfreeNetbankingPayment;
  app?: CashfreeAppPayment;
}

/**
 * Payment execution request
 */
export interface CashfreePaymentRequest {
  payment_session_id: string;
  payment_method: CashfreePaymentMethod;
}

/**
 * Card payment details in response
 */
export interface CashfreeCardDetails {
  channel: string;
  card_number: string;
  card_network: string;
  card_type: string;
  card_country: string;
  card_bank_name: string;
}

/**
 * UPI payment details in response
 */
export interface CashfreeUPIDetails {
  channel: string;
  upi_id: string;
}

/**
 * Payment execution response
 */
export interface CashfreePaymentResponse {
  cf_payment_id: number;
  order_id: string;
  entity: "payment";
  payment_currency: string;
  payment_amount: number;
  payment_time: string;
  payment_status: "SUCCESS" | "PENDING" | "FAILED" | "USER_DROPPED";
  payment_message?: string;
  bank_reference?: string;
  auth_id?: string;
  payment_method?: {
    card?: CashfreeCardDetails;
    upi?: CashfreeUPIDetails;
  };
  payment_group?: string;
}

/**
 * Webhook payload structure
 */
export interface CashfreeWebhookPayload {
  type: "PAYMENT_SUCCESS_WEBHOOK" | "PAYMENT_FAILED_WEBHOOK" | "SETTLEMENT_WEBHOOK";
  data: {
    order: {
      order_id: string;
      order_amount: number;
      order_currency: string;
      order_status: string;
    };
    payment: {
      cf_payment_id: number;
      payment_status: string;
      payment_amount: number;
      payment_currency: string;
      payment_message?: string;
      payment_time: string;
      bank_reference?: string;
      auth_id?: string;
      payment_method?: {
        card?: CashfreeCardDetails;
        upi?: CashfreeUPIDetails;
      };
    };
    customer_details: CashfreeCustomer;
  };
}

/**
 * Cashfree error response structure
 */
export interface CashfreeErrorResponse {
  status?: string;
  message?: string;
  code?: string;
  type?: string;
  error_code?: string;
  error_description?: string;
  error_reason?: string;
  error_source?: string;
}

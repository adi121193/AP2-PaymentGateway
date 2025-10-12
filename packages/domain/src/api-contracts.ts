import { z } from "zod";

// Standard API Response Wrappers

export type SuccessResponse<T> = {
  success: true;
  data: T;
};

export type ErrorResponse = {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
};

export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// Helper Functions

export function success<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
  };
}

export function error(
  code: ErrorCode,
  message: string,
  details?: unknown
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
  };
}

// Error Codes Enum

export enum ErrorCode {
  // Validation Errors (400)
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_REQUEST = "INVALID_REQUEST",
  MISSING_IDEMPOTENCY_KEY = "MISSING_IDEMPOTENCY_KEY",

  // Authentication Errors (401)
  UNAUTHORIZED = "UNAUTHORIZED",
  INVALID_TOKEN = "INVALID_TOKEN",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",

  // Authorization Errors (403)
  FORBIDDEN = "FORBIDDEN",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",

  // Resource Errors (404)
  NOT_FOUND = "NOT_FOUND",
  AGENT_NOT_FOUND = "AGENT_NOT_FOUND",
  INTENT_NOT_FOUND = "INTENT_NOT_FOUND",
  MANDATE_NOT_FOUND = "MANDATE_NOT_FOUND",
  PAYMENT_NOT_FOUND = "PAYMENT_NOT_FOUND",
  RECEIPT_NOT_FOUND = "RECEIPT_NOT_FOUND",
  POLICY_NOT_FOUND = "POLICY_NOT_FOUND",

  // Business Logic Errors (422)
  POLICY_VIOLATION = "POLICY_VIOLATION",
  VENDOR_NOT_ALLOWED = "VENDOR_NOT_ALLOWED",
  AMOUNT_EXCEEDS_CAP = "AMOUNT_EXCEEDS_CAP",
  DAILY_LIMIT_EXCEEDED = "DAILY_LIMIT_EXCEEDED",
  MANDATE_EXPIRED = "MANDATE_EXPIRED",
  MANDATE_REVOKED = "MANDATE_REVOKED",
  MANDATE_EXHAUSTED = "MANDATE_EXHAUSTED",
  INVALID_SIGNATURE = "INVALID_SIGNATURE",
  AGENT_INACTIVE = "AGENT_INACTIVE",
  HIGH_RISK_AGENT = "HIGH_RISK_AGENT",

  // Idempotency Errors (409)
  IDEMPOTENCY_CONFLICT = "IDEMPOTENCY_CONFLICT",
  DUPLICATE_REQUEST = "DUPLICATE_REQUEST",

  // Payment Processing Errors (402, 500)
  PAYMENT_FAILED = "PAYMENT_FAILED",
  PAYMENT_DECLINED = "PAYMENT_DECLINED",
  PROVIDER_ERROR = "PROVIDER_ERROR",
  STRIPE_ERROR = "STRIPE_ERROR",
  X402_ERROR = "X402_ERROR",
  TIMEOUT_ERROR = "TIMEOUT_ERROR",

  // Internal Errors (500)
  INTERNAL_ERROR = "INTERNAL_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
}

// HTTP Status Code Mapping

export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  // 400 Bad Request
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_REQUEST]: 400,
  [ErrorCode.MISSING_IDEMPOTENCY_KEY]: 400,

  // 401 Unauthorized
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.TOKEN_EXPIRED]: 401,

  // 403 Forbidden
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,

  // 404 Not Found
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.AGENT_NOT_FOUND]: 404,
  [ErrorCode.INTENT_NOT_FOUND]: 404,
  [ErrorCode.MANDATE_NOT_FOUND]: 404,
  [ErrorCode.PAYMENT_NOT_FOUND]: 404,
  [ErrorCode.RECEIPT_NOT_FOUND]: 404,
  [ErrorCode.POLICY_NOT_FOUND]: 404,

  // 409 Conflict
  [ErrorCode.IDEMPOTENCY_CONFLICT]: 409,
  [ErrorCode.DUPLICATE_REQUEST]: 409,

  // 422 Unprocessable Entity
  [ErrorCode.POLICY_VIOLATION]: 422,
  [ErrorCode.VENDOR_NOT_ALLOWED]: 422,
  [ErrorCode.AMOUNT_EXCEEDS_CAP]: 422,
  [ErrorCode.DAILY_LIMIT_EXCEEDED]: 422,
  [ErrorCode.MANDATE_EXPIRED]: 422,
  [ErrorCode.MANDATE_REVOKED]: 422,
  [ErrorCode.MANDATE_EXHAUSTED]: 422,
  [ErrorCode.INVALID_SIGNATURE]: 422,
  [ErrorCode.AGENT_INACTIVE]: 422,
  [ErrorCode.HIGH_RISK_AGENT]: 422,

  // 402 Payment Required / 500 Internal Server Error
  [ErrorCode.PAYMENT_FAILED]: 402,
  [ErrorCode.PAYMENT_DECLINED]: 402,
  [ErrorCode.PROVIDER_ERROR]: 500,
  [ErrorCode.STRIPE_ERROR]: 500,
  [ErrorCode.X402_ERROR]: 500,
  [ErrorCode.TIMEOUT_ERROR]: 504,

  // 500 Internal Server Error
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.CONFIGURATION_ERROR]: 500,
};

// Custom Error Classes

export class ApiError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown,
    public statusCode?: number
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode ?? ERROR_HTTP_STATUS[code];
  }

  toResponse(): ErrorResponse {
    return error(this.code, this.message, this.details);
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.VALIDATION_ERROR, message, details, 400);
    this.name = "ValidationError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized") {
    super(ErrorCode.UNAUTHORIZED, message, undefined, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = "Forbidden") {
    super(ErrorCode.FORBIDDEN, message, undefined, 403);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string) {
    super(ErrorCode.NOT_FOUND, `${resource} not found`, undefined, 404);
    this.name = "NotFoundError";
  }
}

export class PolicyViolationError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.POLICY_VIOLATION, message, details, 422);
    this.name = "PolicyViolationError";
  }
}

export class IdempotencyConflictError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.IDEMPOTENCY_CONFLICT, message, details, 409);
    this.name = "IdempotencyConflictError";
  }
}

export class PaymentFailedError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.PAYMENT_FAILED, message, details, 402);
    this.name = "PaymentFailedError";
  }
}

// Response DTOs

export const CreateIntentResponseSchema = z.object({
  intent_id: z.string(),
  agent_id: z.string(),
  vendor: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  status: z.string(),
  created_at: z.coerce.date(),
});
export type CreateIntentResponse = z.infer<typeof CreateIntentResponseSchema>;

export const CreateMandateResponseSchema = z.object({
  mandate_id: z.string(),
  intent_id: z.string(),
  policy_id: z.string(),
  signature: z.string(),
  expires_at: z.coerce.date(),
  status: z.string(),
});
export type CreateMandateResponse = z.infer<typeof CreateMandateResponseSchema>;

export const ExecutePaymentResponseSchema = z.object({
  payment_id: z.string(),
  mandate_id: z.string(),
  provider: z.string(),
  provider_ref: z.string().nullable(),
  amount: z.number().int(),
  currency: z.string(),
  status: z.string(),
  receipt_id: z.string(),
});
export type ExecutePaymentResponse = z.infer<typeof ExecutePaymentResponseSchema>;

export const ReceiptResponseSchema = z.object({
  receipt_id: z.string(),
  payment_id: z.string(),
  agent_id: z.string(),
  mandate_id: z.string(),
  provider: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  hash: z.string(),
  prev_hash: z.string().nullable(),
  chain_index: z.number().int(),
  created_at: z.coerce.date(),
});
export type ReceiptResponse = z.infer<typeof ReceiptResponseSchema>;

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema),
    pagination: z.object({
      page: z.number().int(),
      limit: z.number().int(),
      total: z.number().int(),
      pages: z.number().int(),
    }),
  });

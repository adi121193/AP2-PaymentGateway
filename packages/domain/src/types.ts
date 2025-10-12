import { z } from "zod";

// Currency validation using ISO 4217 codes (subset for test mode)
export const CurrencySchema = z.enum(["USD", "EUR", "GBP", "INR", "CAD", "AUD"]);
export type Currency = z.infer<typeof CurrencySchema>;

// Risk tier classification
export const RiskTierSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type RiskTier = z.infer<typeof RiskTierSchema>;

// Payment provider types
export const ProviderSchema = z.enum(["stripe", "x402"]);
export type Provider = z.infer<typeof ProviderSchema>;

// Payment/Mandate status enums
export const PaymentStatusSchema = z.enum([
  "INITIATED",
  "PENDING",
  "PROCESSING",
  "SETTLED",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const MandateStatusSchema = z.enum([
  "ACTIVE",
  "EXPIRED",
  "REVOKED",
  "EXHAUSTED",
]);
export type MandateStatus = z.infer<typeof MandateStatusSchema>;

export const IntentStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
  "EXECUTED",
]);
export type IntentStatus = z.infer<typeof IntentStatusSchema>;

// Purchase Intent Schema
export const PurchaseIntentSchema = z.object({
  agent_id: z.string().min(1, "Agent ID is required"),
  vendor: z
    .string()
    .min(1, "Vendor is required")
    .max(255)
    .regex(/^[a-zA-Z0-9_-]+$/, "Vendor must be alphanumeric with hyphens/underscores"),
  amount: z
    .number()
    .int("Amount must be an integer")
    .positive("Amount must be positive")
    .max(1000000, "Amount exceeds maximum limit"),
  currency: CurrencySchema.default("USD"),
  description: z.string().min(1).max(500),
  metadata: z.record(z.unknown()).optional().default({}),
});
export type PurchaseIntent = z.infer<typeof PurchaseIntentSchema>;

// Policy Schema
export const PolicySchema = z.object({
  agent_id: z.string().min(1),
  version: z.number().int().positive(),
  vendor_allowlist: z.array(z.string()).min(1, "At least one vendor must be allowed"),
  amount_cap: z
    .number()
    .int()
    .positive("Amount cap must be positive")
    .max(1000000, "Amount cap exceeds maximum"),
  daily_cap: z
    .number()
    .int()
    .positive("Daily cap must be positive")
    .max(10000000, "Daily cap exceeds maximum"),
  risk_tier: RiskTierSchema.default("LOW"),
  x402_enabled: z.boolean().default(true),
  expires_at: z.coerce.date().refine((date) => date > new Date(), {
    message: "Expiry date must be in the future",
  }),
});
export type Policy = z.infer<typeof PolicySchema>;

// Mandate Schema
export const MandateSchema = z.object({
  intent_id: z.string().min(1, "Intent ID is required"),
  policy_id: z.string().min(1, "Policy ID is required"),
  signature: z.string().min(64, "Invalid signature format"),
  expires_at: z.coerce.date().refine((date) => date > new Date(), {
    message: "Mandate must have future expiry",
  }),
});
export type Mandate = z.infer<typeof MandateSchema>;

// Receipt Schema
export const ReceiptSchema = z.object({
  payment_id: z.string().min(1),
  agent_id: z.string().min(1),
  hash: z.string().regex(/^sha256:[a-f0-9]{64}$/, "Invalid hash format"),
  prev_hash: z
    .string()
    .regex(/^sha256:[a-f0-9]{64}$/, "Invalid previous hash format")
    .nullable()
    .optional(),
  chain_index: z.number().int().min(0),
});
export type Receipt = z.infer<typeof ReceiptSchema>;

// Payment Execution Schema
export const PaymentExecutionSchema = z.object({
  mandate_id: z.string().min(1, "Mandate ID is required"),
  vendor_endpoint: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional().default({}),
});
export type PaymentExecution = z.infer<typeof PaymentExecutionSchema>;

// x402 Payment Request Schema
export const X402PaymentRequestSchema = z.object({
  agent_id: z.string().min(1),
  mandate_id: z.string().min(1),
  vendor: z.string().min(1),
  amount: z.number().int().positive().max(200, "x402 amount must not exceed 200"),
  currency: CurrencySchema,
  timestamp: z.coerce.date(),
});
export type X402PaymentRequest = z.infer<typeof X402PaymentRequestSchema>;

// x402 Payment Response Schema
export const X402PaymentResponseSchema = z.object({
  settlement_ref: z.string().min(1),
  status: z.enum(["settled", "pending"]),
  timestamp: z.coerce.date(),
});
export type X402PaymentResponse = z.infer<typeof X402PaymentResponseSchema>;

// Vendor x402 Configuration Schema
export const VendorX402ConfigSchema = z.object({
  vendor: z.string().min(1),
  endpoint: z.string().url(),
  public_key: z.string().min(64),
  enabled: z.boolean().default(true),
});
export type VendorX402Config = z.infer<typeof VendorX402ConfigSchema>;

// Idempotency Key Schema
export const IdempotencyKeySchema = z
  .string()
  .min(1, "Idempotency-Key header is required")
  .max(255)
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Idempotency key must be alphanumeric with hyphens/underscores"
  );

// Query Parameter Schemas
export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type Pagination = z.infer<typeof PaginationSchema>;

export const DateRangeSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});
export type DateRange = z.infer<typeof DateRangeSchema>;

// Daily spending calculation
export const DailySpendingSchema = z.object({
  agent_id: z.string(),
  date: z.coerce.date(),
  total_amount: z.number().int().min(0),
  transaction_count: z.number().int().min(0),
});
export type DailySpending = z.infer<typeof DailySpendingSchema>;

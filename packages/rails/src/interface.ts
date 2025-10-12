export interface PaymentResult {
  success: boolean;
  provider_ref?: string;
  error?: string;
  status: "settled" | "pending" | "failed";
}

export interface PaymentRequest {
  mandate_id: string;
  amount: number;
  currency: string;
  vendor: string;
  agent_id: string;
  metadata?: Record<string, unknown>;
}

export interface RailAdapter {
  name: "stripe" | "x402";
  executePayment(request: PaymentRequest): Promise<PaymentResult>;
  verifyWebhook?(payload: unknown, signature: string): boolean;
}

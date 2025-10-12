import { ed25519 } from "@noble/curves/ed25519";
import { getEnv } from "@ap2/domain";
import { stableStringify } from "@ap2/receipts";
import type { RailAdapter, PaymentRequest, PaymentResult } from "./interface";

export interface X402VendorConfig {
  endpoint: string;
  public_key: string;
}

export class X402Adapter implements RailAdapter {
  public readonly name = "x402" as const;
  private privateKey: Uint8Array;
  private publicKey: Uint8Array;

  constructor() {
    const env = getEnv();
    this.privateKey = Buffer.from(env.MANDATE_SIGN_KEY, "hex");
    this.publicKey = ed25519.getPublicKey(this.privateKey);
  }

  async executePayment(
    request: PaymentRequest,
    vendorConfig: X402VendorConfig
  ): Promise<PaymentResult> {
    try {
      const timestamp = new Date();
      const requestBody = {
        agent_id: request.agent_id,
        mandate_id: request.mandate_id,
        vendor: request.vendor,
        amount: request.amount,
        currency: request.currency,
        timestamp: timestamp.toISOString(),
      };

      const canonical = stableStringify(requestBody);
      const messageBytes = new TextEncoder().encode(canonical);
      const signature = ed25519.sign(messageBytes, this.privateKey);
      const signatureBase64 = Buffer.from(signature).toString("base64");
      const publicKeyBase64 = Buffer.from(this.publicKey).toString("base64");

      const env = getEnv();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), env.X402_TIMEOUT_MS);

      const response = await fetch(vendorConfig.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Payment-Amount": request.amount.toString(),
          "X-Payment-Currency": request.currency,
          "Idempotency-Key": request.mandate_id,
          "X-Signature": signatureBase64,
          "X-Public-Key": publicKeyBase64,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        return {
          success: false,
          status: "failed",
          error: errorBody.message || `HTTP ${response.status}`,
        };
      }

      const responseData = await response.json();

      return {
        success: true,
        provider_ref: responseData.settlement_ref,
        status: responseData.status === "settled" ? "settled" : "pending",
      };
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          return {
            success: false,
            status: "failed",
            error: "Request timeout (5s exceeded)",
          };
        }
        return {
          success: false,
          status: "failed",
          error: error.message,
        };
      }
      throw error;
    }
  }
}

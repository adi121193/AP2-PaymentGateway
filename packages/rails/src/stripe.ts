import Stripe from "stripe";
import { getEnv } from "@ap2/domain";
import type { RailAdapter, PaymentRequest, PaymentResult } from "./interface";

export class StripeAdapter implements RailAdapter {
  public readonly name = "stripe" as const;
  private stripe: Stripe;

  constructor() {
    const env = getEnv();
    this.stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-12-18.acacia",
      typescript: true,
    });
  }

  async executePayment(request: PaymentRequest): Promise<PaymentResult> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: request.amount,
        currency: request.currency.toLowerCase(),
        metadata: {
          mandate_id: request.mandate_id,
          agent_id: request.agent_id,
          vendor: request.vendor,
          ...request.metadata,
        },
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: "never",
        },
      });

      if (paymentIntent.status === "succeeded") {
        return {
          success: true,
          provider_ref: paymentIntent.id,
          status: "settled",
        };
      } else if (paymentIntent.status === "processing") {
        return {
          success: true,
          provider_ref: paymentIntent.id,
          status: "pending",
        };
      } else {
        return {
          success: false,
          provider_ref: paymentIntent.id,
          status: "failed",
          error: `Payment status: ${paymentIntent.status}`,
        };
      }
    } catch (error) {
      if (error instanceof Stripe.errors.StripeError) {
        return {
          success: false,
          status: "failed",
          error: error.message,
        };
      }
      throw error;
    }
  }

  verifyWebhook(payload: unknown, signature: string): boolean {
    const env = getEnv();
    try {
      this.stripe.webhooks.constructEvent(
        JSON.stringify(payload),
        signature,
        env.STRIPE_WEBHOOK_SECRET
      );
      return true;
    } catch {
      return false;
    }
  }
}

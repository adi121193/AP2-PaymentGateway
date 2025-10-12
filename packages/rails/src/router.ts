import { getEnv } from "@ap2/domain";
import type { RailAdapter, PaymentRequest, PaymentResult } from "./interface";
import { StripeAdapter } from "./stripe";
import { X402Adapter, type X402VendorConfig } from "./x402";

export interface RoutingContext {
  amount: number;
  risk_tier: string;
  policy_x402_enabled: boolean;
  vendor_x402_config?: X402VendorConfig;
}

export type RoutingDecision = {
  rail: "stripe" | "x402";
  reason: string;
};

export function selectRail(context: RoutingContext): RoutingDecision {
  const env = getEnv();

  if (context.amount > env.X402_MAX_AMOUNT) {
    return {
      rail: "stripe",
      reason: `Amount ${context.amount} exceeds x402 maximum of ${env.X402_MAX_AMOUNT}`,
    };
  }

  if (!context.policy_x402_enabled) {
    return {
      rail: "stripe",
      reason: "Policy has x402 disabled",
    };
  }

  if (!context.vendor_x402_config) {
    return {
      rail: "stripe",
      reason: "Vendor does not have x402 endpoint configured",
    };
  }

  if (context.risk_tier === "HIGH") {
    return {
      rail: "stripe",
      reason: "High risk agent requires Stripe processing",
    };
  }

  return {
    rail: "x402",
    reason: "Amount ≤ 200, policy allows x402, vendor supports x402, risk tier acceptable",
  };
}

export class RailRouter {
  private stripeAdapter: StripeAdapter;
  private x402Adapter: X402Adapter;

  constructor() {
    this.stripeAdapter = new StripeAdapter();
    this.x402Adapter = new X402Adapter();
  }

  async executePayment(
    request: PaymentRequest,
    context: RoutingContext
  ): Promise<PaymentResult & { rail: string; routing_reason: string }> {
    const decision = selectRail(context);

    console.log("Payment routing decision:", {
      mandate_id: request.mandate_id,
      rail: decision.rail,
      reason: decision.reason,
    });

    let result: PaymentResult;

    if (decision.rail === "x402" && context.vendor_x402_config) {
      result = await this.x402Adapter.executePayment(
        request,
        context.vendor_x402_config
      );
    } else {
      result = await this.stripeAdapter.executePayment(request);
    }

    return {
      ...result,
      rail: decision.rail,
      routing_reason: decision.reason,
    };
  }

  getAdapter(rail: "stripe" | "x402"): RailAdapter {
    return rail === "stripe" ? this.stripeAdapter : this.x402Adapter;
  }
}

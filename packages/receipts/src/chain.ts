import { createHash } from "crypto";

export function stableStringify(obj: unknown): string {
  if (obj === null) {
    return "null";
  }
  if (obj === undefined) {
    return "undefined";
  }

  if (typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return JSON.stringify(obj);
  }

  const sortedKeys = Object.keys(obj).sort();
  const sortedObj: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sortedObj[key] = (obj as Record<string, unknown>)[key];
  }

  return JSON.stringify(sortedObj);
}

export function sha256Hash(data: string): string {
  const hash = createHash("sha256").update(data, "utf8").digest("hex");
  return `sha256:${hash}`;
}

export interface ReceiptData {
  prev_hash: string | null;
  payment_id: string;
  mandate_id: string;
  amount: number;
  currency: string;
  timestamp: Date;
}

export function generateReceiptHash(data: ReceiptData): string {
  const canonical = stableStringify({
    prev_hash: data.prev_hash,
    payment_id: data.payment_id,
    mandate_id: data.mandate_id,
    amount: data.amount,
    currency: data.currency,
    timestamp: data.timestamp.toISOString(),
  });

  return sha256Hash(canonical);
}

export interface MandateData {
  intent_id: string;
  policy_id: string;
  expires_at: Date;
  agent_id?: string;
  vendor?: string;
  amount?: number;
  currency?: string;
}

export function generateMandateHash(data: MandateData): string {
  const canonical = stableStringify({
    intent_id: data.intent_id,
    policy_id: data.policy_id,
    expires_at: data.expires_at.toISOString(),
    ...(data.agent_id !== undefined && { agent_id: data.agent_id }),
    ...(data.vendor !== undefined && { vendor: data.vendor }),
    ...(data.amount !== undefined && { amount: data.amount }),
    ...(data.currency !== undefined && { currency: data.currency }),
  });

  return sha256Hash(canonical);
}

export function verifyReceiptChain(
  receipts: Array<{ hash: string; prev_hash: string | null; payment_id: string; mandate_id: string; amount: number; currency: string; created_at: Date }>
): { valid: boolean; brokenAt?: number } {
  if (receipts.length === 0) {
    return { valid: true };
  }

  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i];

    // Validate receipt exists
    if (!receipt) {
      return { valid: false, brokenAt: i };
    }

    const expectedHash = generateReceiptHash({
      prev_hash: receipt.prev_hash,
      payment_id: receipt.payment_id,
      mandate_id: receipt.mandate_id,
      amount: receipt.amount,
      currency: receipt.currency,
      timestamp: receipt.created_at,
    });

    if (receipt.hash !== expectedHash) {
      return { valid: false, brokenAt: i };
    }

    if (i > 0) {
      const prevReceipt = receipts[i - 1];
      // Validate previous receipt exists
      if (!prevReceipt) {
        return { valid: false, brokenAt: i };
      }
      if (receipt.prev_hash !== prevReceipt.hash) {
        return { valid: false, brokenAt: i };
      }
    }
  }

  return { valid: true };
}

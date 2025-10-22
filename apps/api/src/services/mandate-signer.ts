import { ed25519 } from "@noble/curves/ed25519";
import { getEnv } from "@ap2/domain";
import { generateMandateHash } from "@ap2/receipts";
import { logger } from "../logger.js";

/**
 * Mandate Signer Service
 *
 * Handles Ed25519 signing of mandates for cryptographic authorization.
 * Each mandate is signed with the gateway's private key to prove authenticity.
 */

export interface MandateData {
  intent_id: string;
  policy_id: string;
  agent_id: string;
  vendor: string;
  amount: number;
  currency: string;
  expires_at: Date;
}

export interface SignedMandate {
  signature: string;
  hash: string;
  public_key: string;
}

/**
 * Sign a mandate using Ed25519 cryptographic signature
 *
 * @param mandateData - The mandate data to sign
 * @returns Signature, hash, and public key
 */
export async function signMandate(mandateData: MandateData): Promise<SignedMandate> {
  const env = getEnv();

  try {
    // Generate deterministic hash of mandate data (use all fields for proper uniqueness)
    const mandateHash = generateMandateHash({
      intent_id: mandateData.intent_id,
      policy_id: mandateData.policy_id,
      expires_at: mandateData.expires_at,
      agent_id: mandateData.agent_id,
      vendor: mandateData.vendor,
      amount: mandateData.amount,
      currency: mandateData.currency,
    });

    // Convert MANDATE_SIGN_KEY from hex to bytes
    // The key should be 64 characters (32 bytes) in hex format
    const privateKeyHex = env.MANDATE_SIGN_KEY;

    if (privateKeyHex.length < 64) {
      throw new Error("MANDATE_SIGN_KEY must be at least 64 characters (32 bytes in hex)");
    }

    const privateKey = hexToBytes(privateKeyHex.substring(0, 64));

    // Generate public key from private key
    const publicKey = ed25519.getPublicKey(privateKey);

    // Sign the mandate hash
    const messageBytes = hexToBytes(mandateHash.replace("sha256:", ""));
    const signature = ed25519.sign(messageBytes, privateKey);

    const signedMandate = {
      signature: bytesToHex(signature),
      hash: mandateHash,
      public_key: bytesToHex(publicKey),
    };

    logger.info(
      {
        intent_id: mandateData.intent_id,
        policy_id: mandateData.policy_id,
        hash: mandateHash,
      },
      "Mandate signed successfully"
    );

    return signedMandate;
  } catch (error) {
    logger.error(
      {
        error,
        intent_id: mandateData.intent_id,
      },
      "Failed to sign mandate"
    );
    throw error;
  }
}

/**
 * Verify a mandate signature
 *
 * @param mandateData - The original mandate data
 * @param signature - The signature to verify (hex string)
 * @param publicKey - The public key used for signing (hex string)
 * @returns True if signature is valid
 */
export function verifyMandateSignature(
  mandateData: MandateData,
  signature: string,
  publicKey: string
): boolean {
  try {
    // Generate hash from mandate data (use all fields)
    const mandateHash = generateMandateHash({
      intent_id: mandateData.intent_id,
      policy_id: mandateData.policy_id,
      expires_at: mandateData.expires_at,
      agent_id: mandateData.agent_id,
      vendor: mandateData.vendor,
      amount: mandateData.amount,
      currency: mandateData.currency,
    });

    // Convert hex strings to bytes
    const signatureBytes = hexToBytes(signature);
    const publicKeyBytes = hexToBytes(publicKey);
    const messageBytes = hexToBytes(mandateHash.replace("sha256:", ""));

    // Verify signature
    const isValid = ed25519.verify(signatureBytes, messageBytes, publicKeyBytes);

    logger.debug(
      {
        intent_id: mandateData.intent_id,
        isValid,
      },
      "Mandate signature verification"
    );

    return isValid;
  } catch (error) {
    logger.error(
      {
        error,
        intent_id: mandateData.intent_id,
      },
      "Failed to verify mandate signature"
    );
    return false;
  }
}

/**
 * Extract public key from private key
 * Useful for verifying our own signatures
 */
export function getPublicKeyFromPrivateKey(privateKeyHex: string): string {
  // Remove 0x prefix if present, then take first 64 chars
  const cleanHex = privateKeyHex.startsWith("0x") ? privateKeyHex.slice(2) : privateKeyHex;
  const privateKey = hexToBytes(cleanHex.substring(0, 64));
  const publicKey = ed25519.getPublicKey(privateKey);
  return bytesToHex(publicKey);
}

// Utility functions for hex/bytes conversion

function hexToBytes(hex: string): Uint8Array {
  // Remove any 0x prefix
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;

  if (cleanHex.length % 2 !== 0) {
    throw new Error("Hex string must have even length");
  }

  // Validate hex characters
  if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
    throw new Error("Invalid hex characters in string");
  }

  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

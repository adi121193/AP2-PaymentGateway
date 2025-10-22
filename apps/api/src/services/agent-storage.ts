/**
 * Agent Storage Service
 *
 * Handles uploading agent code bundles to S3-compatible storage (Cloudflare R2)
 * File naming: agents/{agent_id}/{version}/{timestamp}.zip
 */

import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { logger } from "../logger.js";
import { createHash } from "crypto";

export class AgentStorageService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor() {
    // For now, we'll use environment variables for R2 configuration
    // In production, these would be set via Railway/deployment platform
    const accountId = process.env.R2_ACCOUNT_ID || "demo";
    const accessKeyId = process.env.R2_ACCESS_KEY_ID || "demo";
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || "demo";
    this.bucketName = process.env.R2_BUCKET_NAME || "frameos-agents";

    // Cloudflare R2 endpoint format: https://{account_id}.r2.cloudflarestorage.com
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

    this.s3Client = new S3Client({
      region: "auto", // R2 uses 'auto' region
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    logger.info({ bucketName: this.bucketName, endpoint }, "Agent storage service initialized");
  }

  /**
   * Upload agent code bundle (ZIP file)
   *
   * @param agentId - Agent identifier (e.g., "agt_linkedin_outreach")
   * @param version - Semantic version (e.g., "1.0.0")
   * @param buffer - ZIP file buffer
   * @param contentType - MIME type (should be "application/zip")
   * @returns S3 URL to the uploaded file
   */
  async uploadAgentCode(
    agentId: string,
    version: string,
    buffer: Buffer,
    contentType: string = "application/zip"
  ): Promise<{ url: string; sha256: string }> {
    try {
      // Validate inputs
      if (!agentId || !version || !buffer || buffer.length === 0) {
        throw new Error("Invalid upload parameters");
      }

      // Compute SHA-256 hash for integrity verification
      const sha256 = createHash("sha256").update(buffer).digest("hex");

      // Generate S3 key: agents/{agent_id}/{version}/{sha256}.zip
      const timestamp = Date.now();
      const key = `agents/${agentId}/${version}/${timestamp}-${sha256.substring(0, 8)}.zip`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          agent_id: agentId,
          version: version,
          sha256: sha256,
          uploaded_at: new Date().toISOString(),
        },
      });

      await this.s3Client.send(command);

      // Construct public URL (R2 public bucket URL)
      const url = `https://pub-${this.bucketName}.r2.dev/${key}`;

      logger.info(
        {
          agentId,
          version,
          key,
          size: buffer.length,
          sha256: sha256.substring(0, 16),
        },
        "Agent code uploaded"
      );

      return { url, sha256 };
    } catch (error) {
      logger.error({ error, agentId, version }, "Agent code upload failed");
      throw new Error(`Failed to upload agent code: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  /**
   * Generate presigned URL for agent code download
   * Used by execution engine to download code bundles
   *
   * @param codeUrl - S3 URL from database
   * @param expiresIn - URL expiration in seconds (default: 3600 = 1 hour)
   * @returns Presigned URL
   */
  async getPresignedDownloadUrl(codeUrl: string, expiresIn: number = 3600): Promise<string> {
    try {
      // Extract key from URL
      // Format: https://pub-{bucket}.r2.dev/{key}
      const url = new URL(codeUrl);
      const key = url.pathname.substring(1); // Remove leading '/'

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

      logger.debug({ key, expiresIn }, "Generated presigned download URL");

      return signedUrl;
    } catch (error) {
      logger.error({ error, codeUrl }, "Failed to generate presigned URL");
      throw new Error("Failed to generate download URL");
    }
  }

  /**
   * Check if agent code exists in storage
   *
   * @param codeUrl - S3 URL
   * @returns True if file exists
   */
  async codeExists(codeUrl: string): Promise<boolean> {
    try {
      const url = new URL(codeUrl);
      const key = url.pathname.substring(1);

      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.s3Client.send(command);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete agent code from storage
   * Used when agent version is deleted or replaced
   *
   * @param codeUrl - S3 URL
   */
  async deleteAgentCode(codeUrl: string): Promise<void> {
    try {
      const url = new URL(codeUrl);
      const key = url.pathname.substring(1);

      // Note: DeleteObjectCommand would be used here
      // For safety in demo, we'll just log it
      logger.warn({ key }, "Agent code deletion requested (not implemented in demo)");
    } catch (error) {
      logger.error({ error, codeUrl }, "Failed to delete agent code");
      throw new Error("Failed to delete agent code");
    }
  }
}

// Singleton instance
let storageService: AgentStorageService | null = null;

export function getStorageService(): AgentStorageService {
  if (!storageService) {
    storageService = new AgentStorageService();
  }
  return storageService;
}

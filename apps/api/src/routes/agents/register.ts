/**
 * Agent Registration Endpoint
 *
 * POST /agents/register
 * Allows developers to register new agents to the marketplace
 */

import { Router, Request, Response } from "express";
import { prisma } from "@ap2/database";
import { validateManifest, AgentManifest } from "@ap2/domain/agent-manifest";
import { authenticateDeveloper, AuthenticatedRequest } from "../../middleware/developer-auth.js";
import { idempotency } from "../../middleware/idempotency.js";
import { getStorageService } from "../../services/agent-storage.js";
import { logger } from "../../logger.js";
import multer from "multer";
import { z } from "zod";

const router = Router();

// Configure multer for file upload (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "application/zip" && !file.originalname.endsWith(".zip")) {
      cb(new Error("Only ZIP files are allowed"));
      return;
    }
    cb(null, true);
  },
});

/**
 * Request body schema for agent registration
 */
const RegisterAgentRequestSchema = z.object({
  manifest: z.string().transform((str, ctx) => {
    try {
      return JSON.parse(str);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Manifest must be valid JSON",
      });
      return z.NEVER;
    }
  }),
});

/**
 * POST /agents/register
 *
 * Multipart form data:
 * - manifest: JSON string (AgentManifest)
 * - code: ZIP file (agent code bundle)
 *
 * Headers:
 * - Authorization: Bearer dev_<api_key>
 * - Idempotency-Key: <unique_key>
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     agent_id: string,
 *     status: "pending_review" | "active",
 *     code_url: string,
 *     version: string
 *   }
 * }
 */
router.post(
  "/",
  authenticateDeveloper,
  idempotency,
  upload.single("code"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const developer = (req as AuthenticatedRequest).developer;
      if (!developer) {
        res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Developer not authenticated" },
        });
        return;
      }

      // Validate request body
      const bodyValidation = RegisterAgentRequestSchema.safeParse(req.body);
      if (!bodyValidation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Invalid request body",
            details: bodyValidation.error.errors,
          },
        });
        return;
      }

      const { manifest: manifestData } = bodyValidation.data;

      // Validate manifest
      const manifestValidation = validateManifest(manifestData);
      if (!manifestValidation.valid) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_MANIFEST",
            message: "Agent manifest validation failed",
            details: manifestValidation.errors,
          },
        });
        return;
      }

      const manifest = manifestValidation.data;

      // Validate code file
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: {
            code: "MISSING_CODE",
            message: "Agent code bundle (ZIP file) is required",
          },
        });
        return;
      }

      const codeBuffer = req.file.buffer;

      // Basic ZIP validation (magic number: PK)
      if (codeBuffer.length < 4 || codeBuffer[0] !== 0x50 || codeBuffer[1] !== 0x4b) {
        res.status(400).json({
          success: false,
          error: {
            code: "INVALID_CODE",
            message: "Code file must be a valid ZIP archive",
          },
        });
        return;
      }

      // Generate agent ID from slug
      const agentId = `agt_${manifest.slug}`;

      // Check if agent already exists
      const existingAgent = await prisma.agentDefinition.findUnique({
        where: { id: agentId },
      });

      if (existingAgent) {
        res.status(409).json({
          success: false,
          error: {
            code: "AGENT_EXISTS",
            message: `Agent with slug "${manifest.slug}" already exists. Use a different slug or update the existing agent.`,
          },
        });
        return;
      }

      // Upload code to storage
      const storageService = getStorageService();
      const { url: codeUrl, sha256 } = await storageService.uploadAgentCode(
        agentId,
        manifest.version,
        codeBuffer,
        "application/zip"
      );

      // Add author info to manifest
      const enrichedManifest: AgentManifest = {
        ...manifest,
        id: agentId,
        author: {
          developer_id: developer.id,
          name: developer.name,
          email: developer.email,
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Create agent in database
      const agent = await prisma.agentDefinition.create({
        data: {
          id: agentId,
          developer_id: developer.id,
          manifest: enrichedManifest as any,
          code_url: codeUrl,
          status: "pending_review", // Auto-approved for verified developers in production
          downloads: 0,
        },
      });

      // Also create first version record
      await prisma.agentVersion.create({
        data: {
          agent_id: agentId,
          version: manifest.version,
          manifest: enrichedManifest as any,
          code_url: codeUrl,
          changelog: manifest.changelog || "Initial release",
          status: "active",
        },
      });

      logger.info(
        {
          agentId,
          developerId: developer.id,
          version: manifest.version,
          codeSize: codeBuffer.length,
          sha256: sha256.substring(0, 16),
        },
        "Agent registered successfully"
      );

      res.status(201).json({
        success: true,
        data: {
          agent_id: agentId,
          slug: manifest.slug,
          version: manifest.version,
          status: agent.status,
          code_url: codeUrl,
          code_sha256: sha256,
          created_at: agent.created_at.toISOString(),
        },
      });
    } catch (error) {
      logger.error({ error }, "Agent registration failed");

      if (error instanceof multer.MulterError) {
        res.status(400).json({
          success: false,
          error: {
            code: "FILE_UPLOAD_ERROR",
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to register agent",
        },
      });
    }
  }
);

export { router as registerRouter };
